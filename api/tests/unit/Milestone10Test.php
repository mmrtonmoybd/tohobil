<?php

namespace Tests\Unit;

use App\Controllers\Api\V1\Profile;
use App\Controllers\Web\AccountDeletion;
use App\Services\Identity;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;

/**
 * @internal
 */
final class Milestone10Test extends CIUnitTestCase
{
    private function invokeController(string $controllerClass, string $method, array $postData = [], ?array $user = null): Response
    {
        $config = new App();
        $uri = new URI('http://localhost:8000/api/v1/test');
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

        $controller = new $controllerClass();
        $response = new Response(new App());
        $controller->initController($request, $response, service('logger'));
        return $controller->{$method}();
    }

    public function testExportZipContainsRequiredFiles(): void
    {
        $db = db_connect();
        $phone = '+8801999888777';
        $db->table('users')->where('phone', $phone)->delete();
        $db->table('users')->insert([
            'phone'         => $phone,
            'password_hash' => password_hash('zipPass123', PASSWORD_DEFAULT),
            'name'          => 'Zip Tester',
            'status'        => 'active',
        ]);
        $userId = (int)$db->insertID();
        $identity = new Identity($db);
        $token = $identity->issueToken($userId);
        $user = $identity->userForToken($token);

        // Call exportZip
        $response = $this->invokeController(Profile::class, 'exportZip', [], $user);
        self::assertSame(200, $response->getStatusCode());
        self::assertSame('application/zip', $response->getHeaderLine('Content-Type'));

        $zipBody = $response->getBody();
        self::assertNotEmpty($zipBody);

        $tempFile = tempnam(sys_get_temp_dir(), 'test_zip_');
        file_put_contents($tempFile, $zipBody);

        $zip = new \ZipArchive();
        self::assertTrue($zip->open($tempFile));
        self::assertNotFalse($zip->locateName('data.json'));
        self::assertNotFalse($zip->locateName('transactions.csv'));
        self::assertNotFalse($zip->locateName('README.txt'));

        $dataJson = json_decode($zip->getFromName('data.json'), true);
        self::assertSame('Tohobil', $dataJson['app']);
        self::assertSame('Zip Tester', $dataJson['user']['name']);

        $zip->close();
        @unlink($tempFile);

        // Cleanup
        $identity->purgeUser($userId);
    }

    public function testDeleteAccountWithOtp(): void
    {
        $db = db_connect();
        $phone = '+8801999888666';
        $db->table('users')->where('phone', $phone)->delete();
        $db->table('users')->insert([
            'phone'         => $phone,
            'password_hash' => password_hash('otpDelPass123', PASSWORD_DEFAULT),
            'name'          => 'OTP Del User',
            'status'        => 'active',
        ]);
        $userId = (int)$db->insertID();
        $identity = new Identity($db);
        $token = $identity->issueToken($userId);
        $user = $identity->userForToken($token);

        // Insert OTP code
        $db->table('otp_codes')->insert([
            'phone'      => $phone,
            'purpose'    => 'delete_account',
            'code_hash'  => hash('sha256', '123456'),
            'user_id'    => $userId,
            'expires_at' => date('Y-m-d H:i:s', time() + 600),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $fail = $this->invokeController(Profile::class, 'delete', ['otp' => '123456'], $user);
        self::assertSame(503, $fail->getStatusCode());
        $body = json_decode($fail->getBody(), true);
        self::assertSame('SMS_NOT_CONFIGURED', $body['error']['code']);

        $check = $db->table('users')->where('id', $userId)->get()->getRowArray();
        self::assertSame('active', $check['status']);
        self::assertEmpty($check['deletion_requested_at']);
        self::assertNotNull($identity->userForToken($token));
        $identity->purgeUser($userId);
    }

    public function testWebAccountDeletionPageRenders(): void
    {
        $controller = new AccountDeletion();
        $controller->initController(service('request'), service('response'), service('logger'));
        $html = $controller->index();
        self::assertIsString($html);
        self::assertStringContainsString('Delete Tohobil Account', $html);
        self::assertStringContainsString('Phone Number', $html);
        self::assertStringContainsString('action="/delete-account"', $html);
    }
}
