<?php

namespace Tests\Unit;

use App\Filters\AccessGuard;
use App\Services\Identity;
use CodeIgniter\Config\Services;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;

final class AccessGuardTest extends CIUnitTestCase
{
    private function cleanDb(): void
    {
        $db = db_connect();
        $db->query("SET FOREIGN_KEY_CHECKS = 0");
        foreach (['audit_log', 'support_tickets', 'otp_codes', 'auth_tokens', 'devices', 'users', 'blocklist'] as $tbl) {
            $db->table($tbl)->truncate();
        }
        $db->query("SET FOREIGN_KEY_CHECKS = 1");
        $db->table('app_config')->where('config_key', 'maintenance')->update(['config_value' => 'false']);
        $db->table('app_config')->where('config_key', 'min_android_version')->update(['config_value' => '0.0.0']);
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

    private function createRequest(string $path, string $method = 'GET', array $headers = [], array $body = [], string $ip = '127.0.0.1'): IncomingRequest
    {
        $_SERVER['REMOTE_ADDR'] = $ip;
        service('superglobals')->setServer('REMOTE_ADDR', $ip);
        $config = new App();
        $uri = new URI('http://localhost:8000/' . ltrim($path, '/'));
        $request = new IncomingRequest($config, $uri, null, new UserAgent());
        $request->setMethod($method);

        foreach ($headers as $k => $v) {
            $request->setHeader($k, $v);
        }

        if (!empty($body)) {
            $request->setBody(json_encode($body));
            $request->setHeader('Content-Type', 'application/json');
        }

        return $request;
    }

    public function testOptionsRequestPassesImmediately(): void
    {
        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/some-endpoint', 'OPTIONS');
        $result = $guard->before($request);
        self::assertNull($result);
    }

    public function testPublicRouteAccessibleWithoutAuth(): void
    {
        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/health', 'GET');
        $result = $guard->before($request);
        self::assertNull($result);
    }

    public function testPrivateRouteRejectsUnauthenticated(): void
    {
        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/me', 'GET');
        $response = $guard->before($request);

        self::assertNotNull($response);
        self::assertSame(401, $response->getStatusCode());
        $json = json_decode($response->getBody(), true);
        self::assertSame('UNAUTHENTICATED', $json['error']['code']);
    }

    public function testExactIpBlock(): void
    {
        $db = db_connect();
        $db->table('blocklist')->insert([
            'type'   => 'ip',
            'value'  => '10.20.30.40',
            'reason' => 'Suspicious IP',
        ]);

        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/health', 'GET', [], [], '10.20.30.40');
        $response = $guard->before($request);

        self::assertNotNull($response);
        self::assertSame(403, $response->getStatusCode());
        $json = json_decode($response->getBody(), true);
        self::assertSame('ACCESS_BLOCKED', $json['error']['code']);
        self::assertSame('Suspicious IP', $json['error']['message']);
    }

    public function testCidrIpBlock(): void
    {
        $db = db_connect();
        $db->table('blocklist')->insert([
            'type'   => 'cidr',
            'value'  => '192.168.100.0/24',
            'reason' => 'Subnet banned',
        ]);

        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/health', 'GET', [], [], '192.168.100.45');
        $response = $guard->before($request);

        self::assertNotNull($response);
        self::assertSame(403, $response->getStatusCode());
        $json = json_decode($response->getBody(), true);
        self::assertSame('ACCESS_BLOCKED', $json['error']['code']);
    }

    public function testPhoneBlock(): void
    {
        $db = db_connect();
        $db->table('blocklist')->insert([
            'type'   => 'phone',
            'value'  => '+8801700000001',
            'reason' => 'Fraud phone number',
        ]);

        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/auth/login', 'POST', [], ['phone' => '01700-000001', 'password' => 'secret12345']);
        $response = $guard->before($request);

        self::assertNotNull($response);
        self::assertSame(403, $response->getStatusCode());
        $json = json_decode($response->getBody(), true);
        self::assertSame('ACCESS_BLOCKED', $json['error']['code']);
    }

    public function testDeviceBlockByHeader(): void
    {
        $db = db_connect();
        $db->table('blocklist')->insert([
            'type'   => 'device',
            'value'  => 'banned-device-uid-1234',
            'reason' => 'Stolen hardware ID',
        ]);

        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/health', 'GET', ['X-Device-Id' => 'banned-device-uid-1234']);
        $response = $guard->before($request);

        self::assertNotNull($response);
        self::assertSame(403, $response->getStatusCode());
        $json = json_decode($response->getBody(), true);
        self::assertSame('DEVICE_BLOCKED', $json['error']['code']);
    }

    public function testUserAccountBlocked(): void
    {
        $db = db_connect();
        $db->table('users')->insert([
            'phone'         => '+8801700000002',
            'password_hash' => password_hash('password123', PASSWORD_DEFAULT),
            'name'          => 'Blocked User',
            'status'        => 'blocked',
            'status_reason' => 'Terms of service violation',
        ]);
        $userId = (int)$db->insertID();

        $token = (new Identity($db))->issueToken($userId);

        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/me', 'GET', ['Authorization' => 'Bearer ' . $token]);
        $response = $guard->before($request);

        self::assertNotNull($response);
        self::assertSame(403, $response->getStatusCode());
        $json = json_decode($response->getBody(), true);
        self::assertSame('ACCOUNT_BLOCKED', $json['error']['code']);
        self::assertSame('Terms of service violation', $json['error']['message']);
    }

    public function testUserAccountDisabledAndExpiredAutoReEnable(): void
    {
        $db = db_connect();
        // 1. Account disabled without expiration
        $db->table('users')->insert([
            'phone'         => '+8801700000003',
            'password_hash' => password_hash('password123', PASSWORD_DEFAULT),
            'name'          => 'Disabled User',
            'status'        => 'disabled',
            'status_reason' => 'Under review',
            'status_until'  => date('Y-m-d H:i:s', time() + 3600),
        ]);
        $userId = (int)$db->insertID();
        $token = (new Identity($db))->issueToken($userId);

        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/me', 'GET', ['Authorization' => 'Bearer ' . $token]);
        $response = $guard->before($request);

        self::assertNotNull($response);
        self::assertSame(403, $response->getStatusCode());
        $json = json_decode($response->getBody(), true);
        self::assertSame('ACCOUNT_DISABLED', $json['error']['code']);

        // 2. Account with expired status_until should auto re-enable
        $db->table('users')->where('id', $userId)->update([
            'status_until' => date('Y-m-d H:i:s', time() - 60),
        ]);

        $response2 = $guard->before($request);
        self::assertNull($response2); // Allowed through!

        $updated = $db->table('users')->where('id', $userId)->get()->getRowArray();
        self::assertSame('active', $updated['status']);
        self::assertNull($updated['status_until']);
    }

    public function testMaintenanceMode(): void
    {
        $db = db_connect();
        $db->table('app_config')->where('config_key', 'maintenance')->update(['config_value' => 'true']);

        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/health', 'GET');
        $response = $guard->before($request);

        self::assertNotNull($response);
        self::assertSame(503, $response->getStatusCode());
        $json = json_decode($response->getBody(), true);
        self::assertSame('MAINTENANCE', $json['error']['code']);
    }

    public function testUpdateRequiredWhenAppVersionIsOlder(): void
    {
        $db = db_connect();
        $db->table('app_config')->where('config_key', 'min_android_version')->update(['config_value' => '1.5.0']);

        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/health', 'GET', ['X-App-Version' => '1.2.0']);
        $response = $guard->before($request);

        self::assertNotNull($response);
        self::assertSame(426, $response->getStatusCode());
        $json = json_decode($response->getBody(), true);
        self::assertSame('UPDATE_REQUIRED', $json['error']['code']);
    }

    public function testValidAuthenticatedRequestPassesAndAttachesUser(): void
    {
        $db = db_connect();
        $db->table('users')->insert([
            'phone'         => '+8801700000004',
            'password_hash' => password_hash('password123', PASSWORD_DEFAULT),
            'name'          => 'Valid User',
            'status'        => 'active',
        ]);
        $userId = (int)$db->insertID();
        $token = (new Identity($db))->issueToken($userId);

        $guard = new AccessGuard();
        $request = $this->createRequest('api/v1/me', 'GET', ['Authorization' => 'Bearer ' . $token]);
        $result = $guard->before($request);

        self::assertNull($result);
        self::assertNotNull($request->authUser);
        self::assertSame($userId, (int)$request->authUser['id']);
    }
}
