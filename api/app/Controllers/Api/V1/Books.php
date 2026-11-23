<?php

namespace App\Controllers\Api\V1;

use App\Services\Identity;

class Books extends ApiController
{
    public function invite($bookId)
    {
        $user = $this->request->authUser ?? null;
        if (!$user) {
            return $this->fail('UNAUTHORIZED', 'Authentication required', 401);
        }

        $input = $this->input();
        $rawPhone = trim((string)($input['phone'] ?? ''));
        $role = trim((string)($input['role'] ?? 'editor'));
        $bookName = trim((string)($input['book_name'] ?? 'Shared Book'));

        if (!in_array($role, ['editor', 'viewer'], true)) {
            return $this->fail('VALIDATION_ERROR', 'Role must be editor or viewer', 422);
        }

        $phone = Identity::phone($rawPhone);
        if (!$phone) {
            return $this->fail('INVALID_PHONE', 'Valid Bangladeshi phone number required', 422);
        }

        if ($phone === $user['phone']) {
            return $this->fail('INVALID_INVITATION', 'You cannot invite yourself', 422);
        }

        $db = db_connect();

        // Verify caller is an owner of this book
        $membership = $db->table('book_members')
            ->where('book_id', $bookId)
            ->where('user_id', (int)$user['id'])
            ->where('deleted_at IS NULL')
            ->get()
            ->getRowArray();

        // If not in book_members yet, check if they created the book
        if (!$membership) {
            $book = $db->table('books')
                ->where('id', $bookId)
                ->where('user_id', (int)$user['id'])
                ->get()
                ->getRowArray();

            if (!$book) {
                return $this->fail('FORBIDDEN', 'Only book owners can invite new members', 403);
            }

            // Ensure owner membership exists
            $db->table('book_members')->insert([
                'id'         => bin2hex(random_bytes(16)),
                'book_id'    => $bookId,
                'user_id'    => (int)$user['id'],
                'role'       => 'owner',
                'created_at' => (int)(microtime(true) * 1000),
                'updated_at' => (int)(microtime(true) * 1000),
                'server_rev' => 1,
            ]);
        } elseif ($membership['role'] !== 'owner') {
            return $this->fail('FORBIDDEN', 'Only book owners can invite new members', 403);
        }

        // Check if invitee is already a member
        $inviteeUser = $db->table('users')->where('phone', $phone)->get()->getRowArray();
        if ($inviteeUser) {
            $alreadyMember = $db->table('book_members')
                ->where('book_id', $bookId)
                ->where('user_id', (int)$inviteeUser['id'])
                ->where('deleted_at IS NULL')
                ->get()
                ->getRowArray();

            if ($alreadyMember) {
                return $this->fail('ALREADY_MEMBER', 'This user is already a member of this book', 409);
            }
        }

        $invitationId = bin2hex(random_bytes(16));

        $db->table('book_invitations')->replace([
            'id'              => $invitationId,
            'book_id'         => $bookId,
            'book_name'       => $bookName,
            'inviter_user_id' => (int)$user['id'],
            'inviter_name'    => $user['name'] ?: 'Tohobil User',
            'invitee_phone'   => $phone,
            'role'            => $role,
            'status'          => 'pending',
            'created_at'      => date('Y-m-d H:i:s'),
        ]);

        $pushService = new \App\Services\PushService($db);
        $pushService->notifySharedBookInvite((int)$user['id'], $user['name'] ?: 'Tohobil User', $phone, $bookName);

        return $this->ok([
            'status'        => 'ok',
            'invitation_id' => $invitationId,
            'message'       => 'Invitation sent successfully',
        ]);
    }

    public function invitations()
    {
        $user = $this->request->authUser ?? null;
        if (!$user) {
            return $this->fail('UNAUTHORIZED', 'Authentication required', 401);
        }

        $db = db_connect();
        $invitations = $db->table('book_invitations')
            ->where('invitee_phone', $user['phone'])
            ->where('status', 'pending')
            ->orderBy('id', 'DESC')
            ->get()
            ->getResultArray();

        return $this->ok([
            'status'      => 'ok',
            'invitations' => $invitations,
        ]);
    }

