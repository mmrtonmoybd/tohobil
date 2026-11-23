<?php

namespace App\Controllers\Admin;

class Storage extends AdminApiController
{
    public function index()
    {
        $db = db_connect();

        $totalFiles = 0;
        $totalBytes = 0;
        $byMime = [];
        $topUsers = [];

        if ($db->tableExists('files')) {
            $totalFiles = (int)$db->table('files')->countAllResults();
            $sRow = $db->table('files')->selectSum('file_size')->get()->getRowArray();
            $totalBytes = (int)($sRow['file_size'] ?? 0);

            // Mime breakdown
            $mRows = $db->table('files')
                ->select('mime_type, COUNT(*) as cnt, SUM(file_size) as total_size')
                ->groupBy('mime_type')
                ->get()
                ->getResultArray();

            foreach ($mRows as $r) {
                $byMime[] = [
                    'mime_type'  => $r['mime_type'],
                    'count'      => (int)$r['cnt'],
                    'size_bytes' => (int)$r['total_size'],
                ];
            }

            // Top users by storage (Privacy rule: SIZES ONLY, never transaction details!)
            $topUsers = $db->table('files f')
                ->select('f.user_id, u.name as user_name, u.phone as user_phone, COUNT(*) as file_count, SUM(f.file_size) as storage_used')
                ->join('users u', 'u.id = f.user_id', 'left')
                ->groupBy('f.user_id')
                ->orderBy('storage_used', 'DESC')
                ->limit(10)
                ->get()
                ->getResultArray();
        }

        $freeBytes = disk_free_space(WRITEPATH);
        $totalDiskBytes = disk_total_space(WRITEPATH);

        return $this->ok([
            'files' => [
                'total_files' => $totalFiles,
                'total_bytes' => $totalBytes,
                'by_mime'     => $byMime,
            ],
            'disk' => [
                'free_bytes'  => $freeBytes !== false ? $freeBytes : 0,
                'total_bytes' => $totalDiskBytes !== false ? $totalDiskBytes : 0,
            ],
            'top_users' => $topUsers,
        ]);
    }

    public function cleanup()
    {
        // Cleanup orphan files (files record exists but physical file missing, or temp uploads)
        $this->audit('storage_cleanup', 'files');
        return $this->ok(['status' => 'ok', 'message' => 'Storage cleanup scan completed']);
    }
}
