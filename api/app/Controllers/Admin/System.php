<?php

namespace App\Controllers\Admin;

class System extends AdminApiController
{
    public function health()
    {
        $db = db_connect();

        // Database size in MB
        $dbName = $db->database;
        $dbSizeRow = $db->query(
            "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS db_size_mb
             FROM information_schema.tables
             WHERE table_schema = ?",
            [$dbName]
        )->getRowArray();

        $dbSizeMb = (float)($dbSizeRow['db_size_mb'] ?? 0);

        // Cron runs status
        $cronRuns = $db->table('cron_runs')->orderBy('command_name', 'ASC')->get()->getResultArray();

        $freeBytes = disk_free_space(FCPATH);
        $totalBytes = disk_total_space(FCPATH);
        $pendingJobs = $db->tableExists('push_jobs') ? (int)$db->table('push_jobs')->where('status', 'pending')->countAllResults() : 0;
        $failedJobs = $db->tableExists('push_jobs') ? (int)$db->table('push_jobs')->where('status', 'failed')->countAllResults() : 0;
        $firebase = new \App\Services\FcmClient();

        return $this->ok([
            'php_version'        => PHP_VERSION,
            'codeigniter_version' => \CodeIgniter\CodeIgniter::CI_VERSION,
            'mysql_version'      => $db->getVersion(),
            'database_name'      => $dbName,
            'database_size_mb'   => $dbSizeMb,
            'disk_free_gb'       => $freeBytes !== false ? round($freeBytes / 1024 / 1024 / 1024, 2) : 0,
            'disk_total_gb'      => $totalBytes !== false ? round($totalBytes / 1024 / 1024 / 1024, 2) : 0,
            'cron_jobs'          => $cronRuns,
            'queue'              => [
                'pending' => $pendingJobs,
                'failed'  => $failedJobs,
            ],
            'firebase_configured' => $firebase->hasCredentials(),
            'firebase'           => $firebase->getServiceAccountInfo(),
            'recent_errors'      => $this->recentErrors(),
            'server_time'        => date('Y-m-d H:i:s T'),
        ]);
    }

    public function retryFailed()
    {
        $db = db_connect();
        if (!$db->tableExists('push_jobs')) {
            return $this->ok(['retried' => 0]);
        }
        $db->table('push_jobs')->where('status', 'failed')->update([
            'status' => 'pending',
            'attempts' => 0,
            'available_at' => date('Y-m-d H:i:s'),
            'locked_at' => null,
            'last_error' => null,
        ]);
        $this->audit('push_jobs_retried', 'push_jobs');
        return $this->ok(['status' => 'ok']);
    }

    /** @return list<string> */
    private function recentErrors(): array
    {
        $dir = WRITEPATH . 'logs';
        $files = is_dir($dir) ? glob($dir . '/log-*.log') : [];
        if (!$files) {
            return [];
        }
        rsort($files);
        $lines = @file($files[0], FILE_IGNORE_NEW_LINES);
        if (!$lines) {
            return [];
        }
        $errors = [];
        foreach (array_reverse($lines) as $line) {
            if (!str_contains($line, 'ERROR') && !str_contains($line, 'CRITICAL')) {
                continue;
            }
            $clean = preg_replace('/(private_key|password|token|authorization)[^\\s]*/i', '[redacted]', $line) ?? $line;
            $errors[] = mb_substr($clean, 0, 240);
            if (count($errors) >= 15) {
                break;
            }
        }
        return $errors;
    }
}
