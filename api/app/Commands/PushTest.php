<?php

namespace App\Commands;

use App\Services\FcmClient;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class PushTest extends BaseCommand
{
    protected $group       = 'Firebase';
    protected $name        = 'push:test';
    protected $description = 'Send a test push notification to a user device';

    protected $options = [
        '--user'  => 'User ID',
        '--title' => 'Optional title override',
        '--body'  => 'Optional body override',
        '--verify' => 'Verify the private server credential against FCM without sending to a user',
        '--image-url' => 'Optional public HTTPS image URL (HTTP only on debug devices)',
        '--logo-mode' => 'none, app, or custom',
        '--logo-url' => 'Public logo URL when logo-mode is custom',
    ];

    public function run(array $params)
    {
        if (CLI::getOption('verify')) {
            $fcm = new FcmClient();
            if (!$fcm->hasCredentials()) {
                CLI::error('FCM_NOT_CONFIGURED: add the private service-account JSON at writable/firebase/service-account.json');
                return;
            }
            $logoMode = (string)(CLI::getOption('logo-mode') ?: 'none');
            if (!in_array($logoMode, ['none', 'app', 'custom'], true)) {
                CLI::error('INVALID_LOGO_MODE');
                return;
            }
            $result = $fcm->sendToTopic('tohobil_backend_probe_20261123', (string)(CLI::getOption('title') ?: 'Tohobil setup probe'), (string)(CLI::getOption('body') ?: 'Credential verification only'), [
                'type' => 'setup_probe',
                'image_url' => (string)(CLI::getOption('image-url') ?: ''),
                'logo_mode' => $logoMode,
                'logo_url' => (string)(CLI::getOption('logo-url') ?: ''),
                'action_type' => 'open_app',
                'channel' => 'announcements',
            ]);
            CLI::write(($result['ok'] ?? false) ? 'FCM_CREDENTIAL_VERIFIED' : 'FCM_VERIFY_FAILED: ' . ($result['error'] ?? 'unknown'));
            return;
        }
        $userId = $params['user'] ?? CLI::getOption('user') ?? ($params[0] ?? null);
        $title  = $params['title'] ?? CLI::getOption('title') ?? 'Tohobil Test Push';
        $body   = $params['body'] ?? CLI::getOption('body') ?? 'This is a test notification from Tohobil operations.';

        if (!$userId) {
            $userId = CLI::prompt('Enter target User ID', null, 'required|is_natural_no_zero');
        }

        $db = db_connect();
        $user = $db->table('users')->where('id', (int)$userId)->get()->getRowArray();
        if (!$user) {
            CLI::error("User #{$userId} not found.");
            return;
        }

        $devices = $db->table('devices')
            ->where('user_id', (int)$userId)
            ->where('push_token IS NOT NULL')
            ->where('push_token !=', '')
            ->where('status', 'active')
            ->get()
            ->getResultArray();

        if (empty($devices)) {
            CLI::error("User #{$userId} ({$user['name']}) has no registered devices with active push tokens.");
            return;
        }

        CLI::write("Sending test push to User #{$userId} ({$user['name']}) across " . count($devices) . " device(s)...", 'yellow');

        $fcm = new FcmClient($db);
        $tokens = array_column($devices, 'push_token');

        $result = $fcm->sendBatch($tokens, $title, $body, [
            'type'        => 'test_push',
            'user_id'     => (string)$userId,
            'action_type' => 'open_app',
        ]);

        // Record in user's in-app inbox
        if (($result['success'] ?? 0) > 0 && $db->tableExists('inbox_notifications')) {
            $db->table('inbox_notifications')->insert([
                'user_id'    => (int)$userId,
                'type'       => 'system',
                'title'      => $title,
                'body'       => $body,
                'is_read'    => 0,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        }

        CLI::write("Push dispatch completed!", 'green');
        CLI::write("Total tokens: {$result['total']}");
        CLI::write("Successful:   {$result['success']}");
        CLI::write("Failed:       {$result['failed']}");
    }
}
