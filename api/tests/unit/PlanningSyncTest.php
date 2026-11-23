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

final class PlanningSyncTest extends CIUnitTestCase
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

    private function createUser(string $phone = '+8801700000001', string $name = 'Planning User'): array
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

        if (strtolower($method) === 'pull') {
            return $controller->pull();
        }
        return $controller->push();
    }

    public function testPushAndPullPlanningEntities(): void
    {
        $user = $this->createUser();
        $userId = (int)$user['id'];
        $now = (int)(microtime(true) * 1000);

        // First push book and account
        $bookId = '018f0000-0000-7000-8000-000000000001';
        $accId = '018f0000-0000-7000-8000-000000000002';
        $catId = '018f0000-0000-7000-8000-000000000003';
        $ruleId = '018f0000-0000-7000-8000-000000000004';
        $budgetId = '018f0000-0000-7000-8000-000000000005';
        $goalId = '018f0000-0000-7000-8000-000000000006';
        $txId = '018f0000-0000-7000-8000-000000000007';

        $pushData = [
            'books' => [
                [
                    'id' => $bookId,
                    'user_id' => $userId,
                    'name' => 'Main Book',
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
                    'id' => $accId,
                    'user_id' => $userId,
                    'book_id' => $bookId,
                    'name' => 'Cash',
                    'type' => 'cash',
                    'currency' => 'BDT',
                    'opening_balance' => 100000,
                    'color' => '#14b8a6',
                    'icon' => 'payments',
                    'include_in_total' => 1,
                    'is_archived' => 0,
                    'sort_order' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ],
            'categories' => [
                [
                    'id' => $catId,
                    'user_id' => $userId,
                    'book_id' => $bookId,
                    'name' => 'Internet',
                    'kind' => 'expense',
                    'icon' => 'wifi',
                    'color' => '#0ea5e9',
                    'sort_order' => 0,
                    'is_default' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ],
            'recurring_rules' => [
                [
                    'id' => $ruleId,
                    'user_id' => $userId,
                    'book_id' => $bookId,
                    'name' => 'Wifi Bill',
                    'type' => 'expense',
                    'amount' => 105000,
                    'currency' => 'BDT',
                    'account_id' => $accId,
                    'category_id' => $catId,
                    'note' => 'Monthly optical fiber',
                    'frequency' => 'monthly',
                    'interval_step' => 1,
                    'start_date' => $now,
                    'mode' => 'remind',
                    'next_run_at' => $now + 86400000 * 5,
                    'is_subscription' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ],
            'budgets' => [
                [
                    'id' => $budgetId,
                    'user_id' => $userId,
                    'book_id' => $bookId,
                    'category_id' => $catId,
                    'amount' => 500000,
                    'currency' => 'BDT',
                    'period' => 'monthly',
                    'rollover' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ],
            'goals' => [
                [
                    'id' => $goalId,
                    'user_id' => $userId,
                    'book_id' => $bookId,
                    'name' => 'New Laptop',
                    'icon' => 'laptop',
                    'color' => '#6366f1',
                    'target_amount' => 12000000,
                    'currency' => 'BDT',
                    'target_date' => $now + 86400000 * 90,
                    'linked_account_id' => $accId,
                    'current_amount' => 2000000,
                    'note' => 'M4 MacBook',
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ],
            'transactions' => [
                [
                    'id' => $txId,
                    'user_id' => $userId,
                    'book_id' => $bookId,
                    'type' => 'expense',
                    'amount' => 105000,
                    'currency' => 'BDT',
                    'account_id' => $accId,
                    'category_id' => $catId,
                    'occurred_at' => $now,
                    'note' => 'Paid Wifi',
                    'recurring_rule_id' => $ruleId,
                    'goal_id' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ],
        ];

        $res = $this->invokeSync('push', $pushData, $user);
        $this->assertSame(200, $res->getStatusCode());
        $body = json_decode($res->getBody(), true);
        $this->assertTrue($body['ok']);
        $this->assertCount(1, $body['accepted']['recurring_rules']);
        $this->assertCount(1, $body['accepted']['budgets']);
        $this->assertCount(1, $body['accepted']['goals']);
        $this->assertCount(1, $body['accepted']['transactions']);

        // Test pull
        $pullRes = $this->invokeSync('pull', [], $user, ['since' => 0]);
        $this->assertSame(200, $pullRes->getStatusCode());
        $pullBody = json_decode($pullRes->getBody(), true);
        $this->assertArrayHasKey('recurring_rules', $pullBody['changes']);
        $this->assertArrayHasKey('budgets', $pullBody['changes']);
        $this->assertArrayHasKey('goals', $pullBody['changes']);
        $this->assertSame('Wifi Bill', $pullBody['changes']['recurring_rules'][0]['name']);
        $this->assertSame(500000, (int)$pullBody['changes']['budgets'][0]['amount']);
        $this->assertSame('New Laptop', $pullBody['changes']['goals'][0]['name']);
        $this->assertSame($ruleId, $pullBody['changes']['transactions'][0]['recurring_rule_id']);
    }
}
