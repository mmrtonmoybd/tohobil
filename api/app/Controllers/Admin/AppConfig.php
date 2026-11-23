<?php

namespace App\Controllers\Admin;

class AppConfig extends AdminApiController
{
    public function index()
    {
        $db = db_connect();
        $rows = $db->table('app_config')->get()->getResultArray();
        $config = [];
        foreach ($rows as $r) {
            if ($r['config_key'] === 'exchange_rate_snapshot') {
                $config['exchange_rate_snapshot_at'] = $r['updated_at'];
                continue;
            }
            if (in_array($r['config_key'], ['smtp_pass', 'exchange_rate_api_key'], true)) {
                $config[$r['config_key'] . '_set'] = $r['config_value'] !== '';
                continue;
            }
            $config[$r['config_key']] = $r['config_value'];
        }

        return $this->ok([
            'status' => 'ok',
            'config' => $config,
        ]);
    }

    public function update()
    {
        $input = $this->input();
        $db = db_connect();

        $allowedKeys = [
            'maintenance',
            'maintenance_message',
            'min_android_version',
            'latest_android_version',
            'update_message',
            'support_email',
            'support_phone',
            'support_whatsapp',
            'play_store_url',
            'feature_flags',
            'default_storage_quota_mb',
            'max_file_size_mb',
        ];

        foreach ($input as $key => $value) {
            if (in_array($key, $allowedKeys, true)) {
                $valStr = is_array($value) ? json_encode($value) : (string)$value;
                $db->table('app_config')->replace([
                    'config_key'   => $key,
                    'config_value' => $valStr,
                    'updated_at'   => date('Y-m-d H:i:s'),
                ]);
            }
        }

        unset($input['smtp_pass'], $input['exchange_rate_api_key'], $input['exchange_rate_snapshot']);
        $this->audit('app_config_updated', 'app_config', $input);

        return $this->ok(['status' => 'ok', 'message' => 'App configuration updated']);
    }
}
