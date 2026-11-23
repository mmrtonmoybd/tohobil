<?php

namespace App\Controllers\Admin;

use App\Services\AuditService;

class Audit extends AdminApiController
{
    public function index()
    {
        $auditService = new AuditService();

        $filters = [
            'search'    => $this->request->getGet('search'),
            'user_id'   => $this->request->getGet('user_id'),
            'event'     => $this->request->getGet('event'),
            'from_date' => $this->request->getGet('from_date'),
            'to_date'   => $this->request->getGet('to_date'),
        ];

        $export = $this->request->getGet('export');
        if ($export === 'csv') {
            if (!$this->service()->hasPermission($this->admin(), 'export.data')) {
                return $this->fail('FORBIDDEN', 'Export permission is required', 403);
            }
            $csv = $auditService->exportCsv($filters);
            return $this->response
                ->setHeader('Content-Type', 'text/csv; charset=UTF-8')
                ->setHeader('Content-Disposition', 'attachment; filename="audit_log_' . date('Ymd_His') . '.csv"')
                ->setBody($csv);
        }

        $page = max(1, (int)$this->request->getGet('page'));
        $perPage = min(100, max(10, (int)$this->request->getGet('per_page') ?: 25));

        $result = $auditService->getLogs($filters, $page, $perPage);

        return $this->ok($result);
    }
}
