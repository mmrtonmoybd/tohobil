<?php

namespace App\Controllers\Api\V1;

class AppStatus extends ApiController
{
    public function index()
    {
        $identity = $this->identity();
        $user = $this->request->authUser ?? null;
        $deviceUid = $this->request->getHeaderLine('X-Device-Id');

        if ($user) {
            db_connect()->table('users')->where('id', $user['id'])->update([
                'last_seen_at' => date('Y-m-d H:i:s'),
                'last_ip'      => $this->request->getIPAddress(),
                'app_version'  => $this->request->getHeaderLine('X-App-Version') ?: null,
            ]);
        }

        $deviceBlocked = false;
        if ($deviceUid && $identity->blocked('device', $deviceUid)) {
            $deviceBlocked = true;
        }

        $maintenance = ($identity->config('maintenance') === 'true');

        $announcements = [];
        $db = db_connect();
        if ($db->tableExists('announcements')) {
            $now = date('Y-m-d H:i:s');
            $rows = $db->table('announcements')
                ->where('is_active', 1)
                ->groupStart()
                    ->where('starts_at IS NULL')
                    ->orWhere('starts_at <=', $now)
                ->groupEnd()
                ->groupStart()
                    ->where('ends_at IS NULL')
                    ->orWhere('ends_at >=', $now)
                ->groupEnd()
                ->orderBy('id', 'DESC')
                ->limit(5)
                ->get()
                ->getResultArray();
            foreach ($rows as $r) {
                $announcements[] = [
                    'id'          => (int)$r['id'],
                    'title'       => $r['title'],
                    'body'        => $r['body'],
                    'image_url'   => $r['image_url'],
                    'action_url'  => $r['action_url'],
                    'dismissible' => (bool)$r['dismissible'],
                ];
            }
        }

        return $this->response->setJSON([
            'status'         => 'ok',
            'user_status'    => $user['status'] ?? null,
            'device_status'  => $deviceBlocked ? 'blocked' : 'active',
            'maintenance'    => $maintenance,
            'maintenance_message' => $maintenance ? $identity->config('maintenance_message') : null,
            'min_version'    => $identity->config('min_android_version', '0.0.0'),
            'latest_version' => $identity->config('latest_android_version', '0.1.0'),
            'feature_flags'  => json_decode($identity->config('feature_flags', '{}'), true) ?: new \stdClass(),
            'support_email'  => $identity->config('support_email', 'support@tohobil.app'),
            'play_store_url' => $identity->config('play_store_url', 'https://play.google.com/store/apps/details?id=com.tohobil.app'),
            'announcements'  => $announcements,
        ]);
    }

    public function feedback()
    {
        $data = $this->input();
        $message = trim((string)($data['message'] ?? ''));
        $subject = trim((string)($data['subject'] ?? 'App feedback'));
        $user = $this->request->authUser ?? null;

        if (mb_strlen($message) < 3) {
            return $this->fail('VALIDATION_ERROR', 'Message must be at least 3 characters');
        }

        $db = db_connect();
        $hasSupportTable = $db->tableExists('support_tickets');
        if ($hasSupportTable) {
            $db->table('support_tickets')->insert([
                'user_id'    => $user['id'] ?? null,
                'name'       => $user['name'] ?? trim((string)($data['name'] ?? '')),
                'email'      => $user['email'] ?? trim((string)($data['email'] ?? '')),
                'phone'      => $user['phone'] ?? trim((string)($data['phone'] ?? '')),
                'subject'    => substr($subject, 0, 150),
                'message'    => $message,
                'status'     => 'new',
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        }

        $this->identity()->audit($user ? (int)$user['id'] : null, 'feedback_sent', $this->request->getIPAddress(), substr($message, 0, 100));

        return $this->response->setJSON(['ok' => true]);
    }
}
