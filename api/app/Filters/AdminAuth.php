<?php

namespace App\Filters;

use App\Services\AdminService;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class AdminAuth implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            return null;
        }

        $token = $request->getCookie('tohobil_admin_session');

        if (!$token) {
            return service('response')
                ->setStatusCode(401)
                ->setJSON(['error' => ['code' => 'UNAUTHORIZED', 'message' => 'Admin session required']]);
        }

        $adminService = new AdminService();
        $admin = $adminService->adminForToken($token);

        if (!$admin) {
            return service('response')
                ->setStatusCode(401)
                ->setJSON(['error' => ['code' => 'UNAUTHORIZED', 'message' => 'Invalid or expired admin session']]);
        }

        if (!in_array(strtoupper($request->getMethod()), ['GET', 'HEAD', 'OPTIONS'], true)) {
            $csrf = $request->getHeaderLine('X-Admin-CSRF');
            $expected = $adminService->csrfForToken($token);
            if (!$expected || !hash_equals($expected, $csrf)) {
                return service('response')->setStatusCode(403)
                    ->setJSON(['error' => ['code' => 'CSRF_FAILED', 'message' => 'Admin CSRF token required']]);
            }
        }

        // Attach admin to request object
        $request->admin = $admin;
        $request->adminToken = $token;

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return null;
    }
}
