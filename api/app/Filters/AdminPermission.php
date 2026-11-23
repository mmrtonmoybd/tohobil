<?php

namespace App\Filters;

use App\Services\AdminService;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class AdminPermission implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            return null;
        }

        $admin = $request->admin ?? null;
        if (!$admin) {
            return service('response')
                ->setStatusCode(401)
                ->setJSON(['error' => ['code' => 'UNAUTHORIZED', 'message' => 'Admin session required']]);
        }

        $requiredPermission = $arguments[0] ?? null;
        if ($requiredPermission) {
            $adminService = new AdminService();
            if (!$adminService->hasPermission($admin, $requiredPermission)) {
                return service('response')
                    ->setStatusCode(403)
                    ->setJSON(['error' => ['code' => 'FORBIDDEN', 'message' => "Permission '{$requiredPermission}' required"]]);
            }
        }

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return null;
    }
}
