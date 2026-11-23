<?php

namespace Tests\Unit;

use App\Controllers\Api\V1\AppStatus;
use App\Controllers\Api\V1\Auth;
use App\Controllers\Api\V1\Devices;
use App\Controllers\Api\V1\Profile;
use App\Services\Identity;
use CodeIgniter\Config\Services;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;

final class AuthApiTest extends CIUnitTestCase
{
    private function cleanDb(): void
    {
        $db = db_connect();
        $db->query("SET FOREIGN_KEY_CHECKS = 0");
        foreach (['audit_log', 'support_tickets', 'otp_codes', 'auth_tokens', 'devices', 'users', 'blocklist'] as $tbl) {
            $db->table($tbl)->truncate();
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

    private function invokeController(string $controllerClass, string $method, array $jsonBody = [], ?array $user = null, array $headers = [], array $params = []): Response
    {
        $config = new App();
        $uri = new URI('http://localhost:8000/api/v1/test');
        $request = new IncomingRequest($config, $uri, null, new UserAgent());
        $request->setMethod('POST');
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';

        if (!empty($jsonBody)) {
            $request->setBody(json_encode($jsonBody));
            $request->setHeader('Content-Type', 'application/json');
        }

        foreach ($headers as $k => $v) {
            $request->setHeader($k, $v);
        }

        if ($user) {
            $request->authUser = $user;
        }

        $response = new Response($config);
        $controller = new $controllerClass();
        $controller->initController($request, $response, Services::logger());

        return $controller->{$method}(...$params);
    }

    public function testRegisterAndBengaliDigits(): void
    {
        $response = $this->invokeController(Auth::class, 'register', [
            'name'         => 'রহিম খান',
            'phone'        => '০১৭১২-৩৪৫৬৭৮',
            'password'     => 'supersecret123',
            'accept_terms' => true,
            'language'     => 'bn',
        ]);

        self::assertSame(201, $response->getStatusCode());
        $data = json_decode($response->getBody(), true);
        self::assertNotEmpty($data['token']);
        self::assertSame('+8801712345678', $data['user']['phone']);
        self::assertSame('রহিম খান', $data['user']['name']);
        $created = db_connect()->table('users')->where('phone', '+8801712345678')->get()->getRowArray();
        self::assertTrue(!isset($created['phone_verified_at']) || $created['phone_verified_at'] === null);

        $dupResponse = $this->invokeController(Auth::class, 'register', [
            'name'         => 'রহিম খান ২',
            'phone'        => '01712345678',
            'password'     => 'supersecret123',
            'accept_terms' => true,
        ]);
        self::assertSame(409, $dupResponse->getStatusCode());
    }

    public function testLoginSuccessAndFailure(): void
    {
        $db = db_connect();
        $db->table('users')->insert([
            'name'          => 'Test User',
            'phone'         => '+8801812345678',
            'password_hash' => password_hash('correctpassword', PASSWORD_DEFAULT),
            'status'        => 'active',
        ]);

        // Failed login
        $failResponse = $this->invokeController(Auth::class, 'login', [
            'phone'    => '01812345678',
            'password' => 'wrongpassword',
        ]);
        self::assertSame(401, $failResponse->getStatusCode());

        // Successful login
        $successResponse = $this->invokeController(Auth::class, 'login', [
            'phone'    => '01812345678',
            'password' => 'correctpassword',
        ]);
        self::assertSame(200, $successResponse->getStatusCode());
        $data = json_decode($successResponse->getBody(), true);
        self::assertNotEmpty($data['token']);
        self::assertSame('+8801812345678', $data['user']['phone']);
    }

    public function testOtpSendAndResetPassword(): void
    {
        $db = db_connect();
        $db->table('users')->insert([
            'name'          => 'Reset Target',
            'phone'         => '+8801912345678',
            'password_hash' => password_hash('oldpassword123', PASSWORD_DEFAULT),
            'status'        => 'active',
        ]);

        $otpResponse = $this->invokeController(Auth::class, 'otpSend', [
            'phone'   => '01912345678',
            'purpose' => 'reset',
        ]);
        self::assertSame(503, $otpResponse->getStatusCode());
        $otpBody = json_decode($otpResponse->getBody(), true);
        self::assertSame('SMS_NOT_CONFIGURED', $otpBody['error']['code']);
        self::assertSame(0, $db->table('otp_codes')->where('phone', '+8801912345678')->countAllResults());

        $db->table('otp_codes')->insert([
            'phone'      => '+8801912345678',
            'purpose'    => 'reset',
            'code_hash'  => hash('sha256', '123456'),
            'expires_at' => date('Y-m-d H:i:s', time() + 600),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $resetResponse = $this->invokeController(Auth::class, 'passwordReset', [
            'phone'    => '01912345678',
            'code'     => '123456',
            'password' => 'newpassword123',
        ]);
        self::assertSame(503, $resetResponse->getStatusCode());

        $user = $db->table('users')->where('phone', '+8801912345678')->get()->getRowArray();
        self::assertTrue(password_verify('oldpassword123', $user['password_hash']));
        self::assertFalse(password_verify('newpassword123', $user['password_hash']));
    }

    public function testPasswordChange(): void
    {
        $db = db_connect();
        $db->table('users')->insert([
            'name'          => 'Change Pass User',
            'phone'         => '+8801512345678',
            'password_hash' => password_hash('currentpass123', PASSWORD_DEFAULT),
            'status'        => 'active',
        ]);
        $userId = (int)$db->insertID();
        $identity = new Identity($db);
        $token1 = $identity->issueToken($userId);
        $token2 = $identity->issueToken($userId);

        $user = $identity->userForToken($token1);

        $changeResponse = $this->invokeController(Auth::class, 'passwordChange', [
            'old_password' => 'currentpass123',
            'new_password' => 'updatedpass123',
        ], $user);

        self::assertSame(200, $changeResponse->getStatusCode());

        // token2 should now be revoked
        self::assertNull($identity->userForToken($token2));
        // active token1 should still be valid
        self::assertNotNull($identity->userForToken($token1));
    }

    public function testProfileUpdateAndSessions(): void
    {
        $db = db_connect();
        $db->table('users')->insert([
            'name'          => 'Initial Name',
            'phone'         => '+8801612345678',
            'password_hash' => password_hash('password123', PASSWORD_DEFAULT),
            'status'        => 'active',
            'occupation'    => 'Engineer',
            'city'          => 'Dhaka',
        ]);
        $userId = (int)$db->insertID();
        $identity = new Identity($db);
        $token = $identity->issueToken($userId);
        $user = $identity->userForToken($token);

        // Update profile
        $updateResponse = $this->invokeController(Profile::class, 'update', [
            'name'       => 'Updated Name',
            'occupation' => 'Architect',
            'city'       => 'Chittagong',
        ], $user);

        self::assertSame(200, $updateResponse->getStatusCode());
        $data = json_decode($updateResponse->getBody(), true);
        self::assertSame('Updated Name', $data['user']['name']);
        self::assertSame('Architect', $data['user']['occupation']);
        self::assertSame('Chittagong', $data['user']['city']);

        // Check sessions
        $sessionsResponse = $this->invokeController(Profile::class, 'sessions', [], $user);
        self::assertSame(200, $sessionsResponse->getStatusCode());
        $sessionsData = json_decode($sessionsResponse->getBody(), true);
        self::assertCount(1, $sessionsData['sessions']);
        self::assertTrue($sessionsData['sessions'][0]['is_current']);
    }

    public function testDeviceRegistrationAndPushToken(): void
    {
        $db = db_connect();
        $db->table('users')->insert([
            'name'          => 'Device User',
            'phone'         => '+8801312345678',
            'password_hash' => password_hash('password123', PASSWORD_DEFAULT),
            'status'        => 'active',
        ]);
        $userId = (int)$db->insertID();
        $identity = new Identity($db);
        $token = $identity->issueToken($userId);
        $user = $identity->userForToken($token);

        $regResponse = $this->invokeController(Devices::class, 'register', [
            'device_uid'      => 'test-device-uuid-999',
            'installation_id' => '11111111-2222-3333-4444-555555555555',
            'platform'        => 'android',
            'manufacturer'    => 'Samsung',
            'model'           => 'Galaxy S24',
        ], $user);

        self::assertSame(200, $regResponse->getStatusCode());
        $regData = json_decode($regResponse->getBody(), true);
        $deviceId = $regData['device_id'];
        self::assertGreaterThan(0, $deviceId);

        // Reload user with updated device_id
        $user = $identity->userForToken($token);

        // Update push token
        $pushResponse = $this->invokeController(Devices::class, 'pushTokenUpdate', [
            'push_token' => 'fcm-token-xyz-123',
        ], $user);
        self::assertSame(200, $pushResponse->getStatusCode());

        $device = $db->table('devices')->where('id', $deviceId)->get()->getRowArray();
        self::assertSame('fcm-token-xyz-123', $device['push_token']);

        // Delete push token
        $delPushResponse = $this->invokeController(Devices::class, 'pushTokenDelete', [], $user);
        self::assertSame(200, $delPushResponse->getStatusCode());

        $deviceAfter = $db->table('devices')->where('id', $deviceId)->get()->getRowArray();
        self::assertNull($deviceAfter['push_token']);
    }

    public function testExportAndDeleteAccount(): void
    {
        $db = db_connect();
        $db->table('users')->insert([
            'name'          => 'Account Deletion User',
            'phone'         => '+8801412345678',
            'password_hash' => password_hash('deletepass123', PASSWORD_DEFAULT),
            'status'        => 'active',
        ]);
        $userId = (int)$db->insertID();
        $identity = new Identity($db);
        $token = $identity->issueToken($userId);
        $user = $identity->userForToken($token);

        // Export data
        $exportResponse = $this->invokeController(Profile::class, 'export', [], $user);
        self::assertSame(200, $exportResponse->getStatusCode());
        $exportData = json_decode($exportResponse->getBody(), true);
        self::assertSame('Tohobil', $exportData['app']);
        self::assertSame('+8801412345678', $exportData['user']['phone']);

        // Delete account wrong password
        $failDelete = $this->invokeController(Profile::class, 'delete', [
            'password' => 'wrongpass',
        ], $user);
        self::assertSame(401, $failDelete->getStatusCode());

        // Delete account correct password
        $successDelete = $this->invokeController(Profile::class, 'delete', [
            'password' => 'deletepass123',
        ], $user);
        self::assertSame(200, $successDelete->getStatusCode());
        $deleted = json_decode($successDelete->getBody(), true);
        self::assertTrue($deleted['deletion_scheduled']);
        self::assertSame(30, $deleted['purge_after_days']);

        $row = $db->table('users')->where('id', $userId)->get()->getRowArray();
        self::assertSame('disabled', $row['status']);
        self::assertNotEmpty($row['deletion_requested_at']);
        self::assertSame(0, $db->table('auth_tokens')->where('user_id', $userId)->countAllResults());
    }

    public function testFeedbackAndAppStatus(): void
    {
        $statusResponse = $this->invokeController(AppStatus::class, 'index');
        self::assertSame(200, $statusResponse->getStatusCode());
        $statusData = json_decode($statusResponse->getBody(), true);
        self::assertSame('ok', $statusData['status']);
        self::assertFalse($statusData['maintenance']);

        $feedbackResponse = $this->invokeController(AppStatus::class, 'feedback', [
            'message' => 'Great app! Love the clean interface.',
            'subject' => 'Compliment',
        ]);
        self::assertSame(200, $feedbackResponse->getStatusCode());
    }
}
