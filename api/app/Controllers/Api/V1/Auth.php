<?php

namespace App\Controllers\Api\V1;

use App\Services\Identity;

class Auth extends ApiController
{
    public function register()
    {
        $data = $this->input();
        $phone = Identity::phone((string)($data['phone'] ?? ''));
        $name = trim((string)($data['name'] ?? ''));
        $password = (string)($data['password'] ?? '');

        if (!$phone || mb_strlen($name) < 2 || mb_strlen($name) > 120 || strlen($password) < 10 || empty($data['accept_terms'])) {
            return $this->fail('VALIDATION_ERROR', 'Enter a valid phone, full name, and password (10+ characters), then accept terms');
        }

        $db = db_connect();
        if ($db->table('users')->where('phone', $phone)->countAllResults() > 0) {
            return $this->fail('PHONE_IN_USE', 'Phone number is already registered', 409);
        }

        $lang = in_array($data['language'] ?? '', ['en', 'bn'], true) ? $data['language'] : 'en';

        $db->table('users')->insert([
            'phone'         => $phone,
            'name'          => $name,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'language'      => $lang,
            'country'       => substr((string)($data['country'] ?? 'BD'), 0, 2) ?: 'BD',
            'currency'      => preg_match('/^[A-Z]{3}$/', strtoupper((string)($data['currency'] ?? ''))) === 1
                ? strtoupper((string)$data['currency'])
                : 'BDT',
            'created_at'    => date('Y-m-d H:i:s'),
            'updated_at'    => date('Y-m-d H:i:s'),
        ]);

        $id = (int)$db->insertID();
        $this->identity()->audit($id, 'register', $this->request->getIPAddress());

        $user = $db->table('users')->where('id', $id)->get()->getRowArray();
        $token = $this->identity()->issueToken($id);

        return $this->response->setStatusCode(201)->setJSON([
            'user'  => Identity::publicUser($user),
            'token' => $token,
        ]);
    }

    public function login()
    {
        $data = $this->input();
        $phone = Identity::phone((string)($data['phone'] ?? ''));
        $password = $data['password'] ?? null;

        if (!$phone || !is_string($password)) {
            return $this->fail('VALIDATION_ERROR', 'Phone and password required');
        }

        $ip = \App\Services\ClientAddress::ip();
        if ($this->tooMany('login_phone_' . hash('sha256', $phone), 20, 900)
            || $this->tooMany('login_' . hash('sha256', $phone . '|' . $ip), 5, 300)) {
            return $this->fail('RATE_LIMITED', 'Too many attempts. Try again later.', 429);
        }

        $db = db_connect();
        $user = $db->table('users')->where('phone', $phone)->get()->getRowArray();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            $this->identity()->audit($user ? (int)$user['id'] : null, 'login_failed', $this->request->getIPAddress());
            return $this->fail('INVALID_CREDENTIALS', 'Phone or password incorrect', 401);
        }

        if ($user['status'] === 'blocked') {
            return $this->fail('ACCOUNT_BLOCKED', $user['status_reason'] ?: 'Account blocked', 403);
        }

        if ($user['status'] === 'disabled' && (!$user['status_until'] || $user['status_until'] > date('Y-m-d H:i:s'))) {
            return $this->fail('ACCOUNT_DISABLED', $user['status_reason'] ?: 'Account disabled', 403);
        }

        $this->identity()->audit((int)$user['id'], 'login', \App\Services\ClientAddress::ip());
        $token = $this->identity()->issueToken((int)$user['id']);

        $pushService = new \App\Services\PushService(db_connect());
        $pushService->notifySecurityAlert(
            (int)$user['id'],
            'New Sign-in',
            'Your account was accessed from IP ' . \App\Services\ClientAddress::ip()
        );

        return $this->response->setJSON([
            'user'  => Identity::publicUser($user),
            'token' => $token,
        ]);
    }

    public function logout()
    {
        $db = db_connect();
        $user = $this->user();

        $db->table('auth_tokens')->where('id', $user['token_id'])->update([
            'revoked_at' => date('Y-m-d H:i:s'),
        ]);

        if (!empty($user['device_id'])) {
            $db->table('devices')->where('id', $user['device_id'])->update([
                'push_token' => null,
            ]);
        }

        $this->identity()->audit((int)$user['id'], 'logout', $this->request->getIPAddress());

        return $this->response->setJSON(['ok' => true]);
    }

    public function otpSend()
    {
        return $this->smsOff();
    }

    public function otpVerify()
    {
        return $this->smsOff();
    }

    public function passwordReset()
    {
        return $this->smsOff();
    }

    private function smsOff()
    {
        $status = \App\Services\SmsOtp::enabled() ? 503 : 503;

        return $this->fail('SMS_NOT_CONFIGURED', 'Text-message codes are turned off', $status);
    }

    private function tooMany(string $bucket, int $capacity, int $seconds): bool
    {
        return service('throttler')->check($bucket, $capacity, $seconds) === false;
    }

    public function passwordChange()
    {
        $data = $this->input();
        $user = $this->user();
        $oldPassword = (string)($data['old_password'] ?? '');
        $newPassword = (string)($data['new_password'] ?? '');

        if (!password_verify($oldPassword, $user['password_hash']) || strlen($newPassword) < 10) {
            return $this->fail('VALIDATION_ERROR', 'Current password incorrect or new password less than 10 characters');
        }

        $db = db_connect();
        $db->table('users')->where('id', $user['id'])->update([
            'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
            'updated_at'    => date('Y-m-d H:i:s'),
        ]);

        $db->table('auth_tokens')
            ->where('user_id', $user['id'])
            ->where('id !=', $user['token_id'])
            ->update(['revoked_at' => date('Y-m-d H:i:s')]);

        $this->identity()->audit((int)$user['id'], 'password_change', $this->request->getIPAddress());

        return $this->response->setJSON(['ok' => true]);
    }
}
