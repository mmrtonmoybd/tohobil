<?php

namespace App\Controllers\Api\V1;

class Support extends ApiController
{
    public function tickets()
    {
        $user = $this->request->authUser ?? null;
        if (!$user) {
            return $this->fail('UNAUTHORIZED', 'Authentication required', 401);
        }

        $db = db_connect();
        $tickets = $db->table('support_tickets')
            ->where('user_id', (int)$user['id'])
            ->orderBy('id', 'DESC')
            ->get()
            ->getResultArray();

        return $this->response->setJSON([
            'status' => 'ok',
            'data'   => $tickets,
        ]);
    }

    public function ticketDetail($id)
    {
        $user = $this->request->authUser ?? null;
        if (!$user) {
            return $this->fail('UNAUTHORIZED', 'Authentication required', 401);
        }

        $db = db_connect();
        $ticket = $db->table('support_tickets')
            ->where('id', (int)$id)
            ->where('user_id', (int)$user['id'])
            ->get()
            ->getRowArray();

        if (!$ticket) {
            return $this->fail('NOT_FOUND', 'Ticket not found', 404);
        }

        $replies = $db->table('support_ticket_replies')
            ->where('ticket_id', (int)$id)
            ->orderBy('id', 'ASC')
            ->get()
            ->getResultArray();

        return $this->response->setJSON([
            'status'  => 'ok',
            'ticket'  => $ticket,
            'replies' => $replies,
        ]);
    }

    public function reply($id)
    {
        $user = $this->request->authUser ?? null;
        if (!$user) {
            return $this->fail('UNAUTHORIZED', 'Authentication required', 401);
        }

        $db = db_connect();
        $ticket = $db->table('support_tickets')
            ->where('id', (int)$id)
            ->where('user_id', (int)$user['id'])
            ->get()
            ->getRowArray();

        if (!$ticket) {
            return $this->fail('NOT_FOUND', 'Ticket not found', 404);
        }

        $input = $this->input();
        $message = trim((string)($input['message'] ?? ''));
        if (!$message) {
            return $this->fail('VALIDATION_ERROR', 'Message is required', 422);
        }

        $db->table('support_ticket_replies')->insert([
            'ticket_id'   => (int)$id,
            'sender_type' => 'user',
            'sender_id'   => (int)$user['id'],
            'message'     => $message,
            'created_at'  => date('Y-m-d H:i:s'),
        ]);

        $db->table('support_tickets')->where('id', (int)$id)->update(['status' => 'open']);

        return $this->response->setJSON([
            'status'  => 'ok',
            'message' => 'Reply submitted successfully',
        ]);
    }
}
