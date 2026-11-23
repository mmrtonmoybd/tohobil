<?php

namespace App\Controllers\Admin;

class Auth extends AdminApiController
{
    public function login()
    {
        if (!$this->sameOrigin()) return $this->fail('CSRF_FAILED', 'Cross-origin admin request refused', 403);
        $data = $this->input();
        $email = trim((string)($data['email'] ?? ''));
        $password = (string)($data['password'] ?? '');

        if (!$email || !$password) {
            return $this->fail('VALIDATION_ERROR', 'Email and password are required', 422);
        }

        try {
            $result = $this->service()->login(
                $email,
                $password,
                $this->request->getIPAddress(),
                $this->request->getUserAgent()->getAgentString()
            );

            if (!$result) {
                return $this->fail('INVALID_CREDENTIALS', 'Invalid email or password', 401);
            }

            if (($result['status'] ?? '') === '2fa_required') return $this->ok($result);
            return $this->sessionResponse($result);
        } catch (\RuntimeException $e) {
            if ($e->getMessage() === 'ADMIN_LOCKED') {
                return $this->fail('ADMIN_LOCKED', 'Account temporarily locked due to repeated failed logins. Try again in 15 minutes.', 403);
            }
            if ($e->getMessage() === 'ADMIN_DISABLED') {
                return $this->fail('ADMIN_DISABLED', 'Admin account is disabled', 403);
            }
            return $this->fail('LOGIN_FAILED', $e->getMessage(), 400);
        }
    }

