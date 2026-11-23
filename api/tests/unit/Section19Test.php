<?php

namespace Tests\Unit;

use App\Filters\ApiAuth;
use App\Filters\Cors;
use App\Filters\Maintenance;
use App\Filters\Permission;
use App\Filters\RateLimit;
use App\Services\AuditService;
use App\Services\FcmClient;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Messaging\CloudMessage;
use App\Services\StatsService;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;

final class Section19Test extends CIUnitTestCase
{
    private function cleanDb(): void
    {
        $db = db_connect();
        $db->query("SET FOREIGN_KEY_CHECKS = 0");
        foreach (['notification_user_state', 'push_deliveries', 'push_jobs', 'push_events', 'inbox_notifications', 'push_campaigns', 'audit_log', 'daily_stats', 'auth_tokens', 'devices', 'users'] as $tbl) {
            if ($db->tableExists($tbl)) {
                $db->table($tbl)->emptyTable();
            }
        }
        $db->query("SET FOREIGN_KEY_CHECKS = 1");

        if ($db->tableExists('app_config')) {
            $db->table('app_config')->where('config_key', 'maintenance')->update(['config_value' => 'false']);
        }
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

    private function createRequest(string $path, string $method = 'GET', array $headers = [], string $ip = '127.0.0.1'): IncomingRequest
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

        return $request;
    }

    // -------------------------------------------------------------------------
    // 1. ApiAuth Filter Tests
    // -------------------------------------------------------------------------
    public function testApiAuthRejectsMissingToken(): void
    {
        $filter = new ApiAuth();
        $request = $this->createRequest('api/v1/sync/pull');

        $result = $filter->before($request);
        $this->assertInstanceOf(Response::class, $result);
        $this->assertSame(401, $result->getStatusCode());

        $body = json_decode($result->getBody(), true);
        $this->assertSame('UNAUTHORIZED', $body['error']['code']);
    }

    public function testApiAuthRejectsInvalidOrExpiredToken(): void
    {
        $filter = new ApiAuth();
        $request = $this->createRequest('api/v1/sync/pull', 'GET', [
            'Authorization' => 'Bearer completely_invalid_token_12345',
        ]);

        $result = $filter->before($request);
        $this->assertInstanceOf(Response::class, $result);
        $this->assertSame(401, $result->getStatusCode());

        $body = json_decode($result->getBody(), true);
        $this->assertSame('TOKEN_EXPIRED', $body['error']['code']);
    }