    public function acceptInvitation($id)
    {
        $user = $this->request->authUser ?? null;
        if (!$user) {
            return $this->fail('UNAUTHORIZED', 'Authentication required', 401);
        }

        $db = db_connect();
        $invitation = $db->table('book_invitations')
            ->where('id', $id)
            ->where('invitee_phone', $user['phone'])
            ->where('status', 'pending')
            ->get()
            ->getRowArray();

        if (!$invitation) {
            return $this->fail('NOT_FOUND', 'Pending invitation not found', 404);
        }

        $nowMs = (int)(microtime(true) * 1000);

        // Add member
        $memberId = bin2hex(random_bytes(16));
        $db->table('book_members')->insert([
            'id'         => $memberId,
            'book_id'    => $invitation['book_id'],
            'user_id'    => (int)$user['id'],
            'role'       => $invitation['role'],
            'created_at' => $nowMs,
            'updated_at' => $nowMs,
            'server_rev' => 1,
        ]);

        $db->table('book_invitations')->where('id', $id)->update(['status' => 'accepted']);

        $pushService = new \App\Services\PushService($db);
        $pushService->notifySharedBookActivity(
            $invitation['book_id'],
            (int)$user['id'],
            $user['name'] ?: 'A member',
            'joined the shared book'
        );

        return $this->ok([
            'status'  => 'ok',
            'book_id' => $invitation['book_id'],
            'role'    => $invitation['role'],
            'message' => 'Invitation accepted. Shared book joined!',
        ]);
    }

    public function declineInvitation($id)
    {
        $user = $this->request->authUser ?? null;
        if (!$user) {
            return $this->fail('UNAUTHORIZED', 'Authentication required', 401);
        }

        $db = db_connect();
        $db->table('book_invitations')
            ->where('id', $id)
            ->where('invitee_phone', $user['phone'])
            ->update(['status' => 'declined']);

        return $this->ok(['status' => 'ok', 'message' => 'Invitation declined']);
    }

    public function members($bookId)
    {
        $user = $this->request->authUser ?? null;
        if (!$user) {
            return $this->fail('UNAUTHORIZED', 'Authentication required', 401);
        }

        $db = db_connect();
        $rows = $db->table('book_members bm')
            ->select('bm.id, bm.user_id, bm.role, bm.created_at, u.name, u.phone')
            ->join('users u', 'u.id = bm.user_id', 'left')
            ->where('bm.book_id', $bookId)
            ->where('bm.deleted_at IS NULL')
            ->get()
            ->getResultArray();

        $members = [];
        foreach ($rows as $r) {
            $members[] = [
                'id'       => $r['id'],
                'user_id'  => (int)$r['user_id'],
                'role'     => $r['role'],
                'name'     => $r['name'] ?: 'Tohobil User',
                'phone'    => $r['phone'],
                'is_you'   => ((int)$r['user_id'] === (int)$user['id']),
            ];
        }

        return $this->ok([
            'status'  => 'ok',
            'members' => $members,
        ]);
    }

    public function removeMember($bookId, $targetUserId)
    {
        $user = $this->request->authUser ?? null;
        if (!$user) {
            return $this->fail('UNAUTHORIZED', 'Authentication required', 401);
        }

        $db = db_connect();
        $callerMembership = $db->table('book_members')
            ->where('book_id', $bookId)
            ->where('user_id', (int)$user['id'])
            ->where('deleted_at IS NULL')
            ->get()
            ->getRowArray();

        $isOwner = ($callerMembership && $callerMembership['role'] === 'owner');
        $isSelf = ((int)$user['id'] === (int)$targetUserId);

        if (!$isOwner && !$isSelf) {
            return $this->fail('FORBIDDEN', 'Only the book owner or the member themselves can remove membership', 403);
        }

        $nowMs = (int)(microtime(true) * 1000);
        $db->table('book_members')
            ->where('book_id', $bookId)
            ->where('user_id', (int)$targetUserId)
            ->update([
                'deleted_at' => $nowMs,
                'updated_at' => $nowMs,
            ]);

        return $this->ok(['status' => 'ok', 'message' => 'Member removed successfully']);
    }
}
