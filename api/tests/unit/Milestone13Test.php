<?php

namespace Tests\Unit;

use App\Controllers\Api\V1\Books;
use App\Services\PushService;
use App\Services\SyncService;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;

/**
 * @internal
 */
final class Milestone13Test extends CIUnitTestCase
{
    private function invokeBooksController(string $method, array $postData = [], ?array $user = null, array $params = []): Response
    {
        $config = new App();
        $uri = new URI('http://localhost:8000/api/v1/books');
        $request = new IncomingRequest($config, $uri, null, new UserAgent());
        $request->setMethod('POST');
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';

        if ($user !== null) {
            $request->authUser = $user;
        }

        if (!empty($postData)) {
            $request->setBody(json_encode($postData));
            $request->setHeader('Content-Type', 'application/json');
        }

        $controller = new Books();
        $response = new Response(new App());
        $controller->initController($request, $response, service('logger'));
        return $controller->{$method}(...$params);
    }

    protected function tearDown(): void
    {
        $db = db_connect();
        $db->table('book_invitations')->where('invitee_phone', '+8801799990002')->delete();
        $db->table('book_members')->whereIn('book_id', ['test-book-m13'])->delete();
        $db->table('transactions')->where('book_id', 'test-book-m13')->delete();
        $db->table('books')->where('id', 'test-book-m13')->delete();
        $db->table('users')->whereIn('phone', ['+8801799990001', '+8801799990002'])->delete();
        parent::tearDown();
    }

    public function testSharedBooksLifecycleAndRoleEnforcement(): void
    {
        $db = db_connect();

        // 1. Setup two test users with unique numbers
        $ownerPhone = '+8801799990001';
        $collaboratorPhone = '+8801799990002';
        $bookId = 'test-book-m13';

        $db->table('book_invitations')->where('invitee_phone', $collaboratorPhone)->delete();
        $db->table('book_members')->where('book_id', $bookId)->delete();
        $db->table('transactions')->where('book_id', $bookId)->delete();
        $db->table('books')->where('id', $bookId)->delete();
        $db->table('users')->whereIn('phone', [$ownerPhone, $collaboratorPhone])->delete();

        $db->table('users')->insert([
            'phone'         => $ownerPhone,
            'password_hash' => password_hash('Pass@123', PASSWORD_DEFAULT),
            'name'          => 'Book Owner',
            'status'        => 'active',
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
        $ownerId = (int)$db->insertID();

        $db->table('users')->insert([
            'phone'         => $collaboratorPhone,
            'password_hash' => password_hash('Pass@123', PASSWORD_DEFAULT),
            'name'          => 'Book Collaborator',
            'status'        => 'active',
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
        $collaboratorId = (int)$db->insertID();

        $ownerUser = ['id' => $ownerId, 'phone' => $ownerPhone, 'name' => 'Book Owner'];
        $collabUser = ['id' => $collaboratorId, 'phone' => $collaboratorPhone, 'name' => 'Book Collaborator'];

        $bookId = 'test-book-m13';

        // Create book record
        $db->table('books')->insert([
            'id'         => $bookId,
            'user_id'    => $ownerId,
            'name'       => 'Family Budget',
            'currency'   => 'BDT',
            'color'      => '#14B8A6',
            'icon'       => 'menu_book',
            'created_at' => (int)(microtime(true) * 1000),
            'updated_at' => (int)(microtime(true) * 1000),
            'server_rev' => 1,
        ]);

        // 2. Owner invites collaborator as viewer
        $inviteRes = $this->invokeBooksController('invite', [
            'phone'     => $collaboratorPhone,
            'role'      => 'viewer',
            'book_name' => 'Family Budget',
        ], $ownerUser, [$bookId]);

        $this->assertSame(200, $inviteRes->getStatusCode());
        $inviteBody = json_decode($inviteRes->getBody(), true);
        $this->assertSame('ok', $inviteBody['status']);
        $invitationId = $inviteBody['invitation_id'];
        $this->assertNotEmpty($invitationId);

        // 3. Collaborator retrieves pending invitations
        $listRes = $this->invokeBooksController('invitations', [], $collabUser);
        $this->assertSame(200, $listRes->getStatusCode());
        $listBody = json_decode($listRes->getBody(), true);
        $this->assertCount(1, $listBody['invitations']);
        $this->assertSame($bookId, $listBody['invitations'][0]['book_id']);
        $this->assertSame('viewer', $listBody['invitations'][0]['role']);

        // 4. Collaborator accepts invitation
        $acceptRes = $this->invokeBooksController('acceptInvitation', [], $collabUser, [$invitationId]);
        $this->assertSame(200, $acceptRes->getStatusCode());
        $acceptBody = json_decode($acceptRes->getBody(), true);
        $this->assertSame('ok', $acceptBody['status']);

        // 5. Check members list
        $membersRes = $this->invokeBooksController('members', [], $ownerUser, [$bookId]);
        $this->assertSame(200, $membersRes->getStatusCode());
        $membersBody = json_decode($membersRes->getBody(), true);
        $this->assertGreaterThanOrEqual(2, count($membersBody['members']));

        // 6. Sync role enforcement: Collaborator as VIEWER attempts to push a mutation to this book
        $sync = new SyncService($db);
        $txId = 'tx-viewer-test-' . bin2hex(random_bytes(6));
        $pushViewerPayload = [
            'transactions' => [
                [
                    'id'          => $txId,
                    'book_id'     => $bookId,
                    'account_id'  => 'dummy-acc',
                    'type'        => 'expense',
                    'amount'      => 50000,
                    'currency'    => 'BDT',
                    'occurred_at' => (int)(microtime(true) * 1000),
                    'note'        => 'Test tx',
                    'created_at'  => (int)(microtime(true) * 1000),
                    'updated_at'  => (int)(microtime(true) * 1000),
                    'deleted_at'  => null,
                ]
            ]
        ];

        $viewerPushResult = $sync->push($collaboratorId, $pushViewerPayload);
        $this->assertNotEmpty($viewerPushResult['conflicts']);
        $this->assertArrayHasKey('transactions', $viewerPushResult['conflicts']);
        $this->assertSame('ROLE_VIEWER_CANNOT_EDIT', $viewerPushResult['conflicts']['transactions'][0]['reason']);

        // 7. Update collaborator role to EDITOR
        $db->table('book_members')
            ->where('book_id', $bookId)
            ->where('user_id', $collaboratorId)
            ->update(['role' => 'editor']);

        $editorPushResult = $sync->push($collaboratorId, $pushViewerPayload);
        $this->assertEmpty($editorPushResult['conflicts']['transactions'] ?? []);
        $this->assertNotEmpty($editorPushResult['accepted']['transactions'] ?? []);

        // 8. Test PushService alert dispatch
        $push = new PushService($db);
        $inviteNotice = $push->notifySharedBookInvite($ownerId, 'Owner', $collaboratorPhone, 'Family Budget');
        $this->assertIsBool($inviteNotice);

        $activityNotice = $push->notifySharedBookActivity($bookId, $ownerId, 'Owner', 'added a new record');
        $this->assertIsBool($activityNotice);

        $secAlert = $push->notifySecurityAlert($ownerId, 'New Login', 'Detected from new device');
        $this->assertIsBool($secAlert);

        // 9. Remove member
        $removeRes = $this->invokeBooksController('removeMember', [], $ownerUser, [$bookId, $collaboratorId]);
        $this->assertSame(200, $removeRes->getStatusCode());
    }
}
