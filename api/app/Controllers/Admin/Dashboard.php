<?php

namespace App\Controllers\Admin;

class Dashboard extends AdminApiController
{
    public function index()
    {
        $db = db_connect();
        $today = date('Y-m-d');

        // Total users
        $totalUsers = (int)$db->table('users')->countAllResults();
        $newToday = (int)$db->table('users')->where('DATE(created_at)', $today)->countAllResults();
        $new7d = (int)$db->table('users')->where('created_at >=', date('Y-m-d H:i:s', strtotime('-7 days')))->countAllResults();
        $new30d = (int)$db->table('users')->where('created_at >=', date('Y-m-d H:i:s', strtotime('-30 days')))->countAllResults();

        // Active users
        $dau = (int)$db->table('users')->where('last_seen_at >=', date('Y-m-d H:i:s', strtotime('-1 day')))->countAllResults();
        $wau = (int)$db->table('users')->where('last_seen_at >=', date('Y-m-d H:i:s', strtotime('-7 days')))->countAllResults();
        $mau = (int)$db->table('users')->where('last_seen_at >=', date('Y-m-d H:i:s', strtotime('-30 days')))->countAllResults();

        // Disabled and blocked users
        $disabledUsers = (int)$db->table('users')->where('status', 'disabled')->countAllResults();
        $blockedUsers = (int)$db->table('users')->where('status', 'blocked')->countAllResults();

        // Devices
        $totalDevices = $db->tableExists('devices') ? (int)$db->table('devices')->countAllResults() : 0;
        $pushEnabled = $db->tableExists('devices') ? (int)$db->table('devices')->where('push_token IS NOT NULL AND push_token !=', '')->countAllResults() : 0;

        // Files & Storage
        $totalFiles = $db->tableExists('files') ? (int)$db->table('files')->countAllResults() : 0;
        $storageBytes = 0;
        if ($db->tableExists('files')) {
            $row = $db->table('files')->selectSum('file_size')->get()->getRowArray();
            $storageBytes = (int)($row['file_size'] ?? 0);
        }

        // Support Tickets
        $openTickets = $db->tableExists('support_tickets') ? (int)$db->table('support_tickets')->whereIn('status', ['new', 'open'])->countAllResults() : 0;

        // Signups past 14 days chart
        $signupChart = [];
        for ($i = 13; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} days"));
            $cnt = (int)$db->table('users')->where('DATE(created_at)', $d)->countAllResults();
            $signupChart[] = [
                'date'  => $d,
                'count' => $cnt,
            ];
        }

        // Recent signups
        $recentUsers = $db->table('users')
            ->select('id, name, phone, platform, app_version, language, country, status, created_at, last_seen_at')
            ->orderBy('id', 'DESC')
            ->limit(10)
            ->get()
            ->getResultArray();

        // System alerts
        $alerts = [];
        $lastDaily = $db->table('cron_runs')->where('command_name', 'cron:daily')->get()->getRowArray();
        if (!(new \App\Services\FcmClient())->hasCredentials()) {
            $alerts[] = [
                'type' => 'warning',
                'title' => 'Firebase credentials missing',
                'message' => 'Upload the service account JSON in Settings before push delivery can succeed.',
            ];
        }
        $failedJobs = $db->tableExists('push_jobs') ? (int)$db->table('push_jobs')->where('status', 'failed')->countAllResults() : 0;
        if ($failedJobs > 0) {
            $alerts[] = [
                'type' => 'warning',
                'title' => 'Failed push jobs',
                'message' => $failedJobs . ' push jobs failed and can be retried from System health.',
            ];
        }

        if (!$lastDaily || $lastDaily['status'] !== 'success' || strtotime((string)$lastDaily['last_completed_at']) < strtotime('-25 hours')) {
            $alerts[] = [
                'type'    => 'warning',
                'title'   => 'Daily Cron Job Pending',
                'message' => 'The daily stats and maintenance cron job has not run within the past 24 hours.',
            ];
        }

        return $this->ok([
            'kpi' => [
                'users' => [
                    'total'     => $totalUsers,
                    'new_today' => $newToday,
                    'new_7d'    => $new7d,
                    'new_30d'   => $new30d,
                    'dau'       => $dau,
                    'wau'       => $wau,
                    'mau'       => $mau,
                    'disabled'  => $disabledUsers,
                    'blocked'   => $blockedUsers,
                ],
                'devices' => [
                    'total'        => $totalDevices,
                    'push_enabled' => $pushEnabled,
                ],
                'storage' => [
                    'total_files' => $totalFiles,
                    'total_bytes' => $storageBytes,
                ],
                'support' => [
                    'open_tickets' => $openTickets,
                ],
            ],
            'charts' => [
                'signups_14d' => $signupChart,
            ],
            'recent_users' => $recentUsers,
            'alerts'       => $alerts,
        ]);
    }
}
