<?php

namespace Tests\Unit;

use App\Controllers\Api\V1\Files;
use App\Services\FileService;
use CodeIgniter\Config\Services;
use CodeIgniter\HTTP\Files\UploadedFile;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;

final class FilesApiTest extends CIUnitTestCase
{
    private function cleanDb(): void
    {
        $db = db_connect();
        $db->query("SET FOREIGN_KEY_CHECKS = 0");
        $tables = [
            'documents',
            'attachments',
            'files',
            'users',
        ];
        foreach ($tables as $tbl) {
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

    private function createUser(string $phone = '+8801700000001', string $name = 'User'): array
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

    private function createSampleImage(int $width = 400, int $height = 300): string
    {
        $temp = tempnam(sys_get_temp_dir(), 'img_') . '.jpg';
        $im = imagecreatetruecolor($width, $height);
        $blue = imagecolorallocate($im, 20, 184, 166);
        imagefilledrectangle($im, 0, 0, $width, $height, $blue);
        imagejpeg($im, $temp, 90);
        imagedestroy($im);
        return $temp;
    }

    public function testUploadImageGeneratesMetadataAndThumbnail(): void
    {
        $user = $this->createUser('+8801700000001', 'Test User');
        $tempFile = $this->createSampleImage(600, 400);

        $uploaded = new UploadedFile($tempFile, 'receipt.jpg', 'image/jpeg', filesize($tempFile), UPLOAD_ERR_OK, true);

        $service = new FileService(db_connect());
        $result = $service->upload((int)$user['id'], $uploaded);

        $this->assertNotEmpty($result['id']);
        $this->assertSame('receipt.jpg', $result['original_name']);
        $this->assertSame('image/jpeg', $result['mime_type']);
        $this->assertSame(600, $result['width']);
        $this->assertSame(400, $result['height']);
        $this->assertTrue($result['has_thumb']);
        $this->assertNotEmpty($result['sha256']);

        // Check database
        $db = db_connect();
        $row = $db->table('files')->where('id', $result['id'])->get()->getRowArray();
        $this->assertNotNull($row);
        $this->assertSame((string)$user['id'], (string)$row['user_id']);
        $this->assertFileExists($row['file_path']);
        $this->assertFileExists($row['thumb_path']);

        // Clean up
        $service->deleteFile((int)$user['id'], $result['id']);
        @unlink($tempFile);
    }

    public function testFileDownloadAndThumbnailViaController(): void
    {
        $user = $this->createUser('+8801700000002', 'Owner User');
        $tempFile = $this->createSampleImage(200, 200);

        $uploaded = new UploadedFile($tempFile, 'test.jpg', 'image/jpeg', filesize($tempFile), UPLOAD_ERR_OK, true);
        $service = new FileService(db_connect());
        $metadata = $service->upload((int)$user['id'], $uploaded);
        $fileId = $metadata['id'];

        // Download via controller
        $config = new App();
        $uri = new URI("http://localhost:8000/api/v1/files/{$fileId}");
        $request = new IncomingRequest($config, $uri, null, new UserAgent());
        $request->setMethod('GET');
        $request->authUser = $user;

        $controller = new Files();
        $controller->initController($request, new Response($config), Services::logger());

        $downloadResp = $controller->download($fileId);
        $this->assertSame(200, $downloadResp->getStatusCode());
        $this->assertSame('image/jpeg', $downloadResp->getHeaderLine('Content-Type'));
        $this->assertNotEmpty($downloadResp->getBody());

        // Thumbnail via controller
        $thumbResp = $controller->thumbnail($fileId);
        $this->assertSame(200, $thumbResp->getStatusCode());
        $this->assertSame('image/jpeg', $thumbResp->getHeaderLine('Content-Type'));

        // Clean up
        $service->deleteFile((int)$user['id'], $fileId);
        @unlink($tempFile);
    }

    public function testCrossUserIsolation(): void
    {
        $userA = $this->createUser('+8801700000003', 'User A');
        $userB = $this->createUser('+8801700000004', 'User B');

        $tempFile = $this->createSampleImage(100, 100);
        $uploaded = new UploadedFile($tempFile, 'secret.jpg', 'image/jpeg', filesize($tempFile), UPLOAD_ERR_OK, true);
        $service = new FileService(db_connect());
        $metadata = $service->upload((int)$userA['id'], $uploaded);
        $fileId = $metadata['id'];

        // User B tries to download User A's file
        $config = new App();
        $uri = new URI("http://localhost:8000/api/v1/files/{$fileId}");
        $request = new IncomingRequest($config, $uri, null, new UserAgent());
        $request->setMethod('GET');
        $request->authUser = $userB;

        $controller = new Files();
        $controller->initController($request, new Response($config), Services::logger());

        $downloadResp = $controller->download($fileId);
        $this->assertSame(404, $downloadResp->getStatusCode());

        // User B tries to download thumbnail
        $thumbResp = $controller->thumbnail($fileId);
        $this->assertSame(404, $thumbResp->getStatusCode());

        // User B tries to delete User A's file
        $deleteResp = $controller->delete($fileId);
        $this->assertSame(404, $deleteResp->getStatusCode());

        // User A still has the file
        $fileA = $service->getFile((int)$userA['id'], $fileId);
        $this->assertNotNull($fileA);

        // Clean up
        $service->deleteFile((int)$userA['id'], $fileId);
        @unlink($tempFile);
    }

    public function testStorageUsageStats(): void
    {
        $user = $this->createUser('+8801700000005', 'Stats User');
        $tempFile = $this->createSampleImage(150, 150);
        $fileSize = filesize($tempFile);

        $uploaded = new UploadedFile($tempFile, 'stat.jpg', 'image/jpeg', $fileSize, UPLOAD_ERR_OK, true);
        $service = new FileService(db_connect());
        $metadata = $service->upload((int)$user['id'], $uploaded);

        $config = new App();
        $uri = new URI('http://localhost:8000/api/v1/storage/usage');
        $request = new IncomingRequest($config, $uri, null, new UserAgent());
        $request->setMethod('GET');
        $request->authUser = $user;

        $controller = new Files();
        $controller->initController($request, new Response($config), Services::logger());

        $resp = $controller->usage();
        $this->assertSame(200, $resp->getStatusCode());
        $body = json_decode($resp->getBody(), true);
        $this->assertArrayHasKey('storage', $body);
        $this->assertSame(1, $body['storage']['file_count']);
        $this->assertSame($fileSize, $body['storage']['used_bytes']);
        $this->assertSame(1024 * 1024 * 1024, $body['storage']['quota_bytes']);

        // Clean up
        $service->deleteFile((int)$user['id'], $metadata['id']);
        @unlink($tempFile);
    }
}
