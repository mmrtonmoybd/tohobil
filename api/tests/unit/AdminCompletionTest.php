<?php

namespace Tests\Unit;

use App\Controllers\Admin\Users;
use App\Services\Identity;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;

final class AdminCompletionTest extends CIUnitTestCase
{
    private int $userId = 0;

    protected function tearDown(): void
    {
        $db = db_connect();
        if ($this->userId > 0) {
            foreach (['transactions', 'debts', 'auth_tokens', 'user_status_history', 'admin_notes'] as $table) {
                if ($db->tableExists($table)) {
                    $db->table($table)->where('user_id', $this->userId)->delete();
                }
            }
            $db->table('users')->where('id', $this->userId)->delete();
        }
        parent::tearDown();
    }

    public function testUserDetailCountsRealRecordsAndHidesAmounts(): void
    {
        $db = db_connect();
        if (!$db->tableExists('transactions')) {
            $this->markTestSkipped('transactions table is not migrated');
        }
        $db->table('users')->insert([
            'phone' => '+8801700099' . random_int(100, 999),
            'password_hash' => password_hash('secret-secret', PASSWORD_DEFAULT),
            'name' => 'Count User',
        ]);
        $this->userId = (int)$db->insertID();
        $db->table('transactions')->insert([
            'id' => $this->uuid(),
            'user_id' => $this->userId,
            'book_id' => $this->uuid(),
            'type' => 'expense',
            'amount' => 123456,
            'currency' => 'BDT',
            'account_id' => $this->uuid(),
            'occurred_at' => 1,
            'note' => 'SECRET NOTE SHOULD NOT LEAK',
            'created_at' => 1,
            'updated_at' => 1,
            'server_rev' => 1,
        ]);

        $controller = new Users();
        $controller->initController($this->request(), service('response'), service('logger'));
        $response = $controller->show($this->userId);
        $body = $response->getBody();
        $json = json_decode($body, true);

        $this->assertSame(1, $json['record_counts']['transactions']);
        $this->assertStringNotContainsString('123456', $body);
        $this->assertStringNotContainsString('SECRET NOTE', $body);
        $this->assertStringNotContainsString('password_hash', $body);
    }

    public function testDeletionRequestWaitsForTheGracePeriod(): void
    {
        $db = db_connect();
        if (!$db->fieldExists('deletion_requested_at', 'users')) {
            $this->markTestSkipped('deletion grace column is not migrated');
        }
        $db->table('users')->insert([
            'phone' => '+8801700088' . random_int(100, 999),
            'password_hash' => password_hash('secret-secret', PASSWORD_DEFAULT),
            'name' => 'Grace User',
        ]);
        $this->userId = (int)$db->insertID();
        $identity = new Identity($db);
        $identity->requestDeletion($this->userId);
        $row = $db->table('users')->where('id', $this->userId)->get()->getRowArray();
        $this->assertNotNull($row);
        $this->assertNotEmpty($row['deletion_requested_at']);
        $this->assertSame(0, $identity->purgeDueDeletions(30));
        $this->assertNotNull($db->table('users')->where('id', $this->userId)->get()->getRowArray());

        $db->table('users')->where('id', $this->userId)->update([
            'deletion_requested_at' => date('Y-m-d H:i:s', time() - 31 * 86400),
        ]);
        $this->assertSame(1, $identity->purgeDueDeletions(30));
        $this->assertNull($db->table('users')->where('id', $this->userId)->get()->getRowArray());
        $this->userId = 0;
    }

    private function request(): IncomingRequest
    {
        $config = new App();
        $request = new IncomingRequest($config, new URI('http://localhost/admin-api/v1/users/1'), null, new UserAgent());
        $request->setMethod('GET');
        return $request;
    }

    private function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
    }
}
