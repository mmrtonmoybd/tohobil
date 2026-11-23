<?php

namespace Tests\Unit;

use App\Controllers\Admin\Dashboard;
use App\Controllers\Admin\AppConfig;
use App\Controllers\Admin\Announcements;
use App\Controllers\Admin\Content as AdminContent;
use App\Controllers\Admin\System;
use App\Services\AdminService;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;

/**
 * @internal
 */
final class Milestone12Test extends CIUnitTestCase
{
    private function invokeAdminController(string $controllerClass, string $method, array $postData = [], ?array $admin = null): Response
    {
        $config = new App();
        $uri = new URI('http://localhost:8000/admin-api/v1/test');
        $request = new IncomingRequest($config, $uri, null, new UserAgent());
        $request->setMethod('POST');
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';

        if ($admin !== null) {
            $request->admin = $admin;
            $request->adminToken = 'test-token';
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

    public function testAdminServiceAuthenticationAndPermissions(): void
    {
        $db = db_connect();
        $email = 'milestone12_test@tohobil.app';
        $db->table('admins')->where('email', $email)->delete();

        $db->table('admins')->insert([
            'name'          => 'Unit Test Admin',
            'email'         => $email,
            'password_hash' => password_hash('AdminPass@123', PASSWORD_DEFAULT),
            'role'          => 'support',
            'status'        => 'active',
            'created_at'    => date('Y-m-d H:i:s'),
        ]);

        $service = new AdminService($db);

        // 1. Invalid password
        $fail = $service->login($email, 'WrongPass123', '127.0.0.1');
        $this->assertNull($fail);

        // 2. Valid password
        $auth = $service->login($email, 'AdminPass@123', '127.0.0.1');
        $this->assertNotNull($auth);
        $this->assertNotEmpty($auth['token']);
        $this->assertSame('support', $auth['admin']['role']);

        // 3. Token validation
        $adminInfo = $service->adminForToken($auth['token']);
        $this->assertNotNull($adminInfo);
        $this->assertSame($email, $adminInfo['email']);

        // 4. Role-based permissions
        $this->assertTrue($service->hasPermission($adminInfo, 'support.view'));
        $this->assertFalse($service->hasPermission($adminInfo, 'admins.manage'));

        // Super Admin has all permissions
        $superAdmin = ['role' => 'super_admin', 'permissions' => ['*']];
        $this->assertTrue($service->hasPermission($superAdmin, 'admins.manage'));
        $this->assertTrue($service->hasPermission($superAdmin, 'anything.imaginable'));

        // 5. Logout
        $service->logout($auth['token']);
        $afterLogout = $service->adminForToken($auth['token']);
        $this->assertNull($afterLogout);
    }

    public function testAdminDashboardAndAppConfigControllers(): void
    {
        $admin = [
            'id'          => 1,
            'name'        => 'Test Super',
            'email'       => 'super@tohobil.app',
            'role'        => 'super_admin',
            'permissions' => ['*'],
        ];

        // 1. Dashboard KPI
        $dashResponse = $this->invokeAdminController(Dashboard::class, 'index', [], $admin);
        $this->assertSame(200, $dashResponse->getStatusCode());
        $dashJson = json_decode($dashResponse->getBody(), true);
        $this->assertArrayHasKey('kpi', $dashJson);
        $this->assertArrayHasKey('users', $dashJson['kpi']);
        $this->assertArrayHasKey('charts', $dashJson);

        // 2. App Config Update
        $configResponse = $this->invokeAdminController(AppConfig::class, 'update', [
            'maintenance' => 'false',
            'min_android_version' => '0.1.0',
            'latest_android_version' => '0.2.0',
        ], $admin);
        $this->assertSame(200, $configResponse->getStatusCode());

        // 3. App Config View
        $viewConfig = $this->invokeAdminController(AppConfig::class, 'index', [], $admin);
        $this->assertSame(200, $viewConfig->getStatusCode());
        $configJson = json_decode($viewConfig->getBody(), true);
        $this->assertSame('0.1.0', $configJson['config']['min_android_version']);
    }

    public function testAnnouncementsAndFaqContentManagement(): void
    {
        $admin = [
            'id'          => 1,
            'name'        => 'Test Super',
            'email'       => 'super@tohobil.app',
            'role'        => 'super_admin',
            'permissions' => ['*'],
        ];

        // 1. Create Announcement
        $annResponse = $this->invokeAdminController(Announcements::class, 'store', [
            'title'          => 'Welcome to New Version',
            'body'           => 'Exciting new features have landed!',
            'target_segment' => 'all',
            'is_active'      => 1,
            'dismissible'    => 1,
        ], $admin);
        $this->assertSame(200, $annResponse->getStatusCode());
        $annJson = json_decode($annResponse->getBody(), true);
        $this->assertSame('ok', $annJson['status']);
        $this->assertNotEmpty($annJson['id']);

        // 2. Create FAQ Article
        $faqResponse = $this->invokeAdminController(AdminContent::class, 'faqStore', [
            'category'     => 'general',
            'title_en'     => 'How to add expense?',
            'title_bn'     => 'কীভাবে খরচ যোগ করব?',
            'content_en'   => 'Tap the center plus button.',
            'content_bn'   => 'মাঝের প্লাস বাটনে চাপ দিন।',
            'sort_order'   => 1,
            'is_published' => 1,
        ], $admin);
        $this->assertSame(200, $faqResponse->getStatusCode());

        // 3. System Health
        $sysResponse = $this->invokeAdminController(System::class, 'health', [], $admin);
        $this->assertSame(200, $sysResponse->getStatusCode());
        $sysJson = json_decode($sysResponse->getBody(), true);
        $this->assertArrayHasKey('php_version', $sysJson);
        $this->assertArrayHasKey('database_size_mb', $sysJson);
    }
}
