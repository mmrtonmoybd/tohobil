<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Services\PushQueueService;

class CronMinute extends BaseCommand
{
    protected $group       = 'Cron';
    protected $name        = 'cron:minute';
    protected $description = 'Process queued tasks and scheduled push batches';

    public function run(array $params)
    {
        if (!is_cli()) {
            echo "CLI only\n";
            return;
        }

        $start = microtime(true);
        $db = db_connect();

        $db->table('cron_runs')->replace([
            'command_name'     => 'cron:minute',
            'last_started_at'  => date('Y-m-d H:i:s'),
            'status'           => 'running',
            'duration_ms'      => 0,
            'error_message'    => null,
        ]);

        try {
            $pushQueue = new PushQueueService($db);
            $scheduled = $pushQueue->dispatchScheduled();
            $processed = $pushQueue->processReadyJobs();
            $duration = (int)round((microtime(true) - $start) * 1000);

            $db->table('cron_runs')->replace([
                'command_name'       => 'cron:minute',
                'last_started_at'    => date('Y-m-d H:i:s'),
                'last_completed_at'  => date('Y-m-d H:i:s'),
                'status'             => 'success',
                'duration_ms'        => $duration,
                'error_message'      => null,
            ]);

            CLI::write("[cron:minute] Queued {$scheduled} campaign(s), processed {$processed} job(s) in {$duration}ms", 'green');
        } catch (\Throwable $e) {
            $duration = (int)round((microtime(true) - $start) * 1000);
            $db->table('cron_runs')->replace([
                'command_name'       => 'cron:minute',
                'last_started_at'    => date('Y-m-d H:i:s'),
                'last_completed_at'  => date('Y-m-d H:i:s'),
                'status'             => 'error',
                'duration_ms'        => $duration,
                'error_message'      => $e->getMessage(),
            ]);
            CLI::error("[cron:minute] Error: " . $e->getMessage());
        }
    }
}
