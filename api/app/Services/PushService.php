<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;

class PushService
{
    protected BaseConnection $db;
    protected FcmClient $fcm;

    public function __construct(?BaseConnection $db = null, ?FcmClient $fcm = null)
    {
        $this->db = $db ?? db_connect();
        $this->fcm = $fcm ?? new FcmClient($this->db);
    }

    /**
     * Send push notification to a user's registered devices
     */
    public function sendToUser(int $userId, string $title, string $body, array $data = []): bool
    {
        $devices = $this->db->table('devices')
            ->where('user_id', $userId)
            ->where('push_token IS NOT NULL')
            ->where('push_token !=', '')
            ->where('status', 'active')
            ->get()
            ->getResultArray();

        if (empty($devices)) {
            return false;
        }

        $sentCount = 0;
        foreach ($devices as $dev) {
            $token = $dev['push_token'];
            if ($this->dispatchFcm($token, $title, $body, $data)) {
                $sentCount++;
            }
        }

        $this->recordPush('user', (string)$userId, $title, $body, $data, $sentCount);
        return $sentCount > 0;
    }

    /**
     * Send push notification to a user identified by phone
     */
    public function sendToPhone(string $phone, string $title, string $body, array $data = []): bool
    {
        $user = $this->db->table('users')->where('phone', $phone)->get()->getRowArray();
        if (!$user) {
            return false;
        }

        return $this->sendToUser((int)$user['id'], $title, $body, $data);
    }

    /**
     * Dispatch notification when invited to a shared book
     */
    public function notifySharedBookInvite(int $inviterUserId, string $inviterName, string $inviteePhone, string $bookName): bool
    {
        $title = 'Shared Book Invitation';
        $body = "{$inviterName} invited you to collaborate on '{$bookName}'.";
        $data = [
            'type'        => 'shared_book_invite',
            'book_name'   => $bookName,
            'inviter_id'  => (string)$inviterUserId,
            'inviter_name'=> $inviterName,
            'action'      => 'tohobil://books',
        ];

        return $this->sendToPhone($inviteePhone, $title, $body, $data);
    }

    /**
     * Dispatch notification on shared book activities (member joined, records edited)
     */
    public function notifySharedBookActivity(string $bookId, int $actorUserId, string $actorName, string $activity): bool
    {
        if (!$this->db->tableExists('book_members')) {
            return false;
        }

        // Notify other members of this book
        $members = $this->db->table('book_members')
            ->where('book_id', $bookId)
            ->where('user_id !=', $actorUserId)
            ->where('deleted_at IS NULL')
            ->get()
            ->getResultArray();

        $title = 'Shared Book Update';
        $body = "{$actorName} {$activity}";
        $data = [
            'type'      => 'shared_book_activity',
            'book_id'   => $bookId,
            'activity'  => $activity,
            'action'    => 'tohobil://home',
        ];

        $dispatched = false;
        foreach ($members as $m) {
            if ($this->sendToUser((int)$m['user_id'], $title, $body, $data)) {
                $dispatched = true;
            }
        }

        return $dispatched;
    }

    /**
     * Dispatch a high-priority security alert (new device login, status changes)
     */
    public function notifySecurityAlert(int $userId, string $event, string $details): bool
    {
        $title = 'Security Alert';
        $body = "Notice: {$event}. {$details}";
        $data = [
            'type'     => 'security_alert',
            'channel'  => 'security',
            'priority' => 'high',
        ];

        return $this->sendToUser($userId, $title, $body, $data);
    }

    /**
     * Low level FCM dispatcher.
     * Uses service-account.json if present, or logs for dev.
     */
    protected function dispatchFcm(string $pushToken, string $title, string $body, array $data = []): bool
    {
        if (empty($pushToken)) {
            return false;
        }

        return ($this->fcm->sendToToken($pushToken, $title, $body, $data)['ok'] ?? false) === true;
    }

    protected function recordPush(string $targetType, string $targetValue, string $title, string $body, array $data, int $sentCount): void
    {
        if ($this->db->tableExists('push_history')) {
            $this->db->table('push_history')->insert([
                'title'        => $title,
                'body'         => $body,
                'target_type'  => $targetType,
                'target_value' => $targetValue,
                'payload'      => json_encode($data),
                'sent_count'   => $sentCount,
                'created_at'   => date('Y-m-d H:i:s'),
            ]);
        }
    }
}
