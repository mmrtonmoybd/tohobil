<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class CronDaily extends BaseCommand
{
    protected $group       = 'Cron';
    protected $name        = 'cron:daily';
    protected $description = 'Run daily server operations: compute daily_stats, perform cleanups, and refresh exchange rates';

    public function run(array $params)
    {
        if (!is_cli()) {
            echo "CLI only\n";
            return;
        }

        $start = microtime(true);
        $db = db_connect();

        $db->table('cron_runs')->replace([
            'command_name'     => 'cron:daily',
            'last_started_at'  => date('Y-m-d H:i:s'),
            'status'           => 'running',
            'duration_ms'      => 0,
            'error_message'    => null,
        ]);

        try {
            CLI::write('[cron:daily] Computing daily_stats...', 'yellow');
            $statsService = new \App\Services\StatsService($db);
            $statsService->computeDailyStats(date('Y-m-d'));

            // 2. Cleanups
            CLI::write('[cron:daily] Performing maintenance cleanups...', 'yellow');

            // Expired OTPs
            if ($db->tableExists('otp_codes')) {
                $db->table('otp_codes')->where('expires_at <', date('Y-m-d H:i:s'))->delete();
            }

            // Expired blocklist entries
            if ($db->tableExists('blocklist')) {
                $db->table('blocklist')->where('expires_at IS NOT NULL AND expires_at <', date('Y-m-d H:i:s'))->delete();
            }

            // Expired admin sessions
            if ($db->tableExists('admin_sessions')) {
                $db->table('admin_sessions')->where('expires_at <', date('Y-m-d H:i:s'))->delete();
            }

            $identity = new \App\Services\Identity($db);
            $purged = $identity->purgeDueDeletions(30);
            CLI::write("[cron:daily] Purged {$purged} accounts past the 30-day deletion grace", 'yellow');
            $this->cleanupOrphanFiles($db);
            $rates = new \App\Services\ExchangeRateService();
            if ($rates->refresh($db)) {
                CLI::write('[cron:daily] Exchange rates stored', 'yellow');
            } else {
                CLI::write('[cron:daily] Exchange-rate refresh skipped; the previous snapshot stays', 'yellow');
            }

            $duration = (int)round((microtime(true) - $start) * 1000);

            $db->table('cron_runs')->replace([
                'command_name'       => 'cron:daily',
                'last_started_at'    => date('Y-m-d H:i:s'),
                'last_completed_at'  => date('Y-m-d H:i:s'),
                'status'             => 'success',
                'duration_ms'        => $duration,
                'error_message'      => null,
            ]);

            CLI::write("[cron:daily] Finished successfully in {$duration}ms", 'green');
        } catch (\Throwable $e) {
            $duration = (int)round((microtime(true) - $start) * 1000);
            $db->table('cron_runs')->replace([
                'command_name'       => 'cron:daily',
                'last_started_at'    => date('Y-m-d H:i:s'),
                'last_completed_at'  => date('Y-m-d H:i:s'),
                'status'             => 'error',
                'duration_ms'        => $duration,
                'error_message'      => $e->getMessage(),
            ]);
            CLI::error("[cron:daily] Error: " . $e->getMessage());
        }
    }

    private function cleanupOrphanFiles($db): void
    {
        if (!$db->tableExists('files')) {
            return;
        }
        $cutoff = date('Y-m-d H:i:s', time() - 7 * 86400);
        $rows = $db->table('files')->select('id, file_path, thumb_path')
            ->where('deleted_at IS NOT NULL', null, false)
            ->where('deleted_at <', $cutoff)
            ->limit(200)
            ->get()->getResultArray();
        foreach ($rows as $row) {
            foreach (['file_path', 'thumb_path'] as $column) {
                $path = (string)($row[$column] ?? '');
                if ($path !== '' && str_starts_with(realpath($path) ?: '', realpath(WRITEPATH) ?: WRITEPATH) && is_file($path)) {
                    @unlink($path);
                }
            }
            $db->table('files')->where('id', $row['id'])->delete();
        }
    }

}
