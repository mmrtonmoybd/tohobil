<?php

namespace Tests\Unit;

use App\Controllers\Api\V1\Sync;
use CodeIgniter\Config\Services;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;

final class SyncApiTest extends CIUnitTestCase
{
    private function cleanDb(): void
    {
        $db = db_connect();
        $db->query("SET FOREIGN_KEY_CHECKS = 0");
        $tables = [
            'assets',
            'asset_valuations',
            'exchange_rates',
            'goals',
            'budgets',
            'recurring_rules',
            'documents',
            'attachments',
            'files',
            'user_settings',
            'favorites',
            'transaction_tags',
            'transactions',
            'debt_installments',
            'debt_entries',
            'debts',
            'people',
            'tags',
            'categories',
            'accounts',
            'book_invitations',
            'book_members',
            'books',
            'user_sync_revisions',
            'audit_log',
            'support_tickets',
            'otp_codes',
            'auth_tokens',
            'devices',
            'users',
            'blocklist',
        ];
        foreach ($tables as $tbl) {
            $db->query("DELETE FROM " . $tbl);
        }
        $db->query("SET FOREIGN_KEY_CHECKS = 1");
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->cleanDb();
    }

    protected function tearDown(): void
    {
        $this->cleanDb();
        parent::tearDown();
    }

    private function createUser(string $phone = '+8801712345678', string $name = 'Rahim'): array
    {
        $db = db_connect();
        $db->table('users')->insert([
            'phone' => $phone,
            'password_hash' => password_hash('Pass123456!', PASSWORD_BCRYPT),
            'name' => $name,
            'country' => 'BD',
            'currency' => 'BDT',
            'language' => 'en',
            'status' => 'active',
        ]);
        $id = (int)$db->insertID();
        return $db->table('users')->where('id', $id)->get()->getRowArray();
    }

    private function invokeSync(string $method, array $jsonBody = [], ?array $user = null, array $queryParams = []): Response
    {
        $config = new App();
        $queryString = http_build_query($queryParams);
        $_GET = $queryParams;
        foreach ($queryParams as $k => $v) {
            service('superglobals')->setGet($k, (string)$v);
        }
        $uriString = 'http://localhost:8000/api/v1/sync/' . strtolower($method) . ($queryString ? '?' . $queryString : '');
        $uri = new URI($uriString);
        $request = new IncomingRequest($config, $uri, null, new UserAgent());
        $request->setMethod(strtolower($method) === 'pull' ? 'GET' : 'POST');
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';

        if (!empty($jsonBody)) {
            $request->setBody(json_encode($jsonBody));
            $request->setHeader('Content-Type', 'application/json');
        }

        if ($user) {
            $request->authUser = $user;
        }

        $controller = new Sync();
        $controller->initController($request, new Response($config), Services::logger());

        return strtolower($method) === 'pull' ? $controller->pull() : $controller->push();
    }

