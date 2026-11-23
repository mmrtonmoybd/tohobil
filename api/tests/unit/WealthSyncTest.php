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

final class WealthSyncTest extends CIUnitTestCase
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
            'users',
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

    private function createUser(string $phone = '+8801700000002', string $name = 'Wealth User'): array
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
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $userId = (int)$db->insertID();

        $bookId = '018f0000-0000-7000-8000-000000000001';
        $db->table('books')->insert([
            'id' => $bookId,
            'user_id' => $userId,
            'name' => 'Personal',
            'icon' => 'wallet',
            'color' => '#14B8A6',
            'currency' => 'BDT',
            'is_default' => 1,
            'created_at' => (int)(microtime(true) * 1000),
            'updated_at' => (int)(microtime(true) * 1000),
            'server_rev' => 1,
        ]);

        $accountId = '018f0000-0000-7000-8000-000000000002';
        $db->table('accounts')->insert([
            'id' => $accountId,
            'user_id' => $userId,
            'book_id' => $bookId,
            'name' => 'Cash',
            'type' => 'cash',
            'currency' => 'BDT',
            'opening_balance' => 5000000,
            'color' => '#14B8A6',
            'icon' => 'payments',
            'include_in_total' => 1,
            'is_archived' => 0,
            'sort_order' => 0,
            'created_at' => (int)(microtime(true) * 1000),
            'updated_at' => (int)(microtime(true) * 1000),
            'server_rev' => 1,
        ]);

        return ['id' => $userId, 'bookId' => $bookId, 'accountId' => $accountId];
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

        if (strtolower($method) === 'pull') {
            return $controller->pull();
        }
        return $controller->push();
    }

    public function testPushAndPullWealthEntities(): void
    {
        $user = $this->createUser();
        $bookId = $user['bookId'];
        $now = (int)(microtime(true) * 1000);

        $assetId = '018f0000-0000-7000-8000-000000000010';
        $valuationId = '018f0000-0000-7000-8000-000000000011';
        $rateId = '018f0000-0000-7000-8000-000000000012';
        $txId = '018f0000-0000-7000-8000-000000000013';

        $pushData = [
            'changes' => [
                'assets' => [
                    [
                        'id' => $assetId,
                        'book_id' => $bookId,
                        'type' => 'fdr',
                        'name' => 'EBL 5-Year Fixed Deposit',
                        'institution' => 'Eastern Bank PLC',
                        'principal' => 50000000, // 500,000 BDT
                        'current_value' => 55000000, // 550,000 BDT
                        'profit_rate' => 11.5,
                        'start_date' => $now - 86400000 * 30,
                        'maturity_date' => $now + 86400000 * 365,
                        'unit' => null,
                        'currency' => 'BDT',
                        'note' => 'Tax deduction 10%',
                        'created_at' => $now,
                        'updated_at' => $now,
                        'deleted_at' => null,
                    ],
                ],
                'asset_valuations' => [
                    [
                        'id' => $valuationId,
                        'book_id' => $bookId,
                        'asset_id' => $assetId,
                        'date' => $now,
                        'value' => 55000000,
                        'created_at' => $now,
                        'updated_at' => $now,
                        'deleted_at' => null,
                    ],
                ],
                'exchange_rates' => [
                    [
                        'id' => $rateId,
                        'book_id' => $bookId,
                        'base' => 'USD',
                        'quote' => 'BDT',
                        'rate' => 121.500000,
                        'date' => $now,
                        'source' => 'manual',
                        'created_at' => $now,
                        'updated_at' => $now,
                        'deleted_at' => null,
                    ],
                ],
                'transactions' => [
                    [
                        'id' => $txId,
                        'book_id' => $bookId,
                        'type' => 'expense',
                        'amount' => 50000000,
                        'currency' => 'BDT',
                        'account_id' => $user['accountId'],
                        'to_account_id' => null,
                        'fee' => 0,
                        'exchange_rate' => null,
                        'category_id' => null,
                        'occurred_at' => $now,
                        'note' => 'Investment in EBL FDR',
                        'parent_id' => null,
                        'recurring_rule_id' => null,
                        'goal_id' => null,
                        'asset_id' => $assetId,
                        'created_at' => $now,
                        'updated_at' => $now,
                        'deleted_at' => null,
                    ],
                ],
            ],
        ];

        $pushRes = $this->invokeSync('push', $pushData, $user);
        $this->assertSame(200, $pushRes->getStatusCode());
        $body = json_decode($pushRes->getBody(), true);
        $this->assertArrayHasKey('server_rev', $body);
        $this->assertSame($assetId, $body['accepted']['assets'][0]['id']);
        $this->assertSame($valuationId, $body['accepted']['asset_valuations'][0]['id']);
        $this->assertSame($rateId, $body['accepted']['exchange_rates'][0]['id']);
        $this->assertSame($txId, $body['accepted']['transactions'][0]['id']);

        // Pull to verify
        $pullRes = $this->invokeSync('pull', [], $user, ['since' => 0, 'limit' => 500]);
        $this->assertSame(200, $pullRes->getStatusCode());
        $pullBody = json_decode($pullRes->getBody(), true);

        $this->assertNotEmpty($pullBody['changes']['assets']);
        $this->assertSame('EBL 5-Year Fixed Deposit', $pullBody['changes']['assets'][0]['name']);
        $this->assertEqualsWithDelta(11.5, (float)$pullBody['changes']['assets'][0]['profit_rate'], 0.01);

        $this->assertNotEmpty($pullBody['changes']['asset_valuations']);
        $this->assertSame(55000000, (int)$pullBody['changes']['asset_valuations'][0]['value']);

        $this->assertNotEmpty($pullBody['changes']['exchange_rates']);
        $this->assertEqualsWithDelta(121.5, (float)$pullBody['changes']['exchange_rates'][0]['rate'], 0.0001);

        $this->assertNotEmpty($pullBody['changes']['transactions']);
        $this->assertSame($assetId, $pullBody['changes']['transactions'][0]['asset_id']);
    }
}