    public function testApiAuthAcceptsValidToken(): void
    {
        $db = db_connect();
        $db->table('users')->insert([
            'phone'         => '+8801700999901',
            'name'          => 'Test Auth User',
            'password_hash' => password_hash('secret123', PASSWORD_BCRYPT),
            'status'        => 'active',
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
        $userId = (int)$db->insertID();

        $rawToken = 'tok_valid_secret_' . bin2hex(random_bytes(16));
        $db->table('auth_tokens')->insert([
            'user_id'    => $userId,
            'token_hash' => hash('sha256', $rawToken),
            'expires_at' => date('Y-m-d H:i:s', strtotime('+30 days')),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $filter = new ApiAuth();
        $request = $this->createRequest('api/v1/sync/pull', 'GET', [
            'Authorization' => 'Bearer ' . $rawToken,
        ]);

        $result = $filter->before($request);
        $this->assertNull($result);
        $this->assertNotNull($request->authUser ?? null);
        $this->assertSame((int)$userId, $request->authUser['id']);
        $this->assertSame('+8801700999901', $request->authUser['phone']);
    }

    // -------------------------------------------------------------------------
    // 2. Permission Filter Tests
    // -------------------------------------------------------------------------
    public function testPermissionFilterRejectsUnauthenticated(): void
    {
        $filter = new Permission();
        $request = $this->createRequest('admin-api/v1/users');

        $result = $filter->before($request, ['users.view']);
        $this->assertInstanceOf(Response::class, $result);
        $this->assertSame(401, $result->getStatusCode());
    }

    public function testPermissionFilterEnforcesPermissions(): void
    {
        $filter = new Permission();
        $request = $this->createRequest('admin-api/v1/users');

        // Admin with only 'support.view' permission attempting 'users.view'
        $request->admin = [
            'id'          => 2,
            'role'        => 'support',
            'permissions' => ['support.view', 'support.reply'],
        ];

        $result = $filter->before($request, ['users.view']);
        $this->assertInstanceOf(Response::class, $result);
        $this->assertSame(403, $result->getStatusCode());

        $body = json_decode($result->getBody(), true);
        $this->assertSame('FORBIDDEN', $body['error']['code']);

        // Super Admin bypasses permission check
        $request->admin['role'] = 'super_admin';
        $request->admin['permissions'] = [];
        $resultSuper = $filter->before($request, ['users.view']);
        $this->assertNull($resultSuper);

        // Admin with exact permission passes
        $request->admin['role'] = 'manager';
        $request->admin['permissions'] = ['users.view'];
        $resultAllowed = $filter->before($request, ['users.view']);
        $this->assertNull($resultAllowed);
    }

    // -------------------------------------------------------------------------
    // 3. Maintenance Filter Tests
    // -------------------------------------------------------------------------
    public function testMaintenanceFilterExemptsHealthAndStatus(): void
    {
        $filter = new Maintenance();
        $request = $this->createRequest('api/v1/app/status');

        $result = $filter->before($request);
        $this->assertNull($result);
    }

    public function testMaintenanceFilterBlocksWhenActive(): void
    {
        $db = db_connect();
        $db->table('app_config')->where('config_key', 'maintenance')->update(['config_value' => 'true']);
        $db->table('app_config')->where('config_key', 'maintenance_message')->update(['config_value' => 'Server upgrade in progress.']);

        $filter = new Maintenance();
        $request = $this->createRequest('api/v1/sync/push', 'POST');

        $result = $filter->before($request);
        $this->assertInstanceOf(Response::class, $result);
        $this->assertSame(503, $result->getStatusCode());

        $body = json_decode($result->getBody(), true);
        $this->assertSame('MAINTENANCE', $body['error']['code']);
        $this->assertSame('Server upgrade in progress.', $body['error']['message']);
    }

    // -------------------------------------------------------------------------
    // 4. Cors Filter Tests
    // -------------------------------------------------------------------------
    public function testCorsPreflightResponse(): void
    {
        $filter = new Cors();
        $request = $this->createRequest('api/v1/sync/push', 'OPTIONS', [
            'Origin' => 'https://tohobil.app',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'content-type,x-installation-id',
        ]);

        $result = $filter->before($request);
        $this->assertInstanceOf(Response::class, $result);
        $this->assertContains($result->getStatusCode(), [200, 204]);
        $this->assertSame('https://tohobil.app', $result->getHeaderLine('Access-Control-Allow-Origin'));
        $this->assertStringContainsString('X-Installation-Id', $result->getHeaderLine('Access-Control-Allow-Headers'));
    }

    public function testCorsAllowsCapacitorLocalhostOnGet(): void
    {
        $filter = new Cors();
        $request = $this->createRequest('api/v1/app/status', 'GET', [
            'Origin' => 'https://localhost',
        ]);

        $this->assertNull($filter->before($request));
        $this->assertSame('https://localhost', service('response')->getHeaderLine('Access-Control-Allow-Origin'));
    }

    public function testCorsOmitsUnknownOrigin(): void
    {
        service('response')->removeHeader('Access-Control-Allow-Origin');
        $filter = new Cors();
        $request = $this->createRequest('api/v1/app/status', 'GET', [
            'Origin' => 'https://evil.example',
        ]);

        $this->assertNull($filter->before($request));
        $this->assertSame('', service('response')->getHeaderLine('Access-Control-Allow-Origin'));
    }

    // -------------------------------------------------------------------------
    // 5. RateLimit Filter Tests
    // -------------------------------------------------------------------------
    public function testRateLimitFilterAllowsNormalRequests(): void
    {
        $filter = new RateLimit();
        $request = $this->createRequest('api/v1/sync/push', 'POST', [], '192.168.1.50');

        $result = $filter->before($request);
        $this->assertNull($result);
    }

    // -------------------------------------------------------------------------
    // 6. FcmClient Service Tests
    // -------------------------------------------------------------------------
    public function testFcmClientFailsClosedWithoutCredentials(): void
    {
        $client = new FcmClient(null, '/tmp/nonexistent-service-account.json');
        $this->assertFalse($client->hasCredentials());
        $this->assertNull($client->getServiceAccountInfo());

        // A missing service account must never be reported as a successful delivery.
        $resToken = $client->sendToToken('mock_device_token_xyz', 'Test Title', 'Test Body', ['type' => 'security_alert']);
        $this->assertFalse($resToken['ok']);
        $this->assertSame('FCM_NOT_CONFIGURED', $resToken['error']);

        // Send to topic
        $resTopic = $client->sendToTopic('lang_bn', 'নতুন আপডেট', 'বাজেট ফিচার সক্রিয় করা হয়েছে');
        $this->assertFalse($resTopic['ok']);
        $this->assertSame('FCM_NOT_CONFIGURED', $resTopic['error']);

        // Batch send
        $resBatch = $client->sendBatch(['token_1', 'token_2', 'token_3'], 'Announcement', 'Important notification');
        $this->assertSame(3, $resBatch['total']);
        $this->assertSame(0, $resBatch['success']);
        $this->assertSame(3, $resBatch['failed']);
    }

    public function testFcmClientSendsDataMessageThroughMessagingSdk(): void
    {
        $messaging = $this->createMock(Messaging::class);
        $messaging->expects($this->once())->method('send')->with(
            $this->callback(static function ($message): bool {
                if (!$message instanceof CloudMessage) return false;
                $payload = $message->jsonSerialize();
                return ($payload['data']['title'] ?? null) === 'Hello'
                    && ($payload['data']['campaign_id'] ?? null) === '7'
                    && !isset($payload['notification']);
            }), false
        )->willReturn(['name' => 'projects/test/messages/123']);
        $client = new FcmClient(null, '/tmp/nonexistent-service-account.json', $messaging);
        $result = $client->sendToToken('test-token', 'Hello', 'World', ['campaign_id' => 7]);
        $this->assertTrue($result['ok']);
        $this->assertSame('projects/test/messages/123', $result['message_id']);
    }

    // -------------------------------------------------------------------------
    // 7. StatsService Tests
    // -------------------------------------------------------------------------
    public function testStatsServiceComputesAndStoresKpis(): void
    {
        $db = db_connect();
        $today = date('Y-m-d');

        // Create sample users
        $db->table('users')->insert([
            'phone'         => '+8801811111111',
            'name'          => 'User One',
            'password_hash' => password_hash('secret123', PASSWORD_BCRYPT),
            'language'      => 'bn',
            'last_seen_at'  => date('Y-m-d H:i:s'),
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
        $db->table('users')->insert([
            'phone'         => '+8801822222222',
            'name'          => 'User Two',
            'password_hash' => password_hash('secret123', PASSWORD_BCRYPT),
            'language'      => 'en',
            'last_seen_at'  => date('Y-m-d H:i:s', strtotime('-2 days')),
            'created_at'    => date('Y-m-d H:i:s', strtotime('-5 days')),
        ]);

        $statsService = new StatsService($db);
        $stats = $statsService->computeDailyStats($today);

        $this->assertSame($today, $stats['date']);
        $this->assertSame(2, $stats['total_users']);
        $this->assertSame(1, $stats['new_users']);
        $this->assertSame(1, $stats['active_users_dau']);
        $this->assertSame(2, $stats['active_users_wau']);

        // Verify stored in daily_stats table
        $saved = $db->table('daily_stats')->where('date', $today)->get()->getRowArray();
        $this->assertNotNull($saved);
        $this->assertSame(2, (int)$saved['total_users']);

        // Test getRecentStats
        $recent = $statsService->getRecentStats(7);
        $this->assertNotEmpty($recent);
        $this->assertSame($today, $recent[0]['date']);
    }

    // -------------------------------------------------------------------------
    // 8. AuditService Tests
    // -------------------------------------------------------------------------
    public function testAuditServiceLoggingQueryingAndCsvExport(): void
    {
        $db = db_connect();
        $db->table('users')->insert([
            'phone'         => '+8801933333333',
            'name'          => 'Audit Subject User',
            'password_hash' => password_hash('secret123', PASSWORD_BCRYPT),
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
        $userId = (int)$db->insertID();

        $auditService = new AuditService($db);

        // 1. Log events
        $id1 = $auditService->log('auth.login', (int)$userId, 'Successful password login', '103.20.1.5');
        $id2 = $auditService->log('account.blocked', (int)$userId, 'Banned due to suspicious activity', '127.0.0.1');

        $this->assertGreaterThan(0, $id1);
        $this->assertGreaterThan(0, $id2);

        // 2. Query logs
        $logs = $auditService->getLogs(['user_id' => $userId]);
        $this->assertSame(2, $logs['pagination']['total']);
        $this->assertCount(2, $logs['data']);
        $this->assertSame('account.blocked', $logs['data'][0]['event']);

        // 3. Search logs
        $searchLogs = $auditService->getLogs(['search' => 'suspicious']);
        $this->assertSame(1, $searchLogs['pagination']['total']);
        $this->assertSame('account.blocked', $searchLogs['data'][0]['event']);

        // 4. Export CSV
        $csv = $auditService->exportCsv(['user_id' => $userId]);
        $this->assertStringContainsString('Event,IP,Details', $csv);
        $this->assertStringContainsString('account.blocked', $csv);
        $this->assertStringContainsString('Audit Subject User', $csv);

        // 5. Purge older than 30 days
        $purged = $auditService->purgeOlderThan(30);
        $this->assertSame(0, $purged); // The entries created today are not purged
    }

    // -------------------------------------------------------------------------
    // 9. In-App Notifications & Push Tracking (SPEC 19.4 & 19.7)
    // -------------------------------------------------------------------------
    public function testNotificationsAndPushTracking(): void
    {
        $db = db_connect();

        // 1. Create user and notification
        $db->table('users')->insert([
            'phone'         => '+8801755555555',
            'name'          => 'Push Inbox User',
            'password_hash' => password_hash('secret123', PASSWORD_BCRYPT),
            'status'        => 'active',
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
        $userId = (int)$db->insertID();

        $db->table('inbox_notifications')->insert([
            'user_id'    => $userId,
            'type'       => 'announcement',
            'title'      => 'Welcome to Tohobil',
            'body'       => 'Start managing your finances today.',
            'is_read'    => 0,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
        $notifId = (int)$db->insertID();

        // 2. Query notifications via controller
        $controller = new \App\Controllers\Api\V1\Notifications();
        $request = $this->createRequest('api/v1/notifications');
        $request->authUser = ['id' => $userId];
        $controller->initController($request, service('response'), service('logger'));

        $res = $controller->index();
        $this->assertInstanceOf(Response::class, $res);
        $data = json_decode($res->getBody(), true);
        $this->assertSame(1, $data['unread_count']);
        $this->assertCount(1, $data['data']);
        $this->assertSame('Welcome to Tohobil', $data['data'][0]['title']);

        // 3. Mark notification as read
        $readReq = $this->createRequest('api/v1/notifications/read', 'POST');
        $readReq->setBody(json_encode(['id' => $notifId]));
        $readReq->setHeader('Content-Type', 'application/json');
        $readReq->authUser = ['id' => $userId];
        $controller->initController($readReq, service('response'), service('logger'));
        $readRes = $controller->markRead();
        $this->assertTrue(json_decode($readRes->getBody(), true)['success']);

        $updatedNotif = $db->table('inbox_notifications')->where('id', $notifId)->get()->getRowArray();
        $this->assertSame(1, (int)$updatedNotif['is_read']);

        // 4. Track push opened
        $db->table('push_campaigns')->insert([
            'category'    => 'announcement',
            'title_en'    => 'Campaign 1',
            'body_en'     => 'Campaign Details',
            'opened_count'=> 0,
            'created_at'  => date('Y-m-d H:i:s'),
        ]);
        $campaignId = (int)$db->insertID();

        $openReq = $this->createRequest('api/v1/push/opened', 'POST');
        $openReq->setBody(json_encode(['campaign_id' => $campaignId]));
        $openReq->setHeader('Content-Type', 'application/json');
        $openReq->authUser = ['id' => $userId, 'device_id' => 1];
        $controller->initController($openReq, service('response'), service('logger'));
        $openRes = $controller->opened();
        $this->assertTrue(json_decode($openRes->getBody(), true)['tracked']);

        $campaign = $db->table('push_campaigns')->where('id', $campaignId)->get()->getRowArray();
        $this->assertSame(1, (int)$campaign['opened_count']);

        $eventsCount = $db->table('push_events')->where('campaign_id', $campaignId)->countAllResults();
        $this->assertSame(1, $eventsCount);

        // 5. Delete notification
        $delRes = $controller->delete($notifId);
        $this->assertTrue(json_decode($delRes->getBody(), true)['success']);
        $deletedNotif = $db->table('inbox_notifications')->where('id', $notifId)->get()->getRowArray();
        $this->assertNotNull($deletedNotif['deleted_at']);
    }

    public function testNotificationOwnershipAndBroadcastStateArePerUser(): void
    {
        $db = db_connect();
        $ids = [];
        foreach ([1, 2] as $n) {
            $db->table('users')->insert([
                'phone' => '+88017009999' . str_pad((string)$n, 2, '0', STR_PAD_LEFT),
                'name' => 'Inbox User ' . $n,
                'password_hash' => password_hash('secret12345', PASSWORD_BCRYPT),
                'status' => 'active',
            ]);
            $ids[] = (int)$db->insertID();
        }
        $db->table('inbox_notifications')->insert(['user_id' => null, 'title' => 'Broadcast', 'body' => 'Everyone', 'type' => 'announcement']);
        $broadcastId = (int)$db->insertID();
        $db->table('inbox_notifications')->insert(['user_id' => $ids[0], 'title' => 'Private', 'body' => 'Only one', 'type' => 'security']);
        $privateId = (int)$db->insertID();
        $controller = new \App\Controllers\Api\V1\Notifications();
        $request = $this->createRequest('api/v1/notifications/read', 'POST');
        $request->setHeader('Content-Type', 'application/json');
        $request->authUser = ['id' => $ids[1]];
        $request->setBody(json_encode(['id' => $privateId]));
        $controller->initController($request, service('response'), service('logger'));
        $this->assertSame(404, $controller->markRead()->getStatusCode());
        $this->assertSame(404, $controller->delete($privateId)->getStatusCode());

        $request->setBody(json_encode(['id' => $broadcastId]));
        $controller->initController($request, service('response'), service('logger'));
        $controller->markRead();
        $state = $db->table('notification_user_state')->where('user_id', $ids[1])->where('notification_id', $broadcastId)->get()->getRowArray();
        $this->assertSame(1, (int)$state['is_read']);
        $controller->delete($broadcastId);
        $broadcast = $db->table('inbox_notifications')->where('id', $broadcastId)->get()->getRowArray();
        $this->assertNull($broadcast['deleted_at']);
        $state = $db->table('notification_user_state')->where('user_id', $ids[1])->where('notification_id', $broadcastId)->get()->getRowArray();
        $this->assertNotNull($state['deleted_at']);

        $request->authUser = ['id' => $ids[0]];
        $controller->initController($request, service('response'), service('logger'));
        $inbox = json_decode($controller->index()->getBody(), true);
        $this->assertSame(2, $inbox['unread_count']);
        $this->assertCount(2, $inbox['data']);
    }

    public function testScheduledPushQueueRecordsPerDeviceDelivery(): void
    {
        $db = db_connect();
        $db->table('users')->insert([
            'phone' => '+8801700999977', 'name' => 'Push Queue User',
            'password_hash' => password_hash('secret12345', PASSWORD_BCRYPT), 'status' => 'active',
            'language' => 'bn',
        ]);
        $userId = (int)$db->insertID();
        $db->table('devices')->insert([
            'user_id' => $userId, 'device_uid' => 'test-device-push-1',
            'installation_id' => '123e4567-e89b-12d3-a456-426614174001',
            'platform' => 'android', 'status' => 'active', 'push_token' => 'fcm-test-token',
        ]);
        $deviceId = (int)$db->insertID();
        $db->table('push_campaigns')->insert([
            'category' => 'security', 'title_en' => 'Security notice', 'title_bn' => 'নিরাপত্তা বিজ্ঞপ্তি',
            'body_en' => 'Check account', 'body_bn' => 'অ্যাকাউন্ট দেখুন',
            'target' => 'user', 'target_filters' => json_encode(['user_id' => $userId]),
            'status' => 'scheduled', 'scheduled_at' => date('Y-m-d H:i:s', time() - 60),
        ]);
        $campaignId = (int)$db->insertID();
        $fcm = $this->getMockBuilder(FcmClient::class)->disableOriginalConstructor()
            ->onlyMethods(['sendBatchDetailed'])->getMock();
        $fcm->expects($this->once())->method('sendBatchDetailed')
            ->with(['fcm-test-token'], 'নিরাপত্তা বিজ্ঞপ্তি', 'অ্যাকাউন্ট দেখুন')
            ->willReturn(['fcm-test-token' => ['ok' => true, 'invalid' => false, 'error' => null]]);
        $queue = new \App\Services\PushQueueService($db, $fcm);
        $this->assertSame(1, $queue->dispatchScheduled());
        $this->assertSame(1, $queue->processReadyJobs());
        $campaign = $db->table('push_campaigns')->where('id', $campaignId)->get()->getRowArray();
        $this->assertSame('sent', $campaign['status']);
        $this->assertSame(1, (int)$campaign['sent_count']);
        $delivery = $db->table('push_deliveries')->where('campaign_id', $campaignId)->where('device_id', $deviceId)->get()->getRowArray();
        $this->assertSame('sent', $delivery['status']);
        $this->assertSame(1, $db->table('inbox_notifications')->where('campaign_id', $campaignId)->where('user_id', $userId)->countAllResults());
    }
}