    public function testPushCreatesRecordsAndReturnsServerRev(): void
    {
        $user = $this->createUser('+8801700000001', 'User 1');

        $bookId = '018f0000-0000-7000-8000-000000000001';
        $accountId = '018f0000-0000-7000-8000-000000000002';
        $categoryId = '018f0000-0000-7000-8000-000000000003';
        $txId = '018f0000-0000-7000-8000-000000000004';
        $now = (int)(microtime(true) * 1000);

        $payload = [
            'changes' => [
                'books' => [
                    [
                        'id' => $bookId,
                        'name' => 'Personal Book',
                        'icon' => 'wallet',
                        'color' => '#14b8a6',
                        'currency' => 'BDT',
                        'is_default' => 1,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                ],
                'accounts' => [
                    [
                        'id' => $accountId,
                        'book_id' => $bookId,
                        'name' => 'Cash in Hand',
                        'type' => 'cash',
                        'currency' => 'BDT',
                        'opening_balance' => 500000,
                        'color' => '#14b8a6',
                        'icon' => 'payments',
                        'include_in_total' => 1,
                        'sort_order' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                ],
                'categories' => [
                    [
                        'id' => $categoryId,
                        'book_id' => $bookId,
                        'name' => 'Food',
                        'kind' => 'expense',
                        'icon' => 'restaurant',
                        'color' => '#f43f5e',
                        'sort_order' => 0,
                        'is_default' => 1,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                ],
                'transactions' => [
                    [
                        'id' => $txId,
                        'book_id' => $bookId,
                        'type' => 'expense',
                        'amount' => 15000,
                        'currency' => 'BDT',
                        'account_id' => $accountId,
                        'category_id' => $categoryId,
                        'occurred_at' => $now,
                        'note' => 'Lunch',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                ],
            ],
        ];

        $response = $this->invokeSync('push', $payload, $user);
        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode($response->getBody(), true);

        $this->assertTrue($body['ok']);
        $this->assertGreaterThanOrEqual(1, $body['server_rev']);
        $this->assertCount(1, $body['accepted']['books']);
        $this->assertCount(1, $body['accepted']['accounts']);
        $this->assertCount(1, $body['accepted']['categories']);
        $this->assertCount(1, $body['accepted']['transactions']);

        // Verify database state
        $db = db_connect();
        $savedTx = $db->table('transactions')->where('id', $txId)->get()->getRowArray();
        $this->assertNotNull($savedTx);
        $this->assertSame((string)$user['id'], (string)$savedTx['user_id']);
        $this->assertSame('15000', (string)$savedTx['amount']);
        $this->assertSame('Lunch', $savedTx['note']);
        $this->assertSame((int)$body['server_rev'], (int)$savedTx['server_rev']);
    }

    public function testPullReturnsChangesSinceCursor(): void
    {
        $user = $this->createUser('+8801700000002', 'User 2');
        $bookId = '018f0000-0000-7000-8000-000000000010';
        $now = (int)(microtime(true) * 1000);

        // Push 1 book
        $this->invokeSync('push', [
            'changes' => [
                'books' => [
                    [
                        'id' => $bookId,
                        'name' => 'Family Book',
                        'icon' => 'home',
                        'color' => '#0ea5e9',
                        'currency' => 'BDT',
                        'is_default' => 1,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                ],
            ],
        ], $user);

        // Pull with since = 0
        $pullResp = $this->invokeSync('pull', [], $user, ['since' => 0]);
        $this->assertSame(200, $pullResp->getStatusCode());
        $pullBody = json_decode($pullResp->getBody(), true);

        $this->assertNotEmpty($pullBody['changes']['books']);
        $this->assertSame($bookId, $pullBody['changes']['books'][0]['id']);
        $this->assertSame('Family Book', $pullBody['changes']['books'][0]['name']);
        $this->assertFalse($pullBody['has_more']);

        $latestRev = $pullBody['latest_rev'];

        // Pull again with since = latestRev -> should be empty
        $pullResp2 = $this->invokeSync('pull', [], $user, ['since' => $latestRev]);
        $pullBody2 = json_decode($pullResp2->getBody(), true);
        $this->assertEmpty($pullBody2['changes']['books']);
    }

    public function testLastWriteWinsConflictResolution(): void
    {
        $user = $this->createUser('+8801700000003', 'User 3');
        $bookId = '018f0000-0000-7000-8000-000000000020';
        $now = (int)(microtime(true) * 1000);

        // 1. Initial write with updated_at = 10000
        $this->invokeSync('push', [
            'changes' => [
                'books' => [
                    [
                        'id' => $bookId,
                        'name' => 'Original Name',
                        'icon' => 'wallet',
                        'color' => '#14b8a6',
                        'currency' => 'BDT',
                        'created_at' => $now,
                        'updated_at' => 10000,
                    ],
                ],
            ],
        ], $user);

        // 2. Newer write with updated_at = 20000 -> should win and update
        $resp2 = $this->invokeSync('push', [
            'changes' => [
                'books' => [
                    [
                        'id' => $bookId,
                        'name' => 'Updated Name',
                        'icon' => 'wallet',
                        'color' => '#14b8a6',
                        'currency' => 'BDT',
                        'created_at' => $now,
                        'updated_at' => 20000,
                    ],
                ],
            ],
        ], $user);
        $body2 = json_decode($resp2->getBody(), true);
        $this->assertCount(1, $body2['accepted']['books']);

        $db = db_connect();
        $row = $db->table('books')->where('id', $bookId)->get()->getRowArray();
        $this->assertSame('Updated Name', $row['name']);

        // 3. Stale write with updated_at = 15000 (< 20000) -> should be rejected as conflict
        $resp3 = $this->invokeSync('push', [
            'changes' => [
                'books' => [
                    [
                        'id' => $bookId,
                        'name' => 'Stale Name',
                        'icon' => 'wallet',
                        'color' => '#14b8a6',
                        'currency' => 'BDT',
                        'created_at' => $now,
                        'updated_at' => 15000,
                    ],
                ],
            ],
        ], $user);
        $body3 = json_decode($resp3->getBody(), true);
        $this->assertCount(0, $body3['accepted']['books']);
        $this->assertCount(1, $body3['conflicts']['books']);

        // Row in database remains 'Updated Name'
        $rowAfter = $db->table('books')->where('id', $bookId)->get()->getRowArray();
        $this->assertSame('Updated Name', $rowAfter['name']);
    }

    public function testCrossUserIsolation(): void
    {
        $userA = $this->createUser('+8801700000004', 'User A');
        $userB = $this->createUser('+8801700000005', 'User B');
        $bookId = '018f0000-0000-7000-8000-000000000030';
        $now = (int)(microtime(true) * 1000);

        // User A pushes book
        $this->invokeSync('push', [
            'changes' => [
                'books' => [
                    [
                        'id' => $bookId,
                        'name' => 'User A Book',
                        'icon' => 'wallet',
                        'color' => '#14b8a6',
                        'currency' => 'BDT',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                ],
            ],
        ], $userA);

        // User B pulls -> should receive nothing
        $pullB = $this->invokeSync('pull', [], $userB, ['since' => 0]);
        $pullBodyB = json_decode($pullB->getBody(), true);
        $this->assertEmpty($pullBodyB['changes']['books']);

        // User B attempts to push an update to User A's book
        $respB = $this->invokeSync('push', [
            'changes' => [
                'books' => [
                    [
                        'id' => $bookId,
                        'name' => 'Hacked Book',
                        'icon' => 'wallet',
                        'color' => '#000000',
                        'currency' => 'BDT',
                        'created_at' => $now,
                        'updated_at' => $now + 500,
                    ],
                ],
            ],
        ], $userB);

        $bodyB = json_decode($respB->getBody(), true);
        $this->assertCount(0, $bodyB['accepted']['books']);
        $this->assertCount(1, $bodyB['conflicts']['books']);
        $this->assertSame('OWNERSHIP_MISMATCH', $bodyB['conflicts']['books'][0]['reason']);

        // Check DB row remains User A's
        $db = db_connect();
        $row = $db->table('books')->where('id', $bookId)->get()->getRowArray();
        $this->assertSame((string)$userA['id'], (string)$row['user_id']);
        $this->assertSame('User A Book', $row['name']);
    }

    public function testClampsFarFutureTimestamps(): void
    {
        $user = $this->createUser('+8801700000006', 'User 6');
        $bookId = '018f0000-0000-7000-8000-000000000040';
        $futureMs = 4102444800000; // Year 2100

        $resp = $this->invokeSync('push', [
            'changes' => [
                'books' => [
                    [
                        'id' => $bookId,
                        'name' => 'Future Book',
                        'icon' => 'wallet',
                        'color' => '#14b8a6',
                        'currency' => 'BDT',
                        'created_at' => 1000,
                        'updated_at' => $futureMs,
                    ],
                ],
            ],
        ], $user);

        $this->assertSame(200, $resp->getStatusCode());
        $db = db_connect();
        $row = $db->table('books')->where('id', $bookId)->get()->getRowArray();
        $this->assertNotNull($row);

        $nowMs = (int)(microtime(true) * 1000);
        $this->assertLessThanOrEqual($nowMs + 65000, (int)$row['updated_at']);
    }

    public function testSoftDeleteSync(): void
    {
        $user = $this->createUser('+8801700000007', 'User 7');
        $bookId = '018f0000-0000-7000-8000-000000000050';
        $tagId = '018f0000-0000-7000-8000-000000000051';
        $now = (int)(microtime(true) * 1000);

        // Create tag
        $this->invokeSync('push', [
            'changes' => [
                'tags' => [
                    [
                        'id' => $tagId,
                        'book_id' => $bookId,
                        'name' => 'Groceries',
                        'color' => '#22c55e',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                ],
            ],
        ], $user);

        // Soft delete tag
        $delResp = $this->invokeSync('push', [
            'changes' => [
                'tags' => [
                    [
                        'id' => $tagId,
                        'book_id' => $bookId,
                        'name' => 'Groceries',
                        'color' => '#22c55e',
                        'created_at' => $now,
                        'updated_at' => $now + 1000,
                        'deleted_at' => $now + 1000,
                    ],
                ],
            ],
        ], $user);
        $delBody = json_decode($delResp->getBody(), true);
        $delRev = $delBody['server_rev'];

        // Pull with since = delRev - 1 -> should return the soft deleted tag with deleted_at
        $pullResp = $this->invokeSync('pull', [], $user, ['since' => $delRev - 1]);
        $pullBody = json_decode($pullResp->getBody(), true);
        $this->assertNotEmpty($pullBody['changes']['tags']);
        $this->assertSame($tagId, $pullBody['changes']['tags'][0]['id']);
        $this->assertNotNull($pullBody['changes']['tags'][0]['deleted_at']);
    }
}
