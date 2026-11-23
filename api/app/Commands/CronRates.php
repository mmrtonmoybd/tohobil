<?php

namespace App\Commands;

use App\Services\ExchangeRateService;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class CronRates extends BaseCommand
{
    protected $group       = 'Cron';
    protected $name        = 'cron:rates';
    protected $description = 'Fetch every currency once and store the daily snapshot';

    public function run(array $params)
    {
        if (!is_cli()) {
            echo "CLI only\n";
            return;
        }
        $db = db_connect();
        $ok = (new ExchangeRateService())->refresh($db);
        if (!$ok) {
            CLI::write('Exchange-rate refresh skipped; the previous snapshot stays', 'yellow');
            return;
        }
        $snapshot = (new ExchangeRateService())->snapshot($db);
        $count = $snapshot === null ? 0 : count($snapshot['rates']);
        CLI::write("Exchange rates stored ({$count} currencies)", 'green');
    }
}
