<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class CronAutomations extends BaseCommand
{
    protected $group       = 'Cron';
    protected $name        = 'cron:automations';
    protected $description = 'Process automations, retention checks and notification triggers';

    public function run(array $params)
    {
        if (!is_cli()) {
            echo "CLI only\n";
            return;
        }

        $start = microtime(true);
        $db = db_connect();

        $db->table('cron_runs')->replace([
            'command_name'     => 'cron:automations',
            'last_started_at'  => date('Y-m-d H:i:s'),
            'status'           => 'running',
            'duration_ms'      => 0,
            'error_message'    => null,
        ]);

        try {
            $queued = (new \App\Services\AutomationService($db))->run();
            CLI::write("[cron:automations] Queued {$queued} automation campaigns", 'yellow');
            $duration = (int)round((microtime(true) - $start) * 1000);

            $db->table('cron_runs')->replace([
                'command_name'       => 'cron:automations',
                'last_started_at'    => date('Y-m-d H:i:s'),
                'last_completed_at'  => date('Y-m-d H:i:s'),
                'status'             => 'success',
                'duration_ms'        => $duration,
                'error_message'      => null,
            ]);

            CLI::write("[cron:automations] Finished in {$duration}ms", 'green');
        } catch (\Throwable $e) {
            $duration = (int)round((microtime(true) - $start) * 1000);
            $db->table('cron_runs')->replace([
                'command_name'       => 'cron:automations',
                'last_started_at'    => date('Y-m-d H:i:s'),
                'last_completed_at'  => date('Y-m-d H:i:s'),
                'status'             => 'error',
                'duration_ms'        => $duration,
                'error_message'      => $e->getMessage(),
            ]);
            CLI::error("[cron:automations] Error: " . $e->getMessage());
        }
    }
}
