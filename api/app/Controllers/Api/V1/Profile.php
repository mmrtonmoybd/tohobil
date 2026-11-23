<?php

namespace App\Controllers\Api\V1;

use App\Services\Identity;

class Profile extends ApiController
{
    public function me()
    {
        return $this->response->setJSON([
            'user' => Identity::publicUser($this->user()),
        ]);
    }

    public function update()
    {
        $data = $this->input();
        $allowed = ['name', 'email', 'occupation', 'birth_date', 'city', 'country', 'currency', 'language', 'marketing_push_opt_in'];
        $change = array_intersect_key($data, array_flip($allowed));

        if (isset($change['name']) && (mb_strlen(trim($change['name'])) < 2 || mb_strlen($change['name']) > 120)) {
            return $this->fail('VALIDATION_ERROR', 'Name must have 2 to 120 characters');
        }
        if (array_key_exists('email', $change) && $change['email'] !== null && $change['email'] !== '' && !filter_var($change['email'], FILTER_VALIDATE_EMAIL)) {
            return $this->fail('VALIDATION_ERROR', 'Invalid email address');
        }
        if (isset($change['country']) && !preg_match('/^[A-Z]{2}$/', $change['country'])) {
            return $this->fail('VALIDATION_ERROR', 'Invalid country code');
        }
        if (isset($change['currency']) && !preg_match('/^[A-Z]{3}$/', $change['currency'])) {
            return $this->fail('VALIDATION_ERROR', 'Invalid currency code');
        }
        if (isset($change['language']) && !in_array($change['language'], ['en', 'bn'], true)) {
            return $this->fail('VALIDATION_ERROR', 'Invalid language');
        }
        if (isset($change['birth_date']) && $change['birth_date'] !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $change['birth_date'])) {
            return $this->fail('VALIDATION_ERROR', 'Invalid birth date');
        }

        if (isset($change['name'])) {
            $change['name'] = trim($change['name']);
        }
        if (array_key_exists('email', $change) && $change['email'] !== $this->user()['email']) {
            $change['email_verified_at'] = null;
        }

        $change['updated_at'] = date('Y-m-d H:i:s');

        db_connect()->table('users')->where('id', $this->user()['id'])->update($change);

