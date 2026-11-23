<?php

namespace App\Controllers\Admin;

class Support extends AdminApiController
{
    public function index()
    {
        $db = db_connect();
        $query = $db->table('support_tickets t')
            ->select('t.*, u.name as user_name, u.phone as user_phone')
            ->join('users u', 'u.id = t.user_id', 'left');

        $status = $this->request->getGet('status');
        if ($status && in_array($status, ['new', 'open', 'waiting', 'resolved'], true)) {
            $query->where('t.status', $status);
        }

        $search = trim((string)$this->request->getGet('search'));
        if ($search !== '') {
            $query->groupStart()
                ->like('t.subject', $search)
                ->orLike('t.message', $search)
                ->orLike('t.name', $search)
                ->orLike('t.email', $search)
                ->orLike('t.phone', $search)
                ->groupEnd();
        }

        $page = max(1, (int)$this->request->getGet('page'));
        $perPage = min(100, max(10, (int)$this->request->getGet('per_page') ?: 20));

        $total = (clone $query)->countAllResults();
        $tickets = $query->orderBy('t.id', 'DESC')
            ->limit($perPage, ($page - 1) * $perPage)
            ->get()
            ->getResultArray();

        return $this->ok([
            'data'       => $tickets,
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
        $ticket = $db->table('support_tickets t')
            ->select('t.*, u.name as user_name, u.phone as user_phone, u.email as user_email')
            ->join('users u', 'u.id = t.user_id', 'left')
            ->where('t.id', (int)$id)
            ->get()
            ->getRowArray();

        if (!$ticket) {
            return $this->fail('NOT_FOUND', 'Ticket not found', 404);
        }

        $replies = $db->table('support_ticket_replies r')
            ->select('r.*, a.name as admin_name')
            ->join('admins a', 'a.id = r.sender_id AND r.sender_type = "admin"', 'left')
            ->where('r.ticket_id', (int)$id)
            ->orderBy('r.id', 'ASC')
            ->get()
            ->getResultArray();

        return $this->ok([
            'ticket'  => $ticket,
            'replies' => $replies,
        ]);
    }

    public function reply($id)
    {
        $db = db_connect();
        $ticket = $db->table('support_tickets')->where('id', (int)$id)->get()->getRowArray();
        if (!$ticket) {
            return $this->fail('NOT_FOUND', 'Ticket not found', 404);
        }

        $input = $this->input();
        $message = trim((string)($input['message'] ?? ''));
        $newStatus = trim((string)($input['status'] ?? 'waiting'));

        if (!$message) {
            return $this->fail('VALIDATION_ERROR', 'Reply message is required', 422);
        }

        $admin = $this->admin();

        $db->table('support_ticket_replies')->insert([
            'ticket_id'   => (int)$id,
            'sender_type' => 'admin',
            'sender_id'   => $admin['id'] ?? null,
            'message'     => $message,
            'created_at'  => date('Y-m-d H:i:s'),
        ]);
        $replyId = (int)$db->insertID();

        $db->table('support_tickets')->where('id', (int)$id)->update([
            'status' => in_array($newStatus, ['open', 'waiting', 'resolved'], true) ? $newStatus : 'waiting',
        ]);

        if ($ticket['user_id']) {
            $user = $db->table('users')->select('language')->where('id', $ticket['user_id'])->get()->getRowArray();
            $title = ($user['language'] ?? 'en') === 'bn' ? 'সাপোর্টের উত্তর' : 'Support reply';
            $db->table('inbox_notifications')->insert([
                'user_id' => (int)$ticket['user_id'], 'type' => 'support_reply',
                'title' => $title, 'body' => $message,
                'action_type' => 'screen', 'action_value' => 'tohobil://support',
            ]);
            (new \App\Services\PushService($db))->sendToUser((int)$ticket['user_id'], $title, $message, [
                'type' => 'support_reply', 'action_type' => 'screen',
                'action_value' => 'tohobil://support', 'channel' => 'announcements',
            ]);
        }

        $this->audit('support_replied', "ticket:{$id}", ['reply_id' => $replyId]);

        return $this->ok(['status' => 'ok', 'message' => 'Reply posted successfully']);
    }

    public function updateStatus($id)
    {
        $db = db_connect();
        $input = $this->input();
        $status = trim((string)($input['status'] ?? ''));

        if (!in_array($status, ['new', 'open', 'waiting', 'resolved'], true)) {
            return $this->fail('VALIDATION_ERROR', 'Invalid status', 422);
        }

        $db->table('support_tickets')->where('id', (int)$id)->update(['status' => $status]);
        $this->audit('support_status_changed', "ticket:{$id}", ['status' => $status]);

        return $this->ok(['status' => 'ok', 'message' => 'Ticket status updated']);
    }
}
