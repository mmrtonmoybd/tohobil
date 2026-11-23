<?php

namespace App\Filters;

use App\Services\Identity;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class AccessGuard implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            return null;
        }

        $identity = new Identity(db_connect());
        $ip = $request->getIPAddress();
        $path = preg_replace('#^index\.php/#', '', trim($request->getUri()->getPath(), '/'));
        $input = $request->getJSON(true) ?: [];
        $phone = isset($input['phone']) ? Identity::phone((string)$input['phone']) : null;
        $deviceUid = $request->getHeaderLine('X-Device-Id') ?: ($input['device_uid'] ?? null);
        $bearer = $request->getHeaderLine('Authorization');
        $user = str_starts_with($bearer, 'Bearer ') ? $identity->userForToken(substr($bearer, 7)) : null;

        if ($user && $user['status'] === 'disabled' && $user['status_until'] && $user['status_until'] <= date('Y-m-d H:i:s')) {
            db_connect()->table('users')->where('id', $user['id'])->update([
                'status' => 'active',
                'status_until' => null,
                'status_reason' => null,
            ]);
            $user['status'] = 'active';
        }

        $registeredDevice = ($user && !empty($user['device_id']))
            ? db_connect()->table('devices')->where('id', $user['device_id'])->get()->getRowArray()
            : null;

        $reason = null;
        $code = null;
        $status = 403;

        if ($block = $identity->ipBlocked($ip)) {
            $code = 'ACCESS_BLOCKED';
            $reason = $block['reason'] ?: 'Access blocked for this IP address';
        } elseif ($block = $identity->blocked('phone', $phone ?: ($user['phone'] ?? null))) {
            $code = 'ACCESS_BLOCKED';
            $reason = $block['reason'] ?: 'This phone number is blocked';
        } elseif ($block = $identity->blocked('device', $deviceUid ?: ($registeredDevice['device_uid'] ?? null))) {
            $code = 'DEVICE_BLOCKED';
            $reason = $block['reason'] ?: 'This device is blocked';
        } elseif ($registeredDevice && $registeredDevice['status'] === 'blocked') {
            $code = 'DEVICE_BLOCKED';
            $reason = $registeredDevice['status_reason'] ?: 'This device is blocked';
        } elseif ($user && $user['status'] === 'blocked') {
            $code = 'ACCOUNT_BLOCKED';
            $reason = $user['status_reason'] ?: 'Your account has been blocked';
        } elseif ($user && $user['status'] === 'disabled') {
            $code = 'ACCOUNT_DISABLED';
            $reason = $user['status_reason'] ?: 'Your account is temporarily disabled';
        } elseif ($identity->config('maintenance') === 'true') {
            $code = 'MAINTENANCE';
            $reason = $identity->config('maintenance_message', 'Tohobil is under maintenance. Please try again soon.');
            $status = 503;
        } else {
            $minimum = $identity->config('min_android_version', '0.0.0');
            $version = $request->getHeaderLine('X-App-Version');
            if ($version && version_compare($version, $minimum, '<')) {
                $code = 'UPDATE_REQUIRED';
                $reason = $identity->config('update_message', 'A required update is available in Google Play.');
                $status = 426;
            }
        }

        if ($code) {
            return service('response')->setStatusCode($status)->setJSON([
                'error' => ['code' => $code, 'message' => $reason ?: $code],
            ]);
        }

        $public = [
            'api/v1/health',
            'api/v1/app/status',
            'api/v1/app/config',
            'api/v1/auth/register',
            'api/v1/auth/login',
            'api/v1/auth/otp/send',
            'api/v1/auth/otp/verify',
            'api/v1/auth/password/reset',
            'api/v1/feedback',
        ];

        if (!in_array($path, $public, true) && !$user) {
            return service('response')->setStatusCode(401)->setJSON([
                'error' => ['code' => 'UNAUTHENTICATED', 'message' => 'Sign in required'],
            ]);
        }

        if ($user) {
            $request->authUser = $user;
            db_connect()->table('auth_tokens')->where('id', $user['token_id'])->update([
                'last_used_at' => date('Y-m-d H:i:s'),
            ]);
        }

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null) {}
}
