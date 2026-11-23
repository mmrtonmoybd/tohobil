<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;

class AuditService
{
    protected BaseConnection $db;

    public function __construct(?BaseConnection $db = null)
    {
        $this->db = $db ?? db_connect();
    }

    /**
     * Record an audit event into audit_log
     */
    public function log(string $event, ?int $userId = null, ?string $details = null, ?string $ip = null): int
    {
        if (!$this->db->tableExists('audit_log')) {
            return 0;
        }

        $this->db->table('audit_log')->insert([
            'user_id'    => $userId,
            'event'      => substr($event, 0, 80),
            'ip'         => $ip ? substr($ip, 0, 45) : null,
            'details'    => $details ? substr($details, 0, 255) : null,
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        return (int)$this->db->insertID();
    }

    /**
     * Retrieve paginated and filtered audit logs
     */
    public function getLogs(array $filters = [], int $page = 1, int $perPage = 25): array
    {
        if (!$this->db->tableExists('audit_log')) {
            return [
                'data'       => [],
                'pagination' => [
                    'total'     => 0,
                    'page'      => $page,
                    'per_page'  => $perPage,
                    'last_page' => 1,
                ],
            ];
        }

        $query = $this->buildFilterQuery($filters);
        $total = (clone $query)->countAllResults();

        $page = max(1, $page);
        $perPage = min(100, max(5, $perPage));
        $offset = ($page - 1) * $perPage;

        $logs = $query->orderBy('a.id', 'DESC')
            ->limit($perPage, $offset)
            ->get()
            ->getResultArray();

        return [
            'data'       => $logs,
            'pagination' => [
                'total'     => $total,
                'page'      => $page,
                'per_page'  => $perPage,
                'last_page' => (int)ceil($total / max(1, $perPage)),
            ],
        ];
    }

    /**
     * Export audit logs to CSV string
     */
    public function exportCsv(array $filters = []): string
    {
        if (!$this->db->tableExists('audit_log')) {
            return "ID,User ID,User Name,User Phone,Event,IP,Details,Created At\n";
        }

        $query = $this->buildFilterQuery($filters)->orderBy('a.id', 'DESC')->limit(5000);
        $records = $query->get()->getResultArray();

        $output = fopen('php://temp', 'r+');
        fputcsv($output, ['ID', 'User ID', 'User Name', 'User Phone', 'Event', 'IP', 'Details', 'Created At']);

        foreach ($records as $row) {
            fputcsv($output, [
                $row['id'] ?? '',
                $row['user_id'] ?? '',
                OutputSafety::spreadsheetCell((string)($row['user_name'] ?? '')),
                OutputSafety::spreadsheetCell((string)($row['user_phone'] ?? '')),
                OutputSafety::spreadsheetCell((string)($row['event'] ?? '')),
                OutputSafety::spreadsheetCell((string)($row['ip'] ?? '')),
                OutputSafety::spreadsheetCell((string)($row['details'] ?? '')),
                $row['created_at'] ?? '',
            ]);
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return $csv ?: '';
    }

    /**
     * Purge audit logs older than specified days
     */
    public function purgeOlderThan(int $days = 90): int
    {
        if (!$this->db->tableExists('audit_log')) {
            return 0;
        }

        $cutoff = date('Y-m-d H:i:s', strtotime("-{$days} days"));
        $this->db->table('audit_log')->where('created_at <', $cutoff)->delete();

        return $this->db->affectedRows();
    }

    /**
     * Build base query with filters
     */
    protected function buildFilterQuery(array $filters = [])
    {
        $query = $this->db->table('audit_log a')
            ->select('a.*, u.name as user_name, u.phone as user_phone')
            ->join('users u', 'u.id = a.user_id', 'left');

        if (!empty($filters['search'])) {
            $search = trim((string)$filters['search']);
            $query->groupStart()
                ->like('a.event', $search)
                ->orLike('a.details', $search)
                ->orLike('a.ip', $search)
                ->orLike('u.name', $search)
                ->orLike('u.phone', $search)
                ->groupEnd();
        }

        if (!empty($filters['user_id'])) {
            $query->where('a.user_id', (int)$filters['user_id']);
        }

        if (!empty($filters['event'])) {
            $query->where('a.event', (string)$filters['event']);
        }

        if (!empty($filters['from_date'])) {
            $query->where('a.created_at >=', $filters['from_date'] . ' 00:00:00');
        }

        if (!empty($filters['to_date'])) {
            $query->where('a.created_at <=', $filters['to_date'] . ' 23:59:59');
        }

        return $query;
    }
}
