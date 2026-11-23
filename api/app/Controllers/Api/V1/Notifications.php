<?php

namespace App\Controllers\Api\V1;

class Notifications extends ApiController
{
    public function index()
    {
        $user = $this->request->authUser ?? null;
        $userId = $user['id'] ?? null;
        $db = db_connect();

        $page = max(1, (int)$this->request->getGet('page'));
        $perPage = min(50, max(10, (int)$this->request->getGet('per_page') ?: 20));

        $query = $db->table('inbox_notifications n')
            ->select('n.*, pc.title_bn AS campaign_title_bn, pc.body_bn AS campaign_body_bn, CASE WHEN n.user_id IS NULL THEN COALESCE(nus.is_read, 0) ELSE n.is_read END AS effective_read', false)
            ->join('notification_user_state nus', 'nus.notification_id = n.id AND nus.user_id = ' . (int)$userId, 'left')
            ->join('push_campaigns pc', 'pc.id = n.campaign_id', 'left')
            ->where('n.deleted_at IS NULL')
            ->where('nus.deleted_at IS NULL')
            ->groupStart()
                ->where('n.user_id', $userId)
                ->orWhere('n.user_id IS NULL')
            ->groupEnd();
        if (empty($user['marketing_push_opt_in'])) {
            $query->groupStart()->where('n.user_id IS NOT NULL')
                ->orWhere('pc.id IS NULL')->orWhereNotIn('pc.category', ['announcement', 'offer'])
                ->groupEnd();
        }

        $total = (clone $query)->countAllResults();
        $unreadCount = (clone $query)
            ->where('CASE WHEN n.user_id IS NULL THEN COALESCE(nus.is_read, 0) ELSE n.is_read END = 0', null, false)
            ->countAllResults();

        $notifications = $query->orderBy('n.id', 'DESC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()
            ->getResultArray();
        foreach ($notifications as &$notification) {
            $notification['is_read'] = (int)$notification['effective_read'];
            if ($notification['user_id'] === null && ($user['language'] ?? 'en') === 'bn') {
                $notification['title'] = $notification['campaign_title_bn'] ?: $notification['title'];
                $notification['body'] = $notification['campaign_body_bn'] ?: $notification['body'];
            }
            unset($notification['effective_read'], $notification['campaign_title_bn'], $notification['campaign_body_bn']);
        }
        unset($notification);

        return $this->ok([
            'unread_count' => $unreadCount,
            'data'         => $notifications,
            'support'      => [],
            'pagination'   => [
                'total'     => $total,
                'page'      => $page,
                'per_page'  => $perPage,
                'last_page' => (int)ceil($total / max(1, $perPage)),
            ],
        ]);
    }

    public function markRead()
    {
        $user = $this->request->authUser ?? null;
        $userId = $user['id'] ?? null;
        $data = $this->input();
        $db = db_connect();

        $all = !empty($data['all']);
        $id = $data['id'] ?? null;

        if ($all) {
            $db->table('inbox_notifications')
                ->where('deleted_at IS NULL')
                ->where('user_id', $userId)
                ->update([
                    'is_read' => 1,
                    'read_at' => date('Y-m-d H:i:s'),
                ]);
            $broadcasts = $db->table('inbox_notifications')->select('id')
                ->where('user_id IS NULL')->where('deleted_at IS NULL')->get()->getResultArray();
            foreach ($broadcasts as $broadcast) {
                $this->setBroadcastState((int)$userId, (int)$broadcast['id'], ['is_read' => 1, 'read_at' => date('Y-m-d H:i:s')]);
            }
        } elseif ($id) {
            $notification = $db->table('inbox_notifications')->where('id', (int)$id)->where('deleted_at IS NULL')->get()->getRowArray();
            if (!$notification || ($notification['user_id'] !== null && (int)$notification['user_id'] !== (int)$userId)) {
                return $this->fail('NOT_FOUND', 'Notification not found', 404);
            }
            if ($notification['user_id'] === null) {
                $this->setBroadcastState((int)$userId, (int)$id, ['is_read' => 1, 'read_at' => date('Y-m-d H:i:s')]);
            } else {
                $db->table('inbox_notifications')->where('id', (int)$id)->where('user_id', $userId)
                    ->update(['is_read' => 1, 'read_at' => date('Y-m-d H:i:s')]);
            }
        }

        return $this->ok(['success' => true]);
    }

    public function delete($id = null)
    {
        if (!$id) {
            return $this->fail('VALIDATION_ERROR', 'Notification ID is required', 422);
        }

        $user = $this->request->authUser ?? null;
        $userId = $user['id'] ?? null;
        $db = db_connect();

        $notification = $db->table('inbox_notifications')->where('id', (int)$id)->where('deleted_at IS NULL')->get()->getRowArray();
        if (!$notification || ($notification['user_id'] !== null && (int)$notification['user_id'] !== (int)$userId)) {
            return $this->fail('NOT_FOUND', 'Notification not found', 404);
        }
        if ($notification['user_id'] === null) {
            $this->setBroadcastState((int)$userId, (int)$id, ['deleted_at' => date('Y-m-d H:i:s')]);
        } else {
            $db->table('inbox_notifications')->where('id', (int)$id)->where('user_id', $userId)
                ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        }

        return $this->ok(['success' => true]);
    }

    private function setBroadcastState(int $userId, int $notificationId, array $changes): void
    {
        $table = db_connect()->table('notification_user_state');
        $existing = $table->where('user_id', $userId)->where('notification_id', $notificationId)->get()->getRowArray();
        if ($existing) {
            $table->where('user_id', $userId)->where('notification_id', $notificationId)->update($changes);
        } else {
            $table->insert(['user_id' => $userId, 'notification_id' => $notificationId] + $changes);
        }
    }

    public function opened()
    {
        $user = $this->request->authUser ?? null;
        $data = $this->input();
        $campaignId = !empty($data['campaign_id']) ? (int)$data['campaign_id'] : null;

        $db = db_connect();
        if ($campaignId && $db->tableExists('push_campaigns')) {
            $db->table('push_campaigns')
                ->where('id', $campaignId)
                ->increment('opened_count');
        }

        if ($db->tableExists('push_events')) {
            $db->table('push_events')->insert([
                'campaign_id' => $campaignId,
                'user_id'     => $user['id'] ?? null,
                'device_id'   => $user['device_id'] ?? null,
                'opened_at'   => date('Y-m-d H:i:s'),
            ]);
        }

        return $this->ok(['tracked' => true]);
    }
}
