<?php

namespace App\Controllers\Admin;

class Blocklist extends AdminApiController
{
    public function index()
    {
        $db = db_connect();
        $query = $db->table('blocklist');

        $type = $this->request->getGet('type');
        if ($type && in_array($type, ['phone', 'device', 'ip', 'cidr'], true)) {
            $query->where('type', $type);
        }

        $search = trim((string)$this->request->getGet('search'));
        if ($search !== '') {
            $query->groupStart()
                ->like('value', $search)
                ->orLike('reason', $search)
                ->groupEnd();
        }

        $page = max(1, (int)$this->request->getGet('page'));
        $perPage = min(100, max(10, (int)$this->request->getGet('per_page') ?: 25));

        $total = (clone $query)->countAllResults();
        $items = $query->orderBy('id', 'DESC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()
            ->getResultArray();

        return $this->ok([
            'data'       => $items,
            'pagination' => [
                'total'     => $total,
                'page'      => $page,
                'per_page'  => $perPage,
                'last_page' => (int)ceil($total / $perPage),
            ],
        ]);
    }

    public function store()
    {
        $input = $this->input();
        $type = trim((string)($input['type'] ?? ''));
        $value = trim((string)($input['value'] ?? ''));
        $reason = trim((string)($input['reason'] ?? 'Blocked by admin'));
        $expiresAt = !empty($input['expires_at']) ? date('Y-m-d H:i:s', strtotime($input['expires_at'])) : null;

        if (!in_array($type, ['phone', 'device', 'ip', 'cidr'], true) || empty($value)) {
            return $this->fail('VALIDATION_ERROR', 'Type and value are required', 422);
        }

        $db = db_connect();
        $db->table('blocklist')->replace([
            'type'       => $type,
            'value'      => $value,
            'reason'     => $reason,
            'expires_at' => $expiresAt,
            'created_by' => $this->admin()['id'] ?? null,
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $this->audit('blocklist_add', "block:{$type}:{$value}", ['reason' => $reason, 'expires' => $expiresAt]);

        return $this->ok(['status' => 'ok', 'message' => 'Blocklist entry added']);
    }

    public function delete($id)
    {
        $db = db_connect();
        $row = $db->table('blocklist')->where('id', (int)$id)->get()->getRowArray();
        if ($row) {
            $db->table('blocklist')->where('id', (int)$id)->delete();
            $this->audit('blocklist_remove', "block:{$row['type']}:{$row['value']}");
        }

        return $this->ok(['status' => 'ok', 'message' => 'Blocklist entry removed']);
    }
}
