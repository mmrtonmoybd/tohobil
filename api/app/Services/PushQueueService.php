<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;

/** Durable scheduled campaign dispatch. Cron is the only worker. */
class PushQueueService
{
    public function __construct(private ?BaseConnection $db = null, private ?FcmClient $fcm = null)
    {
        $this->db ??= db_connect();
        $this->fcm ??= new FcmClient($this->db);
    }

    public function dispatchScheduled(int $limit = 10): int
    {
        $now = date('Y-m-d H:i:s');
        $campaigns = $this->db->table('push_campaigns')->where('status', 'scheduled')
            ->where('scheduled_at <=', $now)->orderBy('scheduled_at', 'ASC')
            ->limit($limit)->get()->getResultArray();
        $queued = 0;
        foreach ($campaigns as $campaign) {
            $id = (int)$campaign['id'];
            $this->db->table('push_campaigns')->where('id', $id)->where('status', 'scheduled')
                ->update(['status' => 'sending']);
            if ($this->db->affectedRows() !== 1) continue;
            try {
                $this->db->transBegin();
                $this->queueCampaign($campaign);
                if (!$this->db->transStatus()) throw new \RuntimeException('CAMPAIGN_QUEUE_TRANSACTION_FAILED');
                $this->db->transCommit();
                $queued++;
            } catch (\Throwable $e) {
                $this->db->transRollback();
                $this->db->table('push_campaigns')->where('id', $id)->update(['status' => 'failed']);
                log_message('error', 'Push campaign queue failed: {id} {type}', ['id' => $id, 'type' => get_class($e)]);
            }
        }
        return $queued;
    }

    private function queueCampaign(array $campaign): void
    {
        $id = (int)$campaign['id'];
        $target = (string)$campaign['target'];
        $category = (string)$campaign['category'];
        if ($target === 'all' && in_array($category, ['announcement', 'offer'], true)) {
            $this->db->table('inbox_notifications')->insert($this->inboxRow($campaign, null, 'en'));
            foreach (['en', 'bn'] as $language) {
                $this->addJob($id, 'topic', ['topic' => 'lang_' . $language, 'language' => $language]);
            }
            return;
        }

        $devices = $this->deviceQuery($campaign)->get()->getResultArray();
        $byLanguage = ['en' => [], 'bn' => []];
        $inboxed = [];
        foreach ($devices as $device) {
            $language = $device['language'] === 'bn' ? 'bn' : 'en';
            $byLanguage[$language][] = (int)$device['device_id'];
            $userId = (int)$device['user_id'];
            $this->db->table('push_deliveries')->ignore(true)->insert([
                'campaign_id' => $id, 'user_id' => $userId, 'device_id' => (int)$device['device_id'],
            ]);
            if (!isset($inboxed[$userId])) {
                $this->db->table('inbox_notifications')->insert($this->inboxRow($campaign, $userId, $language));
                $inboxed[$userId] = true;
            }
        }
        foreach ($byLanguage as $language => $ids) {
            foreach (array_chunk($ids, 500) as $chunk) $this->addJob($id, 'devices', ['device_ids' => $chunk, 'language' => $language]);
        }
        if (!$devices) $this->db->table('push_campaigns')->where('id', $id)->update(['status' => 'sent', 'sent_at' => date('Y-m-d H:i:s')]);
    }

    private function inboxRow(array $campaign, ?int $userId, string $language): array
    {
        return [
            'user_id' => $userId, 'campaign_id' => (int)$campaign['id'],
            'type' => $campaign['category'],
            'title' => (string)($language === 'bn' && $campaign['title_bn'] ? $campaign['title_bn'] : $campaign['title_en']),
            'body' => (string)($language === 'bn' && $campaign['body_bn'] ? $campaign['body_bn'] : $campaign['body_en']),
            'image_url' => $campaign['image_url'], 'action_type' => $campaign['action_type'],
            'action_value' => $campaign['action_value'],
        ];
    }