    public function verifyTwoFactor()
    {
        if (!$this->sameOrigin()) return $this->fail('CSRF_FAILED', 'Cross-origin admin request refused', 403);
        $input = $this->input();
        $challenge = (string)($input['challenge'] ?? '');
        $code = (string)($input['code'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/D', $challenge) || !preg_match('/^\d{6}$/D', $code)) {
            return $this->fail('VALIDATION_ERROR', 'Valid challenge and six-digit code required', 422);
        }
        $result = $this->service()->completeTwoFactor($challenge, $code,
            $this->request->getIPAddress(), $this->request->getUserAgent()->getAgentString());
        if (!$result) return $this->fail('INVALID_2FA_CODE', 'Invalid or expired verification code', 401);
        return $this->sessionResponse($result);
    }

    private function sessionResponse(array $result)
    {
        $this->response->setCookie(
                'tohobil_admin_session',
                $result['token'],
                86400,
                '',
                '/',
                '',
                $this->request->isSecure(),
                true,
                'Strict'
            );

        return $this->ok([
                'status'     => 'ok',
                'csrf_token' => $result['csrf_token'],
                'expires_at' => $result['expires_at'],
                'admin'      => $result['admin'],
            ]);
    }

    private function sameOrigin(): bool
    {
        $site = strtolower($this->request->getHeaderLine('Sec-Fetch-Site'));
        if ($site === 'cross-site') return false;
        $origin = $this->request->getHeaderLine('Origin');
        if ($origin === '') return true;
        $originParts = parse_url($origin);
        $requestUrl = $this->request->getUri();
        if (!is_array($originParts) || !isset($originParts['scheme'], $originParts['host'])) return false;
        $originPort = $originParts['port'] ?? ($originParts['scheme'] === 'https' ? 443 : 80);
        $requestPort = $requestUrl->getPort() ?: ($requestUrl->getScheme() === 'https' ? 443 : 80);
        return strtolower($originParts['scheme']) === strtolower($requestUrl->getScheme())
            && strtolower($originParts['host']) === strtolower($requestUrl->getHost())
            && $originPort === $requestPort;
    }

    public function forgot()
    {
        if (!$this->sameOrigin()) return $this->fail('CSRF_FAILED', 'Cross-origin admin request refused', 403);
        $email = strtolower(trim((string)($this->input()['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->fail('VALIDATION_ERROR', 'A valid email is required', 422);
        }
        $db = db_connect();
        $admin = $db->table('admins')->where('email', $email)->get()->getRowArray();
        if ($admin && $db->tableExists('admin_password_resets') && ($admin['status'] ?? 'active') !== 'disabled') {
            $token = bin2hex(random_bytes(32));
            $db->table('admin_password_resets')->insert([
                'admin_id' => (int)$admin['id'],
                'token_hash' => hash('sha256', $token),
                'expires_at' => date('Y-m-d H:i:s', time() + 1800),
            ]);
            try {
                $this->sendResetMail($db, $email, $token);
            } catch (\Throwable $e) {
                log_message('error', 'Admin password reset mail failed');
            }
        }
        return $this->ok(['status' => 'ok', 'message' => 'If that email belongs to an active admin and email is configured, a reset message was sent.']);
    }

    public function resetPassword()
    {
        if (!$this->sameOrigin()) return $this->fail('CSRF_FAILED', 'Cross-origin admin request refused', 403);
        $input = $this->input();
        $token = strtolower(trim((string)($input['token'] ?? '')));
        $password = (string)($input['password'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $token) || strlen($password) < 12) {
            return $this->fail('VALIDATION_ERROR', 'A reset token and a password of at least 12 characters are required', 422);
        }
        $db = db_connect();
        $row = $db->table('admin_password_resets')
            ->where('token_hash', hash('sha256', $token))
            ->where('used_at', null)
            ->where('expires_at >', date('Y-m-d H:i:s'))
            ->orderBy('id', 'DESC')
            ->get()->getRowArray();
        if (!$row) {
            return $this->fail('INVALID_TOKEN', 'That reset link is invalid or expired', 400);
        }
        $db->table('admins')->where('id', (int)$row['admin_id'])->update([
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'failed_logins' => 0,
            'locked_until' => null,
        ]);
        $db->table('admin_password_resets')->where('id', (int)$row['id'])->update(['used_at' => date('Y-m-d H:i:s')]);
        if ($db->tableExists('admin_sessions')) {
            $db->table('admin_sessions')->where('admin_id', (int)$row['admin_id'])->delete();
        }
        $this->service()->audit((int)$row['admin_id'], 'admin_password_reset', 'admin:' . (int)$row['admin_id'], null, $this->request->getIPAddress());
        return $this->ok(['status' => 'ok']);
    }

    public function logoutOthers()
    {
        $admin = $this->admin();
        $db = db_connect();
        $query = $db->table('admin_sessions')->where('admin_id', (int)$admin['id']);
        if (!empty($admin['session_id'])) {
            $query->where('id !=', (int)$admin['session_id']);
        }
        $query->delete();
        $this->audit('admin_other_sessions_revoked', 'admin:' . (int)$admin['id']);
        return $this->ok(['status' => 'ok']);
    }

    private function sendResetMail($db, string $email, string $token): void
    {
        $config = [];
        foreach ($db->table('app_config')->whereIn('config_key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'support_email'])->get()->getResultArray() as $row) {
            $config[$row['config_key']] = $row['config_value'];
        }
        $host = trim((string)($config['smtp_host'] ?? ''));
        if ($host === '') {
            log_message('warning', 'Admin password reset skipped because SMTP is not configured');
            return;
        }
        $mail = \Config\Services::email();
        $mail->initialize([
            'protocol' => 'smtp',
            'SMTPHost' => $host,
            'SMTPUser' => (string)($config['smtp_user'] ?? ''),
            'SMTPPass' => (string)($config['smtp_pass'] ?? ''),
            'SMTPPort' => (int)($config['smtp_port'] ?? 587),
            'mailType' => 'text',
            'charset' => 'utf-8',
        ]);
        $from = (string)($config['smtp_from'] ?? $config['support_email'] ?? 'noreply@localhost');
        $mail->setFrom($from, 'Tohobil');
        $mail->setTo($email);
        $mail->setSubject('Tohobil admin password reset');
        $mail->setMessage("Use this token within 30 minutes on the admin sign-in page:\n\n{$token}\n\nIf you did not ask for this, ignore the message.");
        $mail->send(false);
    }

    public function logout()
    {
        $token = $this->request->adminToken ?? null;
        if ($token) {
            $this->service()->logout($token);
        }
        $this->response->deleteCookie('tohobil_admin_session');
        return $this->ok(['status' => 'logged_out']);
    }

    public function me()
    {
        $admin = $this->admin();
        if (!$admin) {
            return $this->fail('UNAUTHORIZED', 'Not authenticated', 401);
        }
        return $this->ok([
            'status' => 'ok',
            'admin'  => $admin,
            'csrf_token' => $this->service()->csrfForToken((string)$this->request->adminToken),
        ]);
    }
}
