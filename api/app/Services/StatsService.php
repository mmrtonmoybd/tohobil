<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;

class StatsService
{
    protected BaseConnection $db;

    public function __construct(?BaseConnection $db = null)
    {
        $this->db = $db ?? db_connect();
    }

    /**
     * Computes daily snapshot of all KPIs and persists into daily_stats table
     */
    public function computeDailyStats(?string $date = null): array
    {
        $targetDate = $date ?? date('Y-m-d');
        $now = date('Y-m-d H:i:s');
        $oneDayAgo = date('Y-m-d H:i:s', strtotime('-1 day'));
        $sevenDaysAgo = date('Y-m-d H:i:s', strtotime('-7 days'));
        $thirtyDaysAgo = date('Y-m-d H:i:s', strtotime('-30 days'));

        // Users stats
        $totalUsers = $this->db->table('users')->countAllResults();
        $newUsers = $this->db->table('users')->where('DATE(created_at)', $targetDate)->countAllResults();
        $dau = $this->db->table('users')->where('last_seen_at >=', $oneDayAgo)->countAllResults();
        $wau = $this->db->table('users')->where('last_seen_at >=', $sevenDaysAgo)->countAllResults();
        $mau = $this->db->table('users')->where('last_seen_at >=', $thirtyDaysAgo)->countAllResults();

        // Devices
        $totalDevices = $this->db->tableExists('devices') ? $this->db->table('devices')->countAllResults() : 0;
        $pushEnabled = $this->db->tableExists('devices')
            ? $this->db->table('devices')
                ->where('push_token IS NOT NULL')
                ->where('push_token !=', '')
                ->where('status', 'active')
                ->countAllResults()
            : 0;

        // Platform breakdown
        $platforms = [];
        if ($this->db->tableExists('devices')) {
            $pRows = $this->db->table('devices')->select('platform, COUNT(*) as cnt')->groupBy('platform')->get()->getResultArray();
            foreach ($pRows as $r) {
                $platforms[$r['platform']] = (int)$r['cnt'];
            }
        }

        // Language breakdown
        $languages = [];
        $lRows = $this->db->table('users')->select('language, COUNT(*) as cnt')->groupBy('language')->get()->getResultArray();
        foreach ($lRows as $r) {
            $languages[$r['language'] ?: 'en'] = (int)$r['cnt'];
        }

        // Files & storage
        $totalFiles = 0;
        $totalBytes = 0;
        $uploadsToday = 0;
        if ($this->db->tableExists('files')) {
            $totalFiles = $this->db->table('files')->where('deleted_at IS NULL')->countAllResults();
            $bytesRow = $this->db->table('files')->selectSum('file_size')->where('deleted_at IS NULL')->get()->getRowArray();
            $totalBytes = (int)($bytesRow['file_size'] ?? 0);
            $uploadsToday = $this->db->table('files')->where('DATE(created_at)', $targetDate)->countAllResults();
        }

        // Messaging stats
        $pushSent = 0;
        $pushOpened = 0;
        if ($this->db->tableExists('push_history')) {
            $sentRow = $this->db->table('push_history')->selectSum('sent_count')->where('DATE(created_at)', $targetDate)->get()->getRowArray();
            $pushSent = (int)($sentRow['sent_count'] ?? 0);
            $openRow = $this->db->table('push_history')->selectSum('opened_count')->where('DATE(created_at)', $targetDate)->get()->getRowArray();
            $pushOpened = (int)($openRow['opened_count'] ?? 0);
        }

        $metaData = json_encode([
            'push_devices'  => $pushEnabled,
            'uploads_count' => $uploadsToday,
            'platforms'     => $platforms,
            'languages'     => $languages,
        ]);

        $stats = [
            'date'                => $targetDate,
            'total_users'         => $totalUsers,
            'new_users'           => $newUsers,
            'active_users_dau'    => $dau,
            'active_users_wau'    => $wau,
            'active_users_mau'    => $mau,
            'total_devices'       => $totalDevices,
            'total_files'         => $totalFiles,
            'total_storage_bytes' => $totalBytes,
            'push_sent'           => $pushSent,
            'push_opened'         => $pushOpened,
            'data'                => $metaData,
            'computed_at'         => $now,
        ];

        if ($this->db->tableExists('daily_stats')) {
            $this->db->table('daily_stats')->replace($stats);
        }

        return $stats;
    }

    /**
     * Retrieves recent daily metrics for charts
     */
    public function getRecentStats(int $days = 14): array
    {
        if (!$this->db->tableExists('daily_stats')) {
            return [];
        }

        return $this->db->table('daily_stats')
            ->orderBy('date', 'DESC')
            ->limit($days)
            ->get()
            ->getResultArray();
    }
}
