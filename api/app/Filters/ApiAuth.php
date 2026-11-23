<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class ApiAuth implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $header = $request->getHeaderLine('Authorization');
        $token = null;
        if (preg_match('/Bearer\s+(\S+)/i', $header, $matches)) {
            $token = $matches[1];
        }
        if (!$token) {
            $token = $request->getHeaderLine('X-Auth-Token') ?: null;
        }

        if (!$token) {
            return service('response')
                ->setStatusCode(401)
                ->setJSON(['error' => ['code' => 'UNAUTHORIZED', 'message' => 'Authentication token required']]);
        }

        $tokenHash = hash('sha256', $token);
        $db = db_connect();
        $row = $db->table('auth_tokens t')
            ->select('t.id as token_id, t.user_id, t.device_id, t.expires_at, t.revoked_at, u.phone, u.name, u.email, u.status, u.status_reason, u.status_until')
            ->join('users u', 'u.id = t.user_id')
            ->where('t.token_hash', $tokenHash)
            ->get()
            ->getRowArray();

        if (!$row || $row['revoked_at'] || ($row['expires_at'] && $row['expires_at'] < date('Y-m-d H:i:s'))) {
            return service('response')
                ->setStatusCode(401)
                ->setJSON(['error' => ['code' => 'TOKEN_EXPIRED', 'message' => 'Token invalid or expired']]);
        }

        // Attach user and token to incoming request
        $request->authUser = [
            'id'            => (int)$row['user_id'],
            'token_id'      => (int)$row['token_id'],
            'device_id'     => $row['device_id'] ? (int)$row['device_id'] : null,
            'phone'         => $row['phone'],
            'name'          => $row['name'],
            'email'         => $row['email'],
            'status'        => $row['status'],
            'status_reason' => $row['status_reason'],
            'status_until'  => $row['status_until'],
        ];

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return $response;
    }
}
