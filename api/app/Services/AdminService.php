<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;

class AdminService
{
    protected BaseConnection $db;

    public function __construct(?BaseConnection $db = null)
    {
        $this->db = $db ?? db_connect();
    }

    public function login(string $email, string $password, ?string $ip = null, ?string $userAgent = null): ?array
    {
        $admin = $this->db->table('admins')
            ->where('email', strtolower(trim($email)))
            ->get()
            ->getRowArray();

        if (!$admin) {
            return null;
        }

        // Check if locked
        if ($admin['locked_until'] && $admin['locked_until'] > date('Y-m-d H:i:s')) {
            throw new \RuntimeException('ADMIN_LOCKED');
        }

        if ($admin['status'] !== 'active') {
            throw new \RuntimeException('ADMIN_DISABLED');
        }

        if (!password_verify($password, $admin['password_hash'])) {
            $failed = (int)$admin['failed_logins'] + 1;
            $lockedUntil = null;
            if ($failed >= 5) {
                $lockedUntil = date('Y-m-d H:i:s', strtotime('+15 minutes'));
            }
            $this->db->table('admins')->where('id', $admin['id'])->update([
                'failed_logins' => $failed,
                'locked_until'  => $lockedUntil,
            ]);
            return null;
        }

        // A password alone never creates a Super Admin session.
        $this->db->table('admins')->where('id', $admin['id'])->update([
            'failed_logins' => 0,
            'locked_until'  => null,
        ]);

        if ($admin['role'] === 'super_admin' || (int)$admin['is_2fa_enabled'] === 1) {
            $setup = (int)$admin['is_2fa_enabled'] !== 1;
            $secret = (string)($admin['totp_secret'] ?: AdminTotp::generateSecret());
            if (!$admin['totp_secret']) $this->db->table('admins')->where('id', $admin['id'])->update(['totp_secret' => $secret]);
            $challenge = bin2hex(random_bytes(32));
            $this->db->table('admin_login_challenges')->insert([
                'admin_id' => $admin['id'], 'token_hash' => hash('sha256', $challenge),
                'purpose' => $setup ? 'setup' : 'verify',
                'expires_at' => date('Y-m-d H:i:s', time() + 300),
            ]);
            $this->audit((int)$admin['id'], 'admin_2fa_challenge', 'auth', ['setup' => $setup], $ip);
            return [
                'status' => '2fa_required', 'challenge' => $challenge,
                'setup_required' => $setup,
                'setup_secret' => $setup ? $secret : null,
                'provisioning_uri' => $setup ? AdminTotp::provisioningUri($admin['email'], $secret) : null,
            ];
        }

        return $this->issueSession($admin, $ip, $userAgent);
    }

    public function completeTwoFactor(string $challenge, string $code, ?string $ip = null, ?string $userAgent = null): ?array
    {
        $row = $this->db->table('admin_login_challenges')->where('token_hash', hash('sha256', $challenge))
            ->where('expires_at >', date('Y-m-d H:i:s'))->where('attempts <', 5)->get()->getRowArray();
        if (!$row) return null;
        $admin = $this->db->table('admins')->where('id', $row['admin_id'])->where('status', 'active')->get()->getRowArray();
        if (!$admin || !$admin['totp_secret']) return null;
        $step = AdminTotp::verify((string)$admin['totp_secret'], $code, $admin['last_totp_step'] === null ? null : (int)$admin['last_totp_step']);
        if ($step === null) {
            $this->db->table('admin_login_challenges')->where('id', $row['id'])->set('attempts', 'attempts + 1', false)->update();
            $this->audit((int)$admin['id'], 'admin_2fa_failed', 'auth', null, $ip);
            return null;
        }
        $this->db->table('admins')->where('id', $admin['id'])
            ->groupStart()->where('last_totp_step', null)->orWhere('last_totp_step <', $step)->groupEnd()
            ->update(['is_2fa_enabled' => 1, 'last_totp_step' => $step]);
        if ($this->db->affectedRows() !== 1) return null;
        $this->db->table('admin_login_challenges')->where('id', $row['id'])->delete();
        $this->audit((int)$admin['id'], 'admin_2fa_verified', 'auth', null, $ip);
        return $this->issueSession($admin, $ip, $userAgent);
    }