        $fresh = db_connect()->table('users')->where('id', $this->user()['id'])->get()->getRowArray();
        return $this->response->setJSON([
            'user' => Identity::publicUser($fresh),
        ]);
    }

    public function avatar()
    {
        $file = $this->request->getFile('photo');
        if (!$file || !$file->isValid() || $file->getSize() > 5 * 1024 * 1024) {
            return $this->fail('VALIDATION_ERROR', 'Upload an image under 5 MB');
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getTempName());
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return $this->fail('VALIDATION_ERROR', 'JPEG, PNG or WebP image required');
        }

        $info = @getimagesize($file->getTempName());
        $width = isset($info[0]) ? (int)$info[0] : null;
        $height = isset($info[1]) ? (int)$info[1] : null;
        if (!\App\Services\OutputSafety::imageWithinLimits($width, $height)) {
            return $this->fail('VALIDATION_ERROR', 'Image is too large');
        }

        $source = match ($mime) {
            'image/jpeg' => imagecreatefromjpeg($file->getTempName()),
            'image/png'  => imagecreatefrompng($file->getTempName()),
            default      => imagecreatefromwebp($file->getTempName()),
        };

        if (!$source) {
            return $this->fail('VALIDATION_ERROR', 'Invalid image data');
        }

        $w = imagesx($source);
        $h = imagesy($source);
        $size = min($w, $h);
        $dest = imagecreatetruecolor(512, 512);

        imagecopyresampled($dest, $source, 0, 0, intdiv($w - $size, 2), intdiv($h - $size, 2), 512, 512, $size, $size);

        $folder = WRITEPATH . 'uploads/users/' . (int)$this->user()['id'];
        if (!is_dir($folder)) {
            mkdir($folder, 0700, true);
        }

        $fileName = 'avatar-' . bin2hex(random_bytes(8)) . '.webp';
        $path = $folder . '/' . $fileName;
        imagewebp($dest, $path, 85);
        imagedestroy($source);
        imagedestroy($dest);

        $old = $this->user()['photo_path'];
        db_connect()->table('users')->where('id', $this->user()['id'])->update([
            'photo_path' => $fileName,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        if ($old && is_file($folder . '/' . $old)) {
            unlink($folder . '/' . $old);
        }

        return $this->response->setJSON([
            'photo_url' => base_url('api/v1/me/avatar'),
            'photo_path' => $fileName,
        ]);
    }

    public function avatarGet()
    {
        $name = $this->user()['photo_path'];
        $path = WRITEPATH . 'uploads/users/' . (int)$this->user()['id'] . '/' . basename((string)$name);

        if (!$name || !is_file($path)) {
            return $this->fail('NOT_FOUND', 'Photo not found', 404);
        }

        return $this->response
            ->setHeader('Content-Type', 'image/webp')
            ->setHeader('Cache-Control', 'private, max-age=86400')
            ->setBody(file_get_contents($path));
    }

    public function phoneChange()
    {
        if (!\App\Services\SmsOtp::enabled()) {
            return $this->fail('SMS_NOT_CONFIGURED', 'Text-message codes are turned off', 503);
        }

        return $this->fail('SMS_NOT_CONFIGURED', 'Text-message codes are turned off', 503);
    }

    public function sessions()
    {
        $rows = db_connect()->table('auth_tokens t')
            ->select('t.id, t.created_at, t.last_used_at, t.expires_at, t.device_id, d.model, d.platform, d.manufacturer, d.app_version')
            ->join('devices d', 'd.id = t.device_id', 'left')
            ->where('t.user_id', $this->user()['id'])
            ->where('t.revoked_at', null)
            ->where('t.expires_at >', date('Y-m-d H:i:s'))
            ->orderBy('t.last_used_at', 'DESC')
            ->get()
            ->getResultArray();

        $currentSessionId = (int)$this->user()['token_id'];
        $formatted = array_map(function ($s) use ($currentSessionId) {
            $s['is_current'] = ((int)$s['id'] === $currentSessionId);
            return $s;
        }, $rows);

        return $this->response->setJSON(['sessions' => $formatted]);
    }

    public function sessionDelete($id)
    {
        if ($id === 'all' || $id === 'all-others') {
            return $this->sessionDeleteAll();
        }

        db_connect()->table('auth_tokens')
            ->where('id', (int)$id)
            ->where('user_id', $this->user()['id'])
            ->update(['revoked_at' => date('Y-m-d H:i:s')]);

        return $this->response->setJSON(['ok' => true]);
    }

    public function sessionDeleteAll()
    {
        db_connect()->table('auth_tokens')
            ->where('user_id', $this->user()['id'])
            ->where('id !=', $this->user()['token_id'])
            ->update(['revoked_at' => date('Y-m-d H:i:s')]);

        return $this->response->setJSON(['ok' => true]);
    }

    public function export()
    {
        if ($this->request->getGet('format') === 'zip') {
            return $this->exportZip();
        }

        $userId = (int)$this->user()['id'];
        $db = db_connect();

        $profile = Identity::publicUser($this->user());
        $devices = $db->table('devices')->where('user_id', $userId)->get()->getResultArray();
        $sessions = $db->table('auth_tokens')->where('user_id', $userId)->get()->getResultArray();
        $audits = $db->table('audit_log')->where('user_id', $userId)->get()->getResultArray();

        $export = [
            'exported_at' => date('c'),
            'app'         => 'Tohobil',
            'user'        => $profile,
            'devices'     => array_map(function ($d) {
                unset($d['push_token']);
                return $d;
            }, $devices),
            'sessions'    => array_map(function ($s) {
                unset($s['token_hash']);
                return $s;
            }, $sessions),
            'audit_log'   => $audits,
        ];

        return $this->response
            ->setHeader('Content-Type', 'application/json')
            ->setHeader('Content-Disposition', 'attachment; filename="tohobil-export-' . date('Ymd-His') . '.json"')
            ->setJSON($export);
    }

    public function exportZip()
    {
        $userId = (int)$this->user()['id'];
        $db = db_connect();

        $profile = Identity::publicUser($this->user());
        $devices = $db->table('devices')->where('user_id', $userId)->get()->getResultArray();
        $sessions = $db->table('auth_tokens')->where('user_id', $userId)->get()->getResultArray();
        $audits = $db->table('audit_log')->where('user_id', $userId)->get()->getResultArray();

        // Gather all user's books and linked records
        $bookMembers = $db->table('book_members')->where('user_id', $userId)->get()->getResultArray();
        $bookIds = array_column($bookMembers, 'book_id');

        $data = [
            'exported_at'  => date('c'),
            'app'          => 'Tohobil',
            'version'      => '1.0',
            'user'         => $profile,
            'devices'      => array_map(function ($d) { unset($d['push_token']); return $d; }, $devices),
            'sessions'     => array_map(function ($s) { unset($s['token_hash']); return $s; }, $sessions),
            'audit_log'    => $audits,
            'books'        => empty($bookIds) ? [] : $db->table('books')->whereIn('id', $bookIds)->get()->getResultArray(),
            'accounts'     => empty($bookIds) ? [] : $db->table('accounts')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'categories'   => empty($bookIds) ? [] : $db->table('categories')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'tags'         => empty($bookIds) ? [] : $db->table('tags')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'people'       => empty($bookIds) ? [] : $db->table('people')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'debts'        => empty($bookIds) ? [] : $db->table('debts')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'debt_installments' => empty($bookIds) ? [] : $db->table('debt_installments')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'transactions' => empty($bookIds) ? [] : $db->table('transactions')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'recurring_rules' => empty($bookIds) ? [] : $db->table('recurring_rules')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'budgets'      => empty($bookIds) ? [] : $db->table('budgets')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'goals'        => empty($bookIds) ? [] : $db->table('goals')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'assets'       => empty($bookIds) ? [] : $db->table('assets')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'asset_valuations' => empty($bookIds) ? [] : $db->table('asset_valuations')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'documents'    => empty($bookIds) ? [] : $db->table('documents')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'attachments'  => empty($bookIds) ? [] : $db->table('attachments')->whereIn('book_id', $bookIds)->get()->getResultArray(),
            'user_settings'=> $db->table('user_settings')->where('user_id', $userId)->get()->getResultArray(),
        ];

        // Generate CSV of transactions
        $csvLines = ["\xEF\xBB\xBFDate,Type,Amount,Currency,Fee,Note,Account ID,To Account ID,Category ID,Debt ID,Asset ID"];
        if (!empty($data['transactions'])) {
            foreach ($data['transactions'] as $tx) {
                $date = isset($tx['occurred_at']) ? date('Y-m-d H:i:s', (int)$tx['occurred_at']) : '';
                $type = $tx['type'] ?? '';
                $amount = number_format(($tx['amount'] ?? 0) / 100, 2, '.', '');
                $curr = $tx['currency'] ?? 'BDT';
                $fee = number_format(($tx['fee'] ?? 0) / 100, 2, '.', '');
                $note = '"' . str_replace('"', '""', $tx['note'] ?? '') . '"';
                $acc = $tx['account_id'] ?? '';
                $toAcc = $tx['to_account_id'] ?? '';
                $cat = $tx['category_id'] ?? '';
                $debt = $tx['debt_id'] ?? '';
                $asset = $tx['asset_id'] ?? '';
                $csvLines[] = "{$date},{$type},{$amount},{$curr},{$fee},{$note},{$acc},{$toAcc},{$cat},{$debt},{$asset}";
            }
        }
        $csvContent = implode("\r\n", $csvLines);

        $readme = "Tohobil - Personal Financial Manager Data Export\r\n"
            . "তহবিল - ব্যক্তিগত অর্থ ব্যবস্থাপনা ডেটা এক্সপোর্ট\r\n"
            . "Exported at / প্রস্তুতকৃত: " . date('Y-m-d H:i:s') . "\r\n\r\n"
            . "Files in this archive / এই আর্কাইভের ফাইলসমূহ:\r\n"
            . "1. data.json: Complete structured JSON export of all your records, accounts, and settings.\r\n"
            . "2. transactions.csv: Spreadsheet-compatible list of all your recorded transactions.\r\n"
            . "3. attachments/: All your uploaded proof photos, receipts, and vault documents.\r\n";

        $tempZip = tempnam(sys_get_temp_dir(), 'tohobil_zip_');
        $zip = new \ZipArchive();
        if ($zip->open($tempZip, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            return $this->fail('EXPORT_FAILED', 'Unable to create zip file', 500);
        }

        $zip->addFromString('data.json', json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $zip->addFromString('transactions.csv', $csvContent);
        $zip->addFromString('README.txt', $readme);

        // Include uploaded files
        $folder = WRITEPATH . 'uploads/users/' . $userId;
        if (is_dir($folder)) {
            $files = glob($folder . '/*');
            if ($files) {
                foreach ($files as $file) {
                    if (is_file($file)) {
                        $zip->addFile($file, 'attachments/' . basename($file));
                    }
                }
            }
        }

        $zip->close();
        $zipContent = file_get_contents($tempZip);
        @unlink($tempZip);

        return $this->response
            ->setHeader('Content-Type', 'application/zip')
            ->setHeader('Content-Disposition', 'attachment; filename="tohobil-data-' . date('Ymd-His') . '.zip"')
            ->setBody($zipContent);
    }

    public function delete()
    {
        $data = $this->input();
        $password = (string)($data['password'] ?? '');
        $otp = (string)($data['otp'] ?? '');
        $userId = (int)$this->user()['id'];

        $verified = false;

        if ($otp !== '' && $password === '') {
            return $this->fail('SMS_NOT_CONFIGURED', 'Text-message codes are turned off. Confirm with your password.', 503);
        }

        if ($password !== '' && password_verify($password, $this->user()['password_hash'])) {
            $verified = true;
        }

        if (!$verified) {
            return $this->fail('INVALID_CREDENTIALS', 'Password required for account deletion.', 401);
        }

        $this->identity()->audit($userId, 'account_deletion_requested', $this->request->getIPAddress());
        $this->identity()->requestDeletion($userId);

        return $this->response->setJSON([
            'ok' => true,
            'deletion_scheduled' => true,
            'purge_after_days' => 30,
        ]);
    }
}
