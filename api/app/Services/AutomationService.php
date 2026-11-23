<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;

/** Turns enabled automation rules into capped campaigns. Cron is the only caller. */
class AutomationService
{
    public function __construct(private ?BaseConnection $db = null)
    {
        $this->db ??= db_connect();
    }

    public function run(): int
    {
        if (!$this->db->tableExists('push_automations')) {
            return 0;
        }
        $rules = $this->db->table('push_automations')->where('enabled', 1)->get()->getResultArray();
        $queued = 0;
        foreach ($rules as $rule) {
            $template = $this->db->table('push_templates')->where('id', (int)$rule['template_id'])->get()->getRowArray();
            if (!$template) {
                continue;
            }
            $userIds = $this->matchingUsers($rule);
            $userIds = $this->withinCap($userIds, (int)$rule['id'], (int)$rule['cap_per_week']);
            if (!$userIds) {
                continue;
            }
            $this->db->table('push_campaigns')->insert([
                'category' => in_array($template['category'], ['announcement', 'offer', 'update'], true) ? $template['category'] : 'announcement',
                'title_en' => $template['title_en'],
                'title_bn' => $template['title_bn'],
                'body_en' => $template['body_en'],
                'body_bn' => $template['body_bn'],
                'logo_mode' => $template['logo_mode'],
                'action_type' => $template['action_type'],
                'action_value' => $template['action_value'],
                'target' => 'selected',
                'target_filters' => json_encode(['user_ids' => $userIds]),
                'status' => 'sending',
                'source_automation_id' => (int)$rule['id'],
                'scheduled_at' => date('Y-m-d H:i:s'),
            ]);
            $id = (int)$this->db->insertID();
            $campaign = $this->db->table('push_campaigns')->where('id', $id)->get()->getRowArray();
            (new PushQueueService($this->db))->enqueue($campaign);
            $queued++;
        }
        return $queued;
    }

    /** @param array<string, mixed> $rule @return list<int> */
    private function matchingUsers(array $rule): array
    {
        $value = (string)$rule['rule_value'];
        $days = min(3650, max(1, (int)$value));
        if ($rule['rule'] === 'inactive_days') {
            return $this->ids($this->db->table('users')->select('id')->where('status', 'active')
                ->where('last_seen_at <', date('Y-m-d H:i:s', time() - $days * 86400)));
        }
        if ($rule['rule'] === 'no_records') {
            return $this->ids($this->db->query(
                'SELECT u.id FROM users u LEFT JOIN transactions t ON t.user_id = u.id WHERE u.status = ? AND u.created_at <= ? AND t.id IS NULL',
                ['active', date('Y-m-d H:i:s', time() - 86400)]
            ));
        }
        if ($rule['rule'] === 'no_sync') {
            return $this->ids($this->db->query(
                'SELECT u.id FROM users u LEFT JOIN user_sync_revisions r ON r.user_id = u.id WHERE u.status = ? AND (r.updated_at IS NULL OR r.updated_at < ?)',
                ['active', date('Y-m-d H:i:s', time() - $days * 86400)]
            ));
        }
        if ($rule['rule'] === 'old_version') {
            $rows = $this->db->table('devices')->select('user_id, app_version')->where('status', 'active')
                ->where('push_token IS NOT NULL')->where('push_token !=', '')->get()->getResultArray();
            $ids = [];
            foreach ($rows as $row) {
                if ($row['app_version'] && version_compare((string)$row['app_version'], $value, '<')) {
                    $ids[(int)$row['user_id']] = (int)$row['user_id'];
                }
            }
            return array_values($ids);
        }
        return [];
    }

    /** @param list<int> $userIds @return list<int> */
    private function withinCap(array $userIds, int $automationId, int $cap): array
    {
        if (!$userIds) {
            return [];
        }
        $cap = min(7, max(1, $cap));
        $since = date('Y-m-d H:i:s', time() - 7 * 86400);
        $rows = $this->db->query(
            'SELECT i.user_id, COUNT(*) AS sent FROM inbox_notifications i JOIN push_campaigns c ON c.id = i.campaign_id WHERE c.source_automation_id = ? AND i.created_at >= ? AND i.user_id IN (' . implode(',', array_fill(0, count($userIds), '?')) . ') GROUP BY i.user_id',
            array_merge([$automationId, $since], $userIds)
        )->getResultArray();
        $counts = [];
        foreach ($rows as $row) {
            $counts[(int)$row['user_id']] = (int)$row['sent'];
        }
        return array_values(array_filter($userIds, static fn (int $id): bool => ($counts[$id] ?? 0) < $cap));
    }

    /** @return list<int> */
    private function ids($query): array
    {
        $rows = is_object($query) && method_exists($query, 'get') ? $query->limit(500)->get()->getResultArray() : $query->getResultArray();
        return array_values(array_unique(array_map('intval', array_column($rows, 'id'))));
    }
}