    private function issueSession(array $admin, ?string $ip, ?string $userAgent): array
    {
        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        $csrf = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

        $this->db->table('admins')->where('id', $admin['id'])->update([
            'last_login_at' => date('Y-m-d H:i:s'), 'last_login_ip' => $ip,
        ]);

        $this->db->table('admin_sessions')->insert([
            'admin_id'       => $admin['id'],
            'token_hash'     => $tokenHash,
            'csrf_token'     => $csrf,
            'ip'             => $ip,
            'user_agent'     => substr((string)$userAgent, 0, 255),
            'expires_at'     => $expiresAt,
            'last_active_at' => date('Y-m-d H:i:s'),
            'created_at'     => date('Y-m-d H:i:s'),
        ]);

        $this->audit((int)$admin['id'], 'admin_login', 'auth', ['email' => $admin['email']], $ip);

        $permissions = $this->getPermissionsForRole($admin['role']);

        return [
            'token'       => $token,
            'csrf_token'  => $csrf,
            'expires_at'  => $expiresAt,
            'admin'       => [
                'id'          => (int)$admin['id'],
                'name'        => $admin['name'],
                'email'       => $admin['email'],
                'role'        => $admin['role'],
                'permissions' => $permissions,
            ],
        ];
    }

    public function csrfForToken(string $token): ?string
    {
        $row = $this->db->table('admin_sessions')->select('csrf_token')
            ->where('token_hash', hash('sha256', $token))->get()->getRowArray();
        return $row && $row['csrf_token'] !== '' ? $row['csrf_token'] : null;
    }

    public function adminForToken(string $token): ?array
    {
        $tokenHash = hash('sha256', $token);
        $now = date('Y-m-d H:i:s');

        $session = $this->db->table('admin_sessions')
            ->where('token_hash', $tokenHash)
            ->where('expires_at >', $now)
            ->get()
            ->getRowArray();

        if (!$session) {
            return null;
        }

        if ($session['last_active_at'] < date('Y-m-d H:i:s', time() - 1800)) {
            $this->db->table('admin_sessions')->where('id', $session['id'])->delete();
            return null;
        }

        $admin = $this->db->table('admins')
            ->where('id', $session['admin_id'])
            ->get()
            ->getRowArray();

        if (!$admin || $admin['status'] !== 'active') {
            return null;
        }

        // Update session last active time
        $this->db->table('admin_sessions')
            ->where('id', $session['id'])
            ->update(['last_active_at' => $now]);

        $permissions = $this->getPermissionsForRole($admin['role']);

        return [
            'id'          => (int)$admin['id'],
            'name'        => $admin['name'],
            'email'       => $admin['email'],
            'role'        => $admin['role'],
            'permissions' => $permissions,
            'session_id'  => (int)$session['id'],
        ];
    }

    public function logout(string $token): void
    {
        $tokenHash = hash('sha256', $token);
        $this->db->table('admin_sessions')->where('token_hash', $tokenHash)->delete();
    }

    public function verifyPassword(int $adminId, string $password): bool
    {
        if ($password === '') return false;
        $admin = $this->db->table('admins')->select('password_hash, status')
            ->where('id', $adminId)->get()->getRowArray();
        return $admin && $admin['status'] === 'active'
            && password_verify($password, $admin['password_hash']);
    }

    public function getPermissionsForRole(string $role): array
    {
        if ($role === 'super_admin') {
            return ['*'];
        }

        $row = $this->db->table('admin_roles')->where('slug', $role)->get()->getRowArray();
        if ($row && !empty($row['permissions'])) {
            $perms = json_decode($row['permissions'], true);
            return is_array($perms) ? $perms : [];
        }

        return [];
    }

    public function hasPermission(array $admin, string $permission): bool
    {
        if (($admin['role'] ?? '') === 'super_admin') {
            return true;
        }
        $perms = $admin['permissions'] ?? [];
        if (in_array('*', $perms, true)) {
            return true;
        }
        return in_array($permission, $perms, true);
    }

    public function audit(?int $adminId, string $event, string $target, ?array $details = null, ?string $ip = null): void
    {
        $auditService = new AuditService($this->db);
        $detailStr = $details ? json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : $target;
        $auditService->log($event, $adminId, $detailStr, $ip);
    }
}
