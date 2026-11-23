<?php

namespace App\Controllers\Admin;

use App\Services\AdminService;
use App\Services\AdminPermissions;

class Admins extends AdminApiController
{
    public function index()
    {
        $db = db_connect();
        $admins = $db->table('admins')
            ->select('id, name, email, role, status, is_2fa_enabled, last_login_at, last_login_ip, created_at')
            ->orderBy('id', 'ASC')
            ->get()
            ->getResultArray();

        $roles = $db->table('admin_roles')->get()->getResultArray();
        foreach ($roles as &$r) {
            $r['permissions'] = json_decode($r['permissions'], true) ?: [];
        }

        return $this->ok([
            'admins' => $admins,
            'roles'  => $roles,
            'available_permissions' => AdminPermissions::ALL,
        ]);
    }

    public function store()
    {
        $input = $this->input();
        $name = trim((string)($input['name'] ?? ''));
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');
        $role = trim((string)($input['role'] ?? 'admin'));

        if (!$name || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 12) {
            return $this->fail('VALIDATION_ERROR', 'Name, valid email, and password (min 12 chars) required', 422);
        }

        $db = db_connect();
        if (!(new AdminService($db))->verifyPassword((int)$this->admin()['id'], (string)($input['current_password'] ?? ''))) {
            return $this->fail('REAUTH_REQUIRED', 'Re-enter your password to create an administrator', 403);
        }
        if (!$db->table('admin_roles')->where('slug', $role)->countAllResults()) {
            return $this->fail('VALIDATION_ERROR', 'Unknown admin role', 422);
        }
        $exists = $db->table('admins')->where('email', $email)->get()->getRowArray();
        if ($exists) {
            return $this->fail('CONFLICT', 'Admin with this email already exists', 409);
        }

        $db->table('admins')->insert([
            'name'          => $name,
            'email'         => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role'          => $role,
            'status'        => 'active',
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
        $id = (int)$db->insertID();

        $this->audit('admin_created', "admin:{$id}", ['email' => $email, 'role' => $role]);

        return $this->ok(['status' => 'ok', 'id' => $id, 'message' => 'Admin created successfully']);
    }

    public function update($id)
    {
        $db = db_connect();
        $target = $db->table('admins')->where('id', (int)$id)->get()->getRowArray();
        if (!$target) {
            return $this->fail('NOT_FOUND', 'Admin not found', 404);
        }

        $input = $this->input();
        $update = [];
        if (isset($input['name'])) $update['name'] = trim((string)$input['name']);
        if (isset($input['role'])) {
            $role = trim((string)$input['role']);
            if (!$db->table('admin_roles')->where('slug', $role)->countAllResults()) return $this->fail('VALIDATION_ERROR', 'Unknown admin role', 422);
            if ($role !== $target['role']) {
                if (!(new AdminService($db))->verifyPassword((int)$this->admin()['id'], (string)($input['current_password'] ?? ''))) return $this->fail('REAUTH_REQUIRED', 'Re-enter your password to change roles', 403);
                if ($target['role'] === 'super_admin' && $role !== 'super_admin' && $db->table('admins')->where('role', 'super_admin')->where('status', 'active')->countAllResults() <= 1) return $this->fail('FORBIDDEN', 'Cannot remove the last active Super Admin', 403);
                $update['role'] = $role;
            }
        }
        if (isset($input['status'])) {
            if (!in_array($input['status'], ['active', 'disabled'], true)) return $this->fail('VALIDATION_ERROR', 'Invalid admin status', 422);
            if ((int)$id === (int)$this->admin()['id'] && $input['status'] !== 'active') return $this->fail('FORBIDDEN', 'Cannot disable your own admin account', 403);
            if ($target['role'] === 'super_admin' && $input['status'] !== 'active' && $db->table('admins')->where('role', 'super_admin')->where('status', 'active')->countAllResults() <= 1) return $this->fail('FORBIDDEN', 'Cannot disable the last active Super Admin', 403);
            $update['status'] = $input['status'];
        }
        if (isset($input['password']) && $input['password'] !== '') {
            if (strlen((string)$input['password']) < 12) return $this->fail('VALIDATION_ERROR', 'Password must have at least 12 characters', 422);
            if (!(new AdminService($db))->verifyPassword((int)$this->admin()['id'], (string)($input['current_password'] ?? ''))) return $this->fail('REAUTH_REQUIRED', 'Re-enter your password to reset an administrator password', 403);
            $update['password_hash'] = password_hash($input['password'], PASSWORD_DEFAULT);
        }

        if (!empty($update)) {
            $db->table('admins')->where('id', (int)$id)->update($update);
            if (isset($update['password_hash']) || ($update['status'] ?? null) === 'disabled') $db->table('admin_sessions')->where('admin_id', (int)$id)->delete();
            $audit = $update;
            if (isset($audit['password_hash'])) $audit['password_hash'] = '[changed]';
            $this->audit('admin_updated', "admin:{$id}", $audit);
        }

        return $this->ok(['status' => 'ok', 'message' => 'Admin updated']);
    }

    public function delete($id)
    {
        $current = $this->admin();
        if ((int)$id === (int)$current['id']) {
            return $this->fail('FORBIDDEN', 'Cannot delete your own admin account', 403);
        }

        $db = db_connect();
        $target = $db->table('admins')->where('id', (int)$id)->get()->getRowArray();
        if (!$target) {
            return $this->fail('NOT_FOUND', 'Admin not found', 404);
        }
        $input = $this->input();
        if (!(new AdminService($db))->verifyPassword((int)$current['id'], (string)($input['current_password'] ?? ''))) {
            return $this->fail('REAUTH_REQUIRED', 'Re-enter your password to delete an administrator', 403);
        }

        // Prevent deleting the last Super Admin
        if ($target['role'] === 'super_admin') {
            $superCount = (int)$db->table('admins')->where('role', 'super_admin')->where('status', 'active')->countAllResults();
            if ($superCount <= 1) {
                return $this->fail('FORBIDDEN', 'Cannot delete the last active Super Admin', 403);
            }
        }

        $db->table('admins')->where('id', (int)$id)->delete();
        $this->audit('admin_deleted', "admin:{$id}", ['email' => $target['email']]);

        return $this->ok(['status' => 'ok', 'message' => 'Admin deleted']);
    }
}