    private function addJob(int $campaignId, string $kind, array $payload): void
    {
        $this->db->table('push_jobs')->insert([
            'campaign_id' => $campaignId, 'kind' => $kind,
            'payload' => json_encode($payload, JSON_THROW_ON_ERROR),
            'status' => 'pending', 'available_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public function processReadyJobs(int $limit = 20): int
    {
        $now = date('Y-m-d H:i:s');
        $stale = date('Y-m-d H:i:s', time() - 600);
        $this->db->table('push_jobs')->where('status', 'processing')->where('locked_at <', $stale)
            ->update(['status' => 'pending', 'locked_at' => null]);
        $jobs = $this->db->table('push_jobs')->where('status', 'pending')->where('available_at <=', $now)
            ->orderBy('id', 'ASC')->limit($limit)->get()->getResultArray();
        $processed = 0;
        foreach ($jobs as $job) {
            $this->db->table('push_jobs')->where('id', $job['id'])->where('status', 'pending')
                ->update(['status' => 'processing', 'locked_at' => $now, 'attempts' => (int)$job['attempts'] + 1]);
            if ($this->db->affectedRows() !== 1) continue;
            $processed++;
            try {
                $result = $this->sendJob($job);
                if ($result['retry']) {
                    $attempts = (int)$job['attempts'] + 1;
                    $terminal = $attempts >= 5;
                    $this->db->table('push_jobs')->where('id', $job['id'])->update([
                        'status' => $terminal ? 'failed' : 'pending',
                        'available_at' => date('Y-m-d H:i:s', time() + min(3600, 60 * (2 ** ($attempts - 1)))),
                        'locked_at' => null, 'last_error' => $result['error'],
                    ]);
                    if ($terminal && $job['kind'] === 'devices') {
                        $payload = json_decode((string)$job['payload'], true) ?: [];
                        $this->db->table('push_deliveries')->where('campaign_id', $job['campaign_id'])
                            ->whereIn('device_id', array_map('intval', (array)($payload['device_ids'] ?? [])))
                            ->where('status', 'retry')->update(['status' => 'failed', 'last_error' => $result['error']]);
                    }
                } else {
                    $this->db->table('push_jobs')->where('id', $job['id'])->update(['status' => 'done', 'locked_at' => null, 'last_error' => null]);
                }
            } catch (\Throwable $e) {
                $this->db->table('push_jobs')->where('id', $job['id'])->update(['status' => 'failed', 'locked_at' => null, 'last_error' => substr(get_class($e), 0, 255)]);
            }
            $this->finishCampaign((int)$job['campaign_id']);
        }
        return $processed;
    }

    private function sendJob(array $job): array
    {
        $campaign = $this->db->table('push_campaigns')->where('id', $job['campaign_id'])->get()->getRowArray();
        if (!$campaign || $campaign['status'] === 'cancelled') return ['retry' => false, 'error' => null];
        $payload = json_decode((string)$job['payload'], true) ?: [];
        $language = ($payload['language'] ?? 'en') === 'bn' ? 'bn' : 'en';
        $title = (string)($language === 'bn' && $campaign['title_bn'] ? $campaign['title_bn'] : $campaign['title_en']);
        $body = (string)($language === 'bn' && $campaign['body_bn'] ? $campaign['body_bn'] : $campaign['body_en']);
        $data = [
            'campaign_id' => (string)$campaign['id'], 'image_url' => (string)($campaign['image_url'] ?? ''),
            'logo_mode' => (string)$campaign['logo_mode'], 'logo_url' => (string)($campaign['logo_url'] ?? ''),
            'action_type' => (string)$campaign['action_type'], 'action_value' => (string)($campaign['action_value'] ?? ''),
            'channel' => $campaign['category'] === 'security' ? 'security' : 'announcements',
        ];
        if ($job['kind'] === 'topic') {
            $result = $this->fcm->sendToTopic((string)$payload['topic'], $title, $body, $data);
            if ($result['ok'] ?? false) {
                $this->db->table('push_campaigns')->where('id', $campaign['id'])->increment('sent_count');
                return ['retry' => false, 'error' => null];
            }
            return ['retry' => true, 'error' => $result['error'] ?? 'FCM_SEND_FAILED'];
        }
        $ids = array_slice(array_map('intval', (array)($payload['device_ids'] ?? [])), 0, 500);
        if (!$ids) return ['retry' => false, 'error' => null];
        $rows = $this->db->table('devices d')->select('d.id, d.push_token, d.user_id')
            ->join('push_deliveries pd', 'pd.device_id = d.id AND pd.campaign_id = ' . (int)$campaign['id'])
            ->join('users u', 'u.id = d.user_id')
            ->whereIn('d.id', $ids)->whereIn('pd.status', ['pending', 'retry'])
            ->where('d.status', 'active')->where('u.status', 'active')
            ->where('d.push_token IS NOT NULL')->where('d.push_token !=', '');
        if (in_array($campaign['category'], ['announcement', 'offer'], true)) $rows->where('u.marketing_push_opt_in', 1);
        $devices = $rows->get()->getResultArray();
        $availableIds = array_map('intval', array_column($devices, 'id'));
        $skippedIds = array_values(array_diff($ids, $availableIds));
        if ($skippedIds) {
            $this->db->table('push_deliveries')->where('campaign_id', $campaign['id'])
                ->whereIn('device_id', $skippedIds)->whereIn('status', ['pending', 'retry'])
                ->update(['status' => 'skipped', 'last_error' => 'TOKEN_OR_PERMISSION_UNAVAILABLE']);
        }
        $tokens = array_values(array_unique(array_column($devices, 'push_token')));
        $results = $this->fcm->sendBatchDetailed($tokens, $title, $body, $data);
        $retry = false;
        foreach ($devices as $device) {
            $outcome = $results[$device['push_token']] ?? ['ok' => false, 'invalid' => false, 'error' => 'FCM_SEND_FAILED'];
            $status = $outcome['ok'] ? 'sent' : ($outcome['invalid'] ? 'invalid' : 'retry');
            $this->db->table('push_deliveries')->where('campaign_id', $campaign['id'])->where('device_id', $device['id'])
                ->set('attempts', 'attempts + 1', false)
                ->update(['status' => $status, 'last_error' => $outcome['error'], 'sent_at' => $outcome['ok'] ? date('Y-m-d H:i:s') : null]);
            if ($outcome['ok']) $this->db->table('push_campaigns')->where('id', $campaign['id'])->increment('sent_count');
            elseif ($outcome['invalid']) $this->db->table('push_campaigns')->where('id', $campaign['id'])->increment('failed_count');
            else $retry = true;
        }
        return ['retry' => $retry, 'error' => $retry ? 'FCM_SEND_FAILED' : null];
    }

    public function enqueue(array $campaign): void
    {
        $this->queueCampaign($campaign);
    }

    /** @return array{mode: string, devices: int, users: int} */
    public function estimateAudience(array $campaign): array
    {
        $target = (string)($campaign['target'] ?? 'all');
        $category = (string)($campaign['category'] ?? 'announcement');
        if ($target === 'all' && in_array($category, ['announcement', 'offer'], true)) {
            return [
                'mode' => 'topic',
                'devices' => $this->deviceQuery($campaign)->countAllResults(),
                'users' => 0,
            ];
        }
        $rows = $this->deviceQuery($campaign)->get()->getResultArray();
        return [
            'mode' => 'devices',
            'devices' => count($rows),
            'users' => count(array_unique(array_map('intval', array_column($rows, 'user_id')))),
        ];
    }

    private function deviceQuery(array $campaign)
    {
        $target = (string)($campaign['target'] ?? 'all');
        $category = (string)($campaign['category'] ?? 'announcement');
        $filters = json_decode((string)($campaign['target_filters'] ?? '{}'), true) ?: [];
        $query = $this->db->table('devices d')->select('d.id AS device_id, d.user_id, u.language')
            ->join('users u', 'u.id = d.user_id')->where('d.status', 'active')
            ->where('u.status', 'active')->where('d.push_token IS NOT NULL')
            ->where('d.push_token !=', '');
        if (in_array($category, ['announcement', 'offer'], true)) {
            $query->where('u.marketing_push_opt_in', 1);
        }
        if ($target === 'user') {
            $query->where('u.id', (int)($filters['user_id'] ?? 0));
        } elseif ($target === 'selected') {
            $ids = array_values(array_filter(array_map('intval', (array)($filters['user_ids'] ?? []))));
            if (!$ids) {
                throw new \InvalidArgumentException('EMPTY_TARGET');
            }
            $query->whereIn('u.id', $ids);
        } elseif ($target === 'segment') {
            foreach (['platform' => 'd.platform', 'language' => 'u.language', 'country' => 'u.country', 'app_version' => 'd.app_version'] as $key => $column) {
                if (!empty($filters[$key])) {
                    $query->where($column, (string)$filters[$key]);
                }
            }
            if (!empty($filters['signup_from'])) {
                $query->where('u.created_at >=', (string)$filters['signup_from'] . ' 00:00:00');
            }
            if (!empty($filters['signup_to'])) {
                $query->where('u.created_at <=', (string)$filters['signup_to'] . ' 23:59:59');
            }
            if (!empty($filters['active_within_days'])) {
                $query->where('u.last_seen_at >=', date('Y-m-d H:i:s', time() - min(3650, (int)$filters['active_within_days']) * 86400));
            }
            if (!empty($filters['inactive_for_days'])) {
                $query->where('u.last_seen_at <', date('Y-m-d H:i:s', time() - min(3650, (int)$filters['inactive_for_days']) * 86400));
            }
            if (!empty($filters['phones'])) {
                $query->whereIn('u.phone', array_slice((array)$filters['phones'], 0, 10000));
            }
        } elseif ($target !== 'all') {
            throw new \InvalidArgumentException('INVALID_TARGET');
        }
        return $query;
    }

    private function finishCampaign(int $id): void
    {
        if ($this->db->table('push_jobs')->where('campaign_id', $id)->whereIn('status', ['pending', 'processing'])->countAllResults() > 0) return;
        $failed = $this->db->table('push_jobs')->where('campaign_id', $id)->where('status', 'failed')->countAllResults();
        $this->db->table('push_campaigns')->where('id', $id)->where('status', 'sending')->update([
            'status' => $failed ? 'failed' : 'sent', 'sent_at' => date('Y-m-d H:i:s'),
        ]);
    }
}
