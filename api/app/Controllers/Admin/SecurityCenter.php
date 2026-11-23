<?php

namespace App\Controllers\Admin;

class SecurityCenter extends AdminApiController
{
    public function index()
    {
        $db = db_connect();
        $since = date('Y-m-d H:i:s', time() - 7 * 86400);
        $failed = $db->table('audit_log')
            ->whereIn('event', ['login_failed', 'admin_2fa_failed'])
            ->where('created_at >=', $since)
            ->orderBy('id', 'DESC')
            ->limit(100)
            ->get()
            ->getResultArray();
        $sessions = $db->table('admin_sessions s')
            ->select('s.id, s.admin_id, a.name, a.email, s.ip, s.created_at, s.last_active_at, s.expires_at')
            ->join('admins a', 'a.id = s.admin_id')
            ->where('s.expires_at >', date('Y-m-d H:i:s'))
            ->orderBy('s.last_active_at', 'DESC')
            ->get()
            ->getResultArray();
        $blocked = $db->table('audit_log')
            ->select('event, COUNT(*) AS hits')
            ->where('created_at >=', $since)
            ->whereIn('event', ['login_failed', 'admin_2fa_failed', 'access_blocked'])
            ->groupBy('event')
            ->get()
            ->getResultArray();
        return $this->ok([
            'failed_logins' => $failed,
            'admin_sessions' => $sessions,
            'blocked_counts' => $blocked,
        ]);
    }

    public function revokeSession($id)
    {
        $db = db_connect();
        $session = $db->table('admin_sessions')->where('id', (int)$id)->get()->getRowArray();
        if (!$session) {
            return $this->fail('NOT_FOUND', 'Session not found', 404);
        }
        if ((int)$session['id'] === (int)($this->admin()['session_id'] ?? 0)) {
            return $this->fail('FORBIDDEN', 'Use log out to end your own session', 403);
        }
        $db->table('admin_sessions')->where('id', (int)$id)->delete();
        $this->audit('admin_session_revoked', 'session:' . (int)$id, ['admin_id' => (int)$session['admin_id']]);
        return $this->ok(['status' => 'ok']);
    }
}
