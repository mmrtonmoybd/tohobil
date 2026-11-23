<?php

namespace Tests\Unit;

use App\Services\AdminService;
use App\Services\AdminTotp;
use App\Controllers\Admin\Roles;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;

/** @internal */
final class AdminSecurityTest extends CIUnitTestCase
{
    public function testTotpKnownVectorAndReplayProtection(): void
    {
        $secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
        $this->assertSame(1, AdminTotp::verify($secret, '287082', null, 59));
        $this->assertNull(AdminTotp::verify($secret, '287082', 1, 59));
        $this->assertNull(AdminTotp::verify($secret, '28708x', null, 59));
    }

    public function testSuperAdminNeedsSecondFactorBeforeSession(): void
    {
        $db = db_connect();
        $email = 'admin_security_test@tohobil.app';
        $db->table('admins')->where('email', $email)->delete();
        $secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
        $db->table('admins')->insert([
            'name' => 'Security Test', 'email' => $email,
            'password_hash' => password_hash('TestAdminPass!123', PASSWORD_DEFAULT),
            'role' => 'super_admin', 'totp_secret' => $secret,
            'is_2fa_enabled' => 1, 'status' => 'active',
        ]);
        $adminId = (int)$db->insertID();
        try {
            $service = new AdminService($db);
            $challenge = $service->login($email, 'TestAdminPass!123', '127.0.0.1');
            $this->assertSame('2fa_required', $challenge['status']);
            $this->assertArrayNotHasKey('token', $challenge);
            $this->assertNull($service->completeTwoFactor($challenge['challenge'], '000000'));

            $step = intdiv(time(), 30);
            $digest = hash_hmac('sha1', pack('N2', 0, $step), '12345678901234567890', true);
            $offset = ord($digest[19]) & 15;
            $number = (unpack('N', substr($digest, $offset, 4))[1] & 0x7fffffff) % 1000000;
            $code = str_pad((string)$number, 6, '0', STR_PAD_LEFT);
            $session = $service->completeTwoFactor($challenge['challenge'], $code);
            $this->assertNotNull($session);
            $this->assertNotEmpty($session['csrf_token']);
            $this->assertNotNull($service->adminForToken($session['token']));
            $this->assertNull($service->completeTwoFactor($challenge['challenge'], $code));
            $service->logout($session['token']);
        } finally {
            $db->table('admins')->where('id', $adminId)->delete();
        }
    }

    public function testRolePermissionEditorRequiresReauthentication(): void
    {
        $db = db_connect();
        $email = 'role_security_test@tohobil.app';
        $db->table('admins')->where('email', $email)->delete();
        $db->table('admin_roles')->where('slug', 'security_test')->delete();
        $db->table('admins')->insert([
            'name' => 'Role Test', 'email' => $email,
            'password_hash' => password_hash('TestAdminPass!123', PASSWORD_DEFAULT),
            'role' => 'super_admin', 'status' => 'active',
        ]);
        $adminId = (int)$db->insertID();
        $db->table('admin_roles')->insert([
            'name' => 'Security Test', 'slug' => 'security_test',
            'permissions' => json_encode(['dashboard.view']),
        ]);
        try {
            $invoke = function (string $slug, string $password, array $permissions) use ($adminId): Response {
                $config = new App();
                $request = new IncomingRequest($config, new URI('http://localhost/admin-api/v1/roles/' . $slug), null, new UserAgent());
                $request->setMethod('PUT');
                $request->setHeader('Content-Type', 'application/json');
                $request->setBody(json_encode(['current_password' => $password, 'permissions' => $permissions]));
                $request->admin = ['id' => $adminId, 'role' => 'super_admin'];
                $controller = new Roles();
                $response = new Response($config);
                $controller->initController($request, $response, service('logger'));
                return $controller->update($slug);
            };
            $this->assertSame(403, $invoke('super_admin', 'TestAdminPass!123', [])->getStatusCode());
            $this->assertSame(403, $invoke('security_test', 'wrong', ['users.view'])->getStatusCode());
            $this->assertSame(422, $invoke('security_test', 'TestAdminPass!123', ['invalid.permission'])->getStatusCode());
            $this->assertSame(200, $invoke('security_test', 'TestAdminPass!123', ['dashboard.view', 'users.view'])->getStatusCode());
            $row = $db->table('admin_roles')->where('slug', 'security_test')->get()->getRowArray();
            $this->assertSame(['dashboard.view', 'users.view'], json_decode($row['permissions'], true));
        } finally {
            $db->table('admins')->where('id', $adminId)->delete();
            $db->table('admin_roles')->where('slug', 'security_test')->delete();
        }
    }
}
