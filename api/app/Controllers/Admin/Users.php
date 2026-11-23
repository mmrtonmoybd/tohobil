<?php

namespace App\Controllers\Admin;

use App\Services\AdminService;

class Users extends AdminApiController
{
    public function index()
    {
        $db = db_connect();
        $query = $db->table('users');

        $search = trim((string)$this->request->getGet('search'));
        if ($search !== '') {
            $query->groupStart()
                ->like('name', $search)
                ->orLike('phone', $search)
                ->orLike('email', $search)
                ->orWhere('id', is_numeric($search) ? (int)$search : 0)
                ->groupEnd();
        }

        $status = $this->request->getGet('status');
        if ($status && in_array($status, ['active', 'disabled', 'blocked'], true)) {
            $query->where('status', $status);
        }

        $platform = $this->request->getGet('platform');
        if ($platform && in_array($platform, ['android', 'ios', 'web'], true)) {
            $query->where('platform', $platform);
        }

        $language = (string)$this->request->getGet('language');
        if (in_array($language, ['en', 'bn'], true)) {
            $query->where('language', $language);
        }

        $country = strtoupper(substr(trim((string)$this->request->getGet('country')), 0, 2));
        if (strlen($country) === 2) {
            $query->where('country', $country);
        }

        $version = trim((string)$this->request->getGet('app_version'));
        if ($version !== '') {
            $query->where('app_version', mb_substr($version, 0, 30));
        }

        $signedFrom = strtotime((string)$this->request->getGet('signed_from'));
        if ($signedFrom) {
            $query->where('created_at >=', date('Y-m-d 00:00:00', $signedFrom));
        }
        $signedTo = strtotime((string)$this->request->getGet('signed_to'));
        if ($signedTo) {
            $query->where('created_at <=', date('Y-m-d 23:59:59', $signedTo));
        }

        $activeDays = (int)$this->request->getGet('active_within_days');
        if ($activeDays > 0) {
            $query->where('last_seen_at >=', date('Y-m-d H:i:s', time() - min($activeDays, 3650) * 86400));
        }
        $inactiveDays = (int)$this->request->getGet('inactive_for_days');
        if ($inactiveDays > 0) {
            $query->where('last_seen_at <', date('Y-m-d H:i:s', time() - min($inactiveDays, 3650) * 86400));
        }
        if ((string)$this->request->getGet('has_push') === '1' && $db->tableExists('devices')) {
            $query->where("EXISTS (SELECT 1 FROM devices d WHERE d.user_id = users.id AND d.push_token IS NOT NULL AND d.push_token <> '')", null, false);
        }

        $page = max(1, (int)$this->request->getGet('page'));
        $perPage = min(100, max(10, (int)$this->request->getGet('per_page') ?: 20));

        $total = (clone $query)->countAllResults();
        $users = $query->select('id, name, phone, email, occupation, city, country, language, status, status_reason, status_until, platform, app_version, last_seen_at, last_ip, created_at')
            ->orderBy('id', 'DESC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()
            ->getResultArray();

        return $this->ok([
            'data'       => $users,
            'pagination' => [
                'total'     => $total,
                'page'      => $page,
                'per_page'  => $perPage,
                'last_page' => (int)ceil($total / $perPage),
            ],
        ]);
    }

    public function show($id)
    {
        $db = db_connect();
        $user = $db->table('users')->where('id', (int)$id)->get()->getRowArray();
        if (!$user) {
            return $this->fail('NOT_FOUND', 'User not found', 404);
        }

        $devices = $db->tableExists('devices')
            ? $db->table('devices')->select('id, device_uid, platform, manufacturer, model, os_version, app_version, language, status, last_seen_at, last_ip')->where('user_id', (int)$id)->get()->getResultArray()
            : [];

        $sessionsCount = $db->tableExists('auth_tokens')
            ? (int)$db->table('auth_tokens')->where('user_id', (int)$id)->where('expires_at >', date('Y-m-d H:i:s'))->where('revoked_at', null)->countAllResults()
            : 0;

        $fileCount = 0;
        $storageUsed = 0;
        if ($db->tableExists('files')) {
            $fileCount = (int)$db->table('files')->where('user_id', (int)$id)->where('deleted_at', null)->countAllResults();
            $sRow = $db->table('files')->selectSum('file_size')->where('user_id', (int)$id)->where('deleted_at', null)->get()->getRowArray();
            $storageUsed = (int)($sRow['file_size'] ?? 0);
        }

        $tickets = $db->tableExists('support_tickets')
            ? $db->table('support_tickets')->select('id, subject, status, created_at')->where('user_id', (int)$id)->orderBy('id', 'DESC')->limit(20)->get()->getResultArray()
            : [];

        $auditLogs = $db->tableExists('audit_log')
            ? $db->table('audit_log')->select('id, event, ip, created_at')->where('user_id', (int)$id)->orderBy('id', 'DESC')->limit(15)->get()->getResultArray()
            : [];

        $notes = $db->tableExists('admin_notes')
            ? $db->table('admin_notes n')->select('n.id, n.note, n.created_at, a.name AS admin_name')
                ->join('admins a', 'a.id = n.admin_id', 'left')
                ->where('n.user_id', (int)$id)->orderBy('n.id', 'DESC')->limit(20)->get()->getResultArray()
            : [];

        $history = $db->tableExists('user_status_history')
            ? $db->table('user_status_history')->select('id, status, reason, status_until, created_at')->where('user_id', (int)$id)->orderBy('id', 'DESC')->limit(20)->get()->getResultArray()
            : [];

        $pushes = $db->tableExists('inbox_notifications')
            ? $db->table('inbox_notifications')->select('id, type, title, is_read, created_at')->where('user_id', (int)$id)->orderBy('id', 'DESC')->limit(20)->get()->getResultArray()
            : [];

        $lastSync = null;
        if ($db->tableExists('user_sync_revisions')) {
            $sync = $db->table('user_sync_revisions')->select('updated_at, current_rev')->where('user_id', (int)$id)->get()->getRowArray();
            $lastSync = $sync['updated_at'] ?? null;
        }

        unset($user['password_hash']);

        return $this->ok([
            'user'             => $user,
            'devices'          => $devices,
            'sessions_count'   => $sessionsCount,
            'record_counts'    => [
                'transactions' => $this->countRows($db, 'transactions', (int)$id),
                'debts'        => $this->countRows($db, 'debts', (int)$id),
                'files'        => $fileCount,
                'storage_used' => $storageUsed,
            ],
            'last_sync_at'     => $lastSync,
            'support_tickets'  => $tickets,
            'audit_log'        => $auditLogs,
            'notes'            => $notes,
            'status_history'   => $history,
            'push_history'     => $pushes,
        ]);
    }

    public function update($id)
    {
        $db = db_connect();
        $user = $db->table('users')->where('id', (int)$id)->get()->getRowArray();
        if (!$user) {
            return $this->fail('NOT_FOUND', 'User not found', 404);
        }
        $input = $this->input();
        $update = [];
        foreach (['name' => 120, 'email' => 190, 'occupation' => 120, 'city' => 120] as $field => $max) {
            if (array_key_exists($field, $input)) {
                $update[$field] = mb_substr(trim((string)$input[$field]), 0, $max) ?: null;
            }
        }
        if (isset($update['name']) && $update['name'] === null) {
            return $this->fail('VALIDATION_ERROR', 'Name is required', 422);
        }
        if (isset($update['email']) && $update['email'] !== null && !filter_var($update['email'], FILTER_VALIDATE_EMAIL)) {
            return $this->fail('VALIDATION_ERROR', 'Email is not valid', 422);
        }
        if (isset($input['country'])) {
            $country = strtoupper(substr(trim((string)$input['country']), 0, 2));
            if (strlen($country) !== 2) {
                return $this->fail('VALIDATION_ERROR', 'Country must be a two-letter code', 422);
            }
            $update['country'] = $country;
        }
        if (isset($input['language']) && in_array($input['language'], ['en', 'bn'], true)) {
            $update['language'] = $input['language'];
        }
        if (!$update) {
            return $this->fail('VALIDATION_ERROR', 'Nothing to update', 422);
        }
        $db->table('users')->where('id', (int)$id)->update($update);
        $this->audit('user_updated', "user:{$id}", $update);
        return $this->ok(['status' => 'ok']);
    }

    public function verifyPhone($id)
    {
        $db = db_connect();
        if (!$db->table('users')->where('id', (int)$id)->countAllResults()) {
            return $this->fail('NOT_FOUND', 'User not found', 404);
        }
        if (!$db->fieldExists('phone_verified_at', 'users')) {
            return $this->fail('UNAVAILABLE', 'Run the latest migration before verifying a phone', 503);
        }
        $db->table('users')->where('id', (int)$id)->update(['phone_verified_at' => date('Y-m-d H:i:s')]);
        $this->audit('user_phone_verified', "user:{$id}");
        return $this->ok(['status' => 'ok']);
    }

    public function addNote($id)
    {
        $db = db_connect();
        if (!$db->table('users')->where('id', (int)$id)->countAllResults()) {
            return $this->fail('NOT_FOUND', 'User not found', 404);
        }
        $note = trim((string)($this->input()['note'] ?? ''));
        if ($note === '' || mb_strlen($note) > 500) {
            return $this->fail('VALIDATION_ERROR', 'Note must be 1 to 500 characters', 422);
        }
        $db->table('admin_notes')->insert([
            'user_id' => (int)$id,
            'admin_id' => (int)($this->admin()['id'] ?? 0) ?: null,
            'note' => $note,
        ]);
        $this->audit('user_note_added', "user:{$id}");
        return $this->ok(['id' => (int)$db->insertID()]);
    }

    public function setQuota($id)
    {
        $db = db_connect();
        if (!$db->table('users')->where('id', (int)$id)->countAllResults()) {
            return $this->fail('NOT_FOUND', 'User not found', 404);
        }
        $mb = $this->input()['quota_mb'] ?? null;
        if ($mb === null || $mb === '') {
            $db->table('users')->where('id', (int)$id)->update(['storage_quota_bytes' => null]);
            $this->audit('user_quota_cleared', "user:{$id}");
            return $this->ok(['status' => 'ok']);
        }
        $bytes = (int)$mb * 1024 * 1024;
        if ($bytes < 0 || $bytes > 100 * 1024 * 1024 * 1024) {
            return $this->fail('VALIDATION_ERROR', 'Quota must be between 0 MB and 102400 MB', 422);
        }
        $db->table('users')->where('id', (int)$id)->update(['storage_quota_bytes' => $bytes]);
        $this->audit('user_quota_set', "user:{$id}", ['quota_mb' => (int)$mb]);
        return $this->ok(['status' => 'ok', 'storage_quota_bytes' => $bytes]);
    }

    public function destroy($id)
    {
        $db = db_connect();
        $user = $db->table('users')->where('id', (int)$id)->get()->getRowArray();
        if (!$user) {
            return $this->fail('NOT_FOUND', 'User not found', 404);
        }
        if (!(new AdminService($db))->verifyPassword((int)$this->admin()['id'], (string)($this->input()['current_password'] ?? ''))) {
            return $this->fail('REAUTH_REQUIRED', 'Re-enter your password to delete a user', 403);
        }
        if (!$db->fieldExists('deletion_requested_at', 'users')) {
            return $this->fail('UNAVAILABLE', 'Run the latest migration before scheduling deletion', 503);
        }
        $when = date('Y-m-d H:i:s');
        $db->table('users')->where('id', (int)$id)->update([
            'status' => 'disabled',
            'status_reason' => 'Deletion requested by administrator',
            'deletion_requested_at' => $user['deletion_requested_at'] ?? $when,
        ]);
        if ($db->tableExists('auth_tokens')) {
            $db->table('auth_tokens')->where('user_id', (int)$id)->delete();
        }
        $this->recordStatus((int)$id, 'disabled', 'Deletion requested by administrator', null);
        $this->audit('user_deletion_requested', "user:{$id}");
        return $this->ok(['status' => 'scheduled', 'purge_after_days' => 30]);
    }

    public function disable($id)
    {
        $db = db_connect();
        $user = $db->table('users')->where('id', (int)$id)->get()->getRowArray();
        if (!$user) {
            return $this->fail('NOT_FOUND', 'User not found', 404);
        }

        $input = $this->input();
        $reason = trim((string)($input['reason'] ?? 'Disabled by administrator'));
        $until = !empty($input['until']) ? date('Y-m-d H:i:s', strtotime($input['until'])) : null;

        $db->table('users')->where('id', (int)$id)->update([
            'status'        => 'disabled',
            'status_reason' => $reason,
            'status_until'  => $until,
        ]);

        if ($db->tableExists('auth_tokens')) {
            $db->table('auth_tokens')->where('user_id', (int)$id)->delete();
        }

        $this->recordStatus((int)$id, 'disabled', $reason, $until);
        $this->audit('user_disabled', "user:{$id}", ['reason' => $reason, 'until' => $until]);

        return $this->ok(['status' => 'ok', 'message' => 'User disabled successfully']);
    }

    public function enable($id)
    {
        $db = db_connect();
        $user = $db->table('users')->where('id', (int)$id)->get()->getRowArray();
        if (!$user) {
            return $this->fail('NOT_FOUND', 'User not found', 404);
        }

        $update = [
            'status'        => 'active',
            'status_reason' => null,
            'status_until'  => null,
        ];
        if ($db->fieldExists('deletion_requested_at', 'users')) {
            $update['deletion_requested_at'] = null;
        }
        $db->table('users')->where('id', (int)$id)->update($update);

        $this->recordStatus((int)$id, 'active', null, null);
        $this->audit('user_enabled', "user:{$id}");

        return $this->ok(['status' => 'ok', 'message' => 'User enabled successfully']);
    }

    public function block($id)
    {
        $db = db_connect();
        $user = $db->table('users')->where('id', (int)$id)->get()->getRowArray();
        if (!$user) {
            return $this->fail('NOT_FOUND', 'User not found', 404);
        }

        $input = $this->input();
        $reason = trim((string)($input['reason'] ?? 'Blocked by administrator'));

        $db->table('users')->where('id', (int)$id)->update([
            'status'        => 'blocked',
            'status_reason' => $reason,
            'status_until'  => null,
        ]);

        if (!empty($user['phone']) && $db->tableExists('blocklist')) {
            $db->table('blocklist')->ignore(true)->insert([
                'type'       => 'phone',
                'value'      => $user['phone'],
                'reason'     => $reason,
                'created_by' => $this->admin()['id'] ?? null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        }

        if ($db->tableExists('auth_tokens')) {
            $db->table('auth_tokens')->where('user_id', (int)$id)->delete();
        }

        $this->recordStatus((int)$id, 'blocked', $reason, null);
        $this->audit('user_blocked', "user:{$id}", ['reason' => $reason]);

        return $this->ok(['status' => 'ok', 'message' => 'User permanently blocked']);
    }

    public function unblock($id)
    {
        $db = db_connect();
        $user = $db->table('users')->where('id', (int)$id)->get()->getRowArray();
        if (!$user) {
            return $this->fail('NOT_FOUND', 'User not found', 404);
        }

        $db->table('users')->where('id', (int)$id)->update([
            'status'        => 'active',
            'status_reason' => null,
            'status_until'  => null,
        ]);

        if (!empty($user['phone']) && $db->tableExists('blocklist')) {
            $db->table('blocklist')->where('type', 'phone')->where('value', $user['phone'])->delete();
        }

        $this->recordStatus((int)$id, 'active', 'Unblocked', null);
        $this->audit('user_unblocked', "user:{$id}");

        return $this->ok(['status' => 'ok', 'message' => 'User unblocked successfully']);
    }

    public function revokeSessions($id)
    {
        $db = db_connect();
        if ($db->tableExists('auth_tokens')) {
            $db->table('auth_tokens')->where('user_id', (int)$id)->delete();
        }
        $this->audit('user_sessions_revoked', "user:{$id}");
        return $this->ok(['status' => 'ok', 'message' => 'All active sessions revoked']);
    }

    private function countRows($db, string $table, int $userId): int
    {
        if (!$db->tableExists($table)) {
            return 0;
        }
        $query = $db->table($table)->where('user_id', $userId);
        if ($db->fieldExists('deleted_at', $table)) {
            $query->where('deleted_at', null);
        }
        return (int)$query->countAllResults();
    }

    private function recordStatus(int $userId, string $status, ?string $reason, ?string $until): void
    {
        $db = db_connect();
        if (!$db->tableExists('user_status_history')) {
            return;
        }
        $db->table('user_status_history')->insert([
            'user_id' => $userId,
            'status' => $status,
            'reason' => $reason,
            'status_until' => $until,
            'admin_id' => (int)($this->admin()['id'] ?? 0) ?: null,
        ]);
    }
}
