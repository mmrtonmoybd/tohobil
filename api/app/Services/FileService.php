<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;
use CodeIgniter\HTTP\Files\UploadedFile;

class FileService
{
    public const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
    public const DEFAULT_QUOTA = 1024 * 1024 * 1024; // 1 GB
    public const THUMB_MAX_EDGE = 300;

    public const ALLOWED_MIME_TYPES = [
        'image/jpeg' => ['jpg', 'jpeg'],
        'image/png'  => ['png'],
        'image/webp' => ['webp'],
        'application/pdf' => ['pdf'],
        'text/plain' => ['txt'],
        'application/msword' => ['doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => ['docx'],
        'application/vnd.ms-excel' => ['xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => ['xlsx'],
    ];

    public function __construct(private readonly BaseConnection $db) {}

    public static function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40); // v4
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80); // RFC 4122
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    public function getUserUploadPath(int $userId): string
    {
        $path = rtrim(WRITEPATH, '/\\') . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'users' . DIRECTORY_SEPARATOR . $userId;
        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }
        return $path;
    }

    public function getUserStorageUsed(int $userId): int
    {
        $row = $this->db->table('files')
            ->select('COALESCE(SUM(file_size), 0) AS total_used')
            ->where('user_id', $userId)
            ->where('deleted_at', null)
            ->get()
            ->getRowArray();

        return (int)($row['total_used'] ?? 0);
    }

    public function getUserStorageQuota(int $userId): int
    {
        if ($this->db->fieldExists('storage_quota_bytes', 'users')) {
            $row = $this->db->table('users')->select('storage_quota_bytes')->where('id', $userId)->get()->getRowArray();
            if ($row && $row['storage_quota_bytes'] !== null && (int)$row['storage_quota_bytes'] > 0) {
                return (int)$row['storage_quota_bytes'];
            }
        }
        $configured = $this->configuredMegabytes('default_storage_quota_mb');
        return $configured > 0 ? $configured * 1024 * 1024 : self::DEFAULT_QUOTA;
    }

    private function configuredMegabytes(string $key): int
    {
        if (!$this->db->tableExists('app_config')) {
            return 0;
        }
        $row = $this->db->table('app_config')->select('config_value')->where('config_key', $key)->get()->getRowArray();
        return max(0, (int)($row['config_value'] ?? 0));
    }

    public function upload(int $userId, UploadedFile $file): array
    {
        $isValid = $file->isValid() || (defined('ENVIRONMENT') && ENVIRONMENT === 'testing' && $file->getError() === UPLOAD_ERR_OK);
        if (!$isValid) {
            throw new \RuntimeException($file->getErrorString() ?: 'Invalid uploaded file', 422);
        }

        $size = $file->getSize();
        $maxFile = $this->configuredMegabytes('max_file_size_mb');
        $maxBytes = $maxFile > 0 ? $maxFile * 1024 * 1024 : self::MAX_FILE_SIZE;
        if ($size > $maxBytes) {
            throw new \RuntimeException('File exceeds the configured size limit', 413);
        }

        $used = $this->getUserStorageUsed($userId);
        $quota = $this->getUserStorageQuota($userId);
        if ($used + $size > $quota) {
            throw new \RuntimeException('Storage quota exceeded (1 GB limit)', 413);
        }

        $tempPath = $file->getTempName();
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($tempPath);

        if (!array_key_exists($mime, self::ALLOWED_MIME_TYPES)) {
            throw new \RuntimeException('Unsupported file type: ' . $mime, 415);
        }

        $clientName = $file->getClientName() ?: 'attachment';
        $clientExt = strtolower(pathinfo($clientName, PATHINFO_EXTENSION));
        $validExts = self::ALLOWED_MIME_TYPES[$mime];
        $ext = in_array($clientExt, $validExts, true) ? $clientExt : $validExts[0];

        $sha256 = hash_file('sha256', $tempPath);
        $fileId = self::generateUuid();
        $uploadDir = $this->getUserUploadPath($userId);

        $storedFileName = "{$fileId}.{$ext}";
        $destination = $uploadDir . DIRECTORY_SEPARATOR . $storedFileName;

        $width = null;
        $height = null;
        $thumbPath = null;

        // If image, read dimensions and generate thumbnail
        if (str_starts_with($mime, 'image/')) {
            $imageInfo = @getimagesize($tempPath);
            $width = isset($imageInfo[0]) ? (int)$imageInfo[0] : null;
            $height = isset($imageInfo[1]) ? (int)$imageInfo[1] : null;
            if (!OutputSafety::imageWithinLimits($width, $height)) {
                throw new \RuntimeException('Image is too large', 415);
            }

            $thumbFileName = "{$fileId}_thumb.jpg";
            $thumbDestination = $uploadDir . DIRECTORY_SEPARATOR . $thumbFileName;
            if ($this->createThumbnail($tempPath, $mime, $thumbDestination, $width, $height)) {
                $thumbPath = $thumbDestination;
            }
        }

        $moved = false;
        if (is_uploaded_file($tempPath)) {
            $moved = $file->move($uploadDir, $storedFileName);
        } else {
            $moved = @copy($tempPath, $destination);
        }

        if (!$moved) {
            throw new \RuntimeException('Failed to save uploaded file', 500);
        }

        $now = date('Y-m-d H:i:s');
        $this->db->table('files')->insert([
            'id'            => $fileId,
            'user_id'       => $userId,
            'original_name' => $clientName,
            'file_path'     => $destination,
            'thumb_path'    => $thumbPath,
            'mime_type'     => $mime,
            'file_size'     => $size,
            'sha256'        => $sha256,
            'width'         => $width,
            'height'        => $height,
            'created_at'    => $now,
            'updated_at'    => $now,
            'deleted_at'    => null,
        ]);

        return [
            'id'            => $fileId,
            'original_name' => $clientName,
            'mime_type'     => $mime,
            'file_size'     => $size,
            'sha256'        => $sha256,
            'width'         => $width,
            'height'        => $height,
            'has_thumb'     => $thumbPath !== null,
        ];
    }

    private function createThumbnail(string $sourcePath, string $mime, string $destPath, ?int $w, ?int $h): bool
    {
        if (!extension_loaded('gd') || !$w || !$h) {
            return false;
        }

        try {
            $src = match ($mime) {
                'image/jpeg' => @imagecreatefromjpeg($sourcePath),
                'image/png'  => @imagecreatefrompng($sourcePath),
                'image/webp' => @imagecreatefromwebp($sourcePath),
                default      => null,
            };

            if (!$src) {
                return false;
            }

            $max = self::THUMB_MAX_EDGE;
            $scale = min(1.0, $max / max($w, $h));
            $tw = max(1, (int)round($w * $scale));
            $th = max(1, (int)round($h * $scale));

            $thumb = imagecreatetruecolor($tw, $th);
            if (!$thumb) {
                imagedestroy($src);
                return false;
            }

            // Fill with white background (in case of transparent PNG/WebP converted to JPEG)
            $white = imagecolorallocate($thumb, 255, 255, 255);
            imagefilledrectangle($thumb, 0, 0, $tw, $th, $white);

            imagecopyresampled($thumb, $src, 0, 0, 0, 0, $tw, $th, $w, $h);
            imagejpeg($thumb, $destPath, 85);

            imagedestroy($src);
            imagedestroy($thumb);
            return file_exists($destPath);
        } catch (\Throwable) {
            return false;
        }
    }

    public function getFile(int $userId, string $fileId): ?array
    {
        $row = $this->db->table('files')
            ->where('id', $fileId)
            ->where('user_id', $userId)
            ->where('deleted_at', null)
            ->get()
            ->getRowArray();

        if (!$row) {
            return null;
        }

        if (!file_exists($row['file_path'])) {
            return null;
        }

        return $row;
    }

    public function getThumbnail(int $userId, string $fileId): ?array
    {
        $row = $this->db->table('files')
            ->where('id', $fileId)
            ->where('user_id', $userId)
            ->where('deleted_at', null)
            ->get()
            ->getRowArray();

        if (!$row) {
            return null;
        }

        if ($row['thumb_path'] && file_exists($row['thumb_path'])) {
            return [
                'path' => $row['thumb_path'],
                'mime' => 'image/jpeg',
            ];
        }

        // If no thumb generated but file is an image and exists, return the file itself
        if (str_starts_with($row['mime_type'], 'image/') && file_exists($row['file_path'])) {
            return [
                'path' => $row['file_path'],
                'mime' => $row['mime_type'],
            ];
        }

        return null;
    }

    public function deleteFile(int $userId, string $fileId): bool
    {
        $row = $this->db->table('files')
            ->where('id', $fileId)
            ->where('user_id', $userId)
            ->where('deleted_at', null)
            ->get()
            ->getRowArray();

        if (!$row) {
            return false;
        }

        $now = date('Y-m-d H:i:s');
        $this->db->table('files')
            ->where('id', $fileId)
            ->where('user_id', $userId)
            ->update([
                'deleted_at' => $now,
                'updated_at' => $now,
            ]);

        // Delete physical files
        if (file_exists($row['file_path'])) {
            @unlink($row['file_path']);
        }
        if ($row['thumb_path'] && file_exists($row['thumb_path'])) {
            @unlink($row['thumb_path']);
        }

        return true;
    }

    public function getStorageStats(int $userId): array
    {
        $used = $this->getUserStorageUsed($userId);
        $quota = $this->getUserStorageQuota($userId);

        $count = $this->db->table('files')
            ->where('user_id', $userId)
            ->where('deleted_at', null)
            ->countAllResults();

        return [
            'used_bytes'  => $used,
            'quota_bytes' => $quota,
            'file_count'  => $count,
        ];
    }
}
