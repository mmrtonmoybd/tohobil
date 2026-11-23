<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class Permission implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $admin = $request->admin ?? null;
        if (!$admin) {
            return service('response')
                ->setStatusCode(401)
                ->setJSON(['error' => ['code' => 'UNAUTHORIZED', 'message' => 'Admin authentication required']]);
        }

        // Super Admin has unrestricted permissions
        if (($admin['role'] ?? '') === 'super_admin') {
            return null;
        }

        $requiredPermission = $arguments[0] ?? null;
        if (!$requiredPermission) {
            return null;
        }

        $permissions = $admin['permissions'] ?? [];
        if (!in_array($requiredPermission, $permissions, true)) {
            return service('response')
                ->setStatusCode(403)
                ->setJSON([
                    'error' => [
                        'code'    => 'FORBIDDEN',
                        'message' => 'You do not have permission: ' . $requiredPermission,
                    ]
                ]);
        }

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return $response;
    }
}
