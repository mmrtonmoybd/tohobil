<?php

namespace App\Controllers\Admin;

class Settings extends AdminApiController
{
    private const KEYS = [
        'app_name',
        'support_email',
        'support_phone',
        'support_whatsapp',
        'smtp_host',
        'smtp_port',
        'smtp_user',
        'smtp_pass',
        'smtp_from',
        'sms_driver',
        'sms_sender',
        'timezone',
        'default_storage_quota_mb',
        'max_file_size_mb',
        'data_retention_days',
        'exchange_rate_api_key',
    ];

    private const SECRETS = ['smtp_pass', 'exchange_rate_api_key'];

    public function index()
    {
        $db = db_connect();
        $config = [];
        foreach ($db->table('app_config')->whereIn('config_key', self::KEYS)->get()->getResultArray() as $row) {
            if (in_array($row['config_key'], self::SECRETS, true)) {
                $config[$row['config_key'] . '_set'] = $row['config_value'] !== '';
                continue;
            }
            $config[$row['config_key']] = $row['config_value'];
        }
        $firebase = new \App\Services\FcmClient();
        return $this->ok([
            'config' => $config,
            'firebase_configured' => $firebase->hasCredentials(),
            'firebase' => $firebase->getServiceAccountInfo(),
        ]);
    }

    public function update()
    {
        $input = $this->input();
        $db = db_connect();
        $saved = [];
        foreach (self::KEYS as $key) {
            if (!array_key_exists($key, $input)) {
                continue;
            }
            $value = trim((string)$input[$key]);
            if (in_array($key, self::SECRETS, true) && $value === '') {
                continue;
            }
            if ($key === 'exchange_rate_api_key' && preg_match('/^[A-Za-z0-9]{16,64}$/', $value) !== 1) {
                return $this->fail('VALIDATION_ERROR', 'Exchange-rate API key looks invalid', 422);
            }
            if ($key === 'timezone' && $value !== '' && !in_array($value, timezone_identifiers_list(), true)) {
                return $this->fail('VALIDATION_ERROR', 'Unknown timezone', 422);
            }
            $db->table('app_config')->replace([
                'config_key' => $key,
                'config_value' => mb_substr($value, 0, 500),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
            $saved[] = $key;
        }
        $this->audit('settings_updated', 'app_config', ['keys' => array_values(array_diff($saved, self::SECRETS))]);
        return $this->ok(['status' => 'ok']);
    }

    public function uploadFirebase()
    {
        $file = $this->request->getFile('service_account');
        $raw = $file && $file->isValid() ? file_get_contents($file->getTempName()) : (string)($this->input()['service_account'] ?? '');
        $data = json_decode($raw, true);
        if (!is_array($data) || ($data['type'] ?? '') !== 'service_account' || empty($data['project_id']) || empty($data['client_email']) || empty($data['private_key'])) {
            return $this->fail('VALIDATION_ERROR', 'Upload a Firebase service-account JSON file', 422);
        }
        $dir = WRITEPATH . 'firebase';
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            return $this->fail('UNAVAILABLE', 'Could not create the credentials directory', 500);
        }
        $path = $dir . '/service-account.json';
        if (file_put_contents($path, json_encode($data, JSON_UNESCAPED_SLASHES)) === false) {
            return $this->fail('UNAVAILABLE', 'Could not store the credentials', 500);
        }
        chmod($path, 0600);
        $this->audit('firebase_credentials_uploaded', 'firebase', ['project_id' => (string)$data['project_id']]);
        return $this->ok([
            'firebase_configured' => true,
            'project_id' => (string)$data['project_id'],
            'client_email' => (string)$data['client_email'],
        ]);
    }
}
