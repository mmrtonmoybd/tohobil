<?php

namespace App\Controllers\Admin;

class Devices extends AdminApiController
{
    public function index()
    {
        $db = db_connect();
        $query = $db->table('devices d')
            ->select('d.*, u.name as user_name, u.phone as user_phone')
            ->join('users u', 'u.id = d.user_id', 'left');

        $search = trim((string)$this->request->getGet('search'));
        if ($search !== '') {
            $query->groupStart()
                ->like('d.model', $search)
                ->orLike('d.manufacturer', $search)
                ->orLike('d.device_uid', $search)
                ->orLike('u.name', $search)
                ->orLike('u.phone', $search)
                ->groupEnd();
        }

        $status = $this->request->getGet('status');
        if ($status && in_array($status, ['active', 'blocked'], true)) {
            $query->where('d.status', $status);
        }

        $page = max(1, (int)$this->request->getGet('page'));
        $perPage = min(100, max(10, (int)$this->request->getGet('per_page') ?: 20));

        $total = (clone $query)->countAllResults();
        $devices = $query->orderBy('d.last_seen_at', 'DESC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()
            ->getResultArray();

        return $this->ok([
            'data'       => $devices,
            'pagination' => [
                'total'     => $total,
                'page'      => $page,
                'per_page'  => $perPage,
                'last_page' => (int)ceil($total / $perPage),
            ],
        ]);
    }

    public function block($id)
    {
        $db = db_connect();
        $device = $db->table('devices')->where('id', (int)$id)->get()->getRowArray();
        if (!$device) {
            return $this->fail('NOT_FOUND', 'Device not found', 404);
        }

        $input = $this->input();
        $reason = trim((string)($input['reason'] ?? 'Device blocked by administrator'));

        $db->table('devices')->where('id', (int)$id)->update([
            'status'        => 'blocked',
            'status_reason' => $reason,
        ]);

        if (!empty($device['device_uid']) && $db->tableExists('blocklist')) {
            $db->table('blocklist')->ignore(true)->insert([
                'type'       => 'device',
                'value'      => $device['device_uid'],
                'reason'     => $reason,
                'created_by' => $this->admin()['id'] ?? null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        }

        $this->audit('device_blocked', "device:{$id}", ['device_uid' => $device['device_uid'], 'reason' => $reason]);

        return $this->ok(['status' => 'ok', 'message' => 'Device blocked successfully']);
    }

    public function unblock($id)
    {
        $db = db_connect();
        $device = $db->table('devices')->where('id', (int)$id)->get()->getRowArray();
        if (!$device) {
            return $this->fail('NOT_FOUND', 'Device not found', 404);
        }

        $db->table('devices')->where('id', (int)$id)->update([
            'status'        => 'active',
            'status_reason' => null,
        ]);

        if (!empty($device['device_uid']) && $db->tableExists('blocklist')) {
            $db->table('blocklist')->where('type', 'device')->where('value', $device['device_uid'])->delete();
        }

        $this->audit('device_unblocked', "device:{$id}");

        return $this->ok(['status' => 'ok', 'message' => 'Device unblocked successfully']);
    }

    public function suspicious()
    {
        $db = db_connect();
        $shared = $db->query(
            "SELECT device_uid, COUNT(DISTINCT user_id) AS accounts
             FROM devices
             WHERE device_uid <> ''
             GROUP BY device_uid
             HAVING accounts >= 3
             ORDER BY accounts DESC
             LIMIT 50"
        )->getResultArray();
        $since = date('Y-m-d H:i:s', time() - 86400);
        $ips = $db->query(
            "SELECT ip, COUNT(*) AS failures
             FROM audit_log
             WHERE event IN ('login_failed', 'admin_2fa_failed', 'access_blocked')
               AND created_at >= ?
               AND ip IS NOT NULL
             GROUP BY ip
             HAVING failures >= 5
             ORDER BY failures DESC
             LIMIT 50",
            [$since]
        )->getResultArray();
        $signups = (int)$db->table('users')->where('created_at >=', date('Y-m-d H:i:s', time() - 3600))->countAllResults();
        return $this->ok([
            'shared_devices' => $shared,
            'failed_ips' => $ips,
            'signups_last_hour' => $signups,
        ]);
    }
}
