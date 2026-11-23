<?php

namespace App\Controllers\Api\V1;

use App\Services\FileService;

class Files extends ApiController
{
    private function fileService(): FileService
    {
        return new FileService(db_connect());
    }

    public function upload()
    {
        $user = $this->user();
        $file = $this->request->getFile('file');

        $isValid = $file && ($file->isValid() || (defined('ENVIRONMENT') && ENVIRONMENT === 'testing' && $file->getError() === UPLOAD_ERR_OK));
        if (!$file || !$isValid) {
            return $this->fail('VALIDATION_ERROR', $file ? $file->getErrorString() : 'No file uploaded', 422);
        }

        try {
            $metadata = $this->fileService()->upload((int)$user['id'], $file);
            return $this->response->setStatusCode(201)->setJSON(['file' => $metadata]);
        } catch (\RuntimeException $e) {
            $code = match ($e->getCode()) {
                413 => 'QUOTA_EXCEEDED',
                415 => 'UNSUPPORTED_TYPE',
                default => 'UPLOAD_FAILED',
            };
            return $this->fail($code, $e->getMessage(), $e->getCode() ?: 422);
        } catch (\Throwable $e) {
            return $this->fail('SERVER_ERROR', 'File upload failed', 500);
        }
    }

    public function download(string $id)
    {
        $user = $this->user();
        $file = $this->fileService()->getFile((int)$user['id'], $id);

        if (!$file) {
            return $this->fail('NOT_FOUND', 'File not found or access denied', 404);
        }

        $content = file_get_contents($file['file_path']);
        if ($content === false) {
            return $this->fail('SERVER_ERROR', 'Unable to read file content', 500);
        }

        $filename = \App\Services\OutputSafety::dispositionFilename((string)$file['original_name']);
        $inline = str_starts_with((string)$file['mime_type'], 'image/');

        return $this->response
            ->setContentType($file['mime_type'], '')
            ->setHeader('Content-Length', (string)$file['file_size'])
            ->setHeader('Content-Disposition', ($inline ? 'inline' : 'attachment') . '; filename="' . $filename . '"')
            ->setHeader('X-Content-Type-Options', 'nosniff')
            ->setHeader('Cache-Control', 'private, max-age=86400')
            ->setBody($content);
    }

    public function thumbnail(string $id)
    {
        $user = $this->user();
        $thumb = $this->fileService()->getThumbnail((int)$user['id'], $id);

        if (!$thumb) {
            return $this->fail('NOT_FOUND', 'Thumbnail not found', 404);
        }

        $content = file_get_contents($thumb['path']);
        if ($content === false) {
            return $this->fail('SERVER_ERROR', 'Unable to read thumbnail', 500);
        }

        return $this->response
            ->setContentType($thumb['mime'], '')
            ->setHeader('Content-Length', (string)strlen($content))
            ->setHeader('Cache-Control', 'private, max-age=86400')
            ->setBody($content);
    }

    public function delete(string $id)
    {
        $user = $this->user();
        $deleted = $this->fileService()->deleteFile((int)$user['id'], $id);

        if (!$deleted) {
            return $this->fail('NOT_FOUND', 'File not found or access denied', 404);
        }

        return $this->response->setJSON(['ok' => true]);
    }

    public function usage()
    {
        $user = $this->user();
        $stats = $this->fileService()->getStorageStats((int)$user['id']);

        return $this->response->setJSON(['storage' => $stats]);
    }
}
