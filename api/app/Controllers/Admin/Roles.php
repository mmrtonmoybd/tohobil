<?php

namespace App\Controllers\Admin;

use App\Services\AdminPermissions;
use App\Services\AdminService;

class Roles extends AdminApiController
{
    public function update(string $slug)
    {
        if ($slug === 'super_admin') return $this->fail('FORBIDDEN', 'Super Admin role cannot be edited', 403);
        $db = db_connect();
        $role = $db->table('admin_roles')->where('slug', $slug)->get()->getRowArray();
        if (!$role) return $this->fail('NOT_FOUND', 'Role not found', 404);
        $input = $this->input();
        if (!(new AdminService($db))->verifyPassword((int)$this->admin()['id'], (string)($input['current_password'] ?? ''))) {
            return $this->fail('REAUTH_REQUIRED', 'Re-enter your password to change permissions', 403);
        }
        $permissions = $input['permissions'] ?? null;
        if (!is_array($permissions) || array_filter($permissions, fn ($p) => !is_string($p) || !in_array($p, AdminPermissions::ALL, true))) {
            return $this->fail('VALIDATION_ERROR', 'Invalid permission list', 422);
        }
        $permissions = array_values(array_unique($permissions));
        $before = json_decode($role['permissions'], true) ?: [];
        $db->table('admin_roles')->where('id', $role['id'])->update(['permissions' => json_encode($permissions)]);
        $this->audit('role_permissions_updated', "role:{$slug}", ['before' => $before, 'after' => $permissions]);
        return $this->ok(['status' => 'ok', 'permissions' => $permissions]);
    }
}
