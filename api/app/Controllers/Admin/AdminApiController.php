<?php

namespace App\Controllers\Admin;

use App\Controllers\BaseController;
use App\Services\AdminService;

class AdminApiController extends BaseController
{
    protected ?AdminService $adminService = null;

    protected function service(): AdminService
    {
        if ($this->adminService === null) {
            $this->adminService = new AdminService();
        }
        return $this->adminService;
    }

    protected function admin(): ?array
    {
        return $this->request->admin ?? null;
    }

    protected function ok($data = [], int $status = 200)
    {
        return $this->response->setStatusCode($status)->setJSON($data);
    }

    protected function fail(string $code, string $message, int $status = 400)
    {
        return $this->response->setStatusCode($status)->setJSON([
            'error' => [
                'code'    => $code,
                'message' => $message,
            ],
        ]);
    }

    protected function input(): array
    {
        return $this->request->getJSON(true) ?: ($this->request->getPost() ?: []);
    }

    protected function audit(string $event, string $target, ?array $details = null): void
    {
        $admin = $this->admin();
        $this->service()->audit(
            $admin ? (int)$admin['id'] : null,
            $event,
            $target,
            $details,
            $this->request->getIPAddress()
        );
    }
}
