<?php

namespace App\Controllers\Api\V1;

class Devices extends ApiController
{
    public function register()
    {
        $data = $this->input();
        $uid = (string)($data['device_uid'] ?? '');
        $installation = (string)($data['installation_id'] ?? '');

        if (strlen($uid) < 4 || strlen($uid) > 150 || !preg_match('/^[a-f0-9-]{36}$/i', $installation)) {
            return $this->fail('VALIDATION_ERROR', 'Device UID and installation ID required');
        }

        $identity = $this->identity();
        if ($identity->blocked('device', $uid)) {
            return $this->fail('DEVICE_BLOCKED', 'Device blocked', 403);
        }

        $db = db_connect();
        $values = [
            'device_uid'    => $uid,
            'platform'      => substr((string)($data['platform'] ?? 'unknown'), 0, 20),
            'manufacturer'  => substr((string)($data['manufacturer'] ?? ''), 0, 120),
            'model'         => substr((string)($data['model'] ?? ''), 0, 120),
            'os_version'    => substr((string)($data['os_version'] ?? ''), 0, 60),
            'app_version'   => substr((string)($data['app_version'] ?? ''), 0, 30),
            'language'      => in_array($data['language'] ?? '', ['en', 'bn'], true) ? $data['language'] : null,
            'last_seen_at'  => date('Y-m-d H:i:s'),
            'last_ip'       => $this->request->getIPAddress(),
        ];

        if (isset($data['push_token'])) {
            $values['push_token'] = substr((string)$data['push_token'], 0, 255);
        }

        $existing = $db->table('devices')
            ->where('user_id', $this->user()['id'])
            ->where('installation_id', $installation)
            ->get()
            ->getRowArray();

        if ($existing && $existing['status'] === 'blocked') {
            return $this->fail('DEVICE_BLOCKED', $existing['status_reason'] ?: 'Device blocked', 403);
        }

        if ($existing) {
            $db->table('devices')->where('id', $existing['id'])->update($values);
            $deviceId = (int)$existing['id'];
        } else {
            $values['user_id'] = $this->user()['id'];
            $values['installation_id'] = $installation;
            $values['first_seen_at'] = date('Y-m-d H:i:s');
            $db->table('devices')->insert($values);
            $deviceId = (int)$db->insertID();
        }

        $db->table('auth_tokens')->where('id', $this->user()['token_id'])->update([
            'device_id' => $deviceId,
        ]);

        return $this->response->setJSON(['device_id' => $deviceId]);
    }

    public function pushTokenUpdate()
    {
        $data = $this->input();
        $token = (string)($data['push_token'] ?? '');

        if (!$token) {
            return $this->fail('VALIDATION_ERROR', 'Push token required');
        }

        $deviceId = $this->user()['device_id'] ?? null;
        if (!$deviceId) {
            return $this->fail('NOT_FOUND', 'Device not registered for this session', 404);
        }

        db_connect()->table('devices')->where('id', $deviceId)->update([
            'push_token'   => substr($token, 0, 255),
            'last_seen_at' => date('Y-m-d H:i:s'),
        ]);

        return $this->response->setJSON(['ok' => true]);
    }

    public function pushTokenDelete()
    {
        $deviceId = $this->user()['device_id'] ?? null;
        if ($deviceId) {
            db_connect()->table('devices')->where('id', $deviceId)->update([
                'push_token'   => null,
                'last_seen_at' => date('Y-m-d H:i:s'),
            ]);
        }

        return $this->response->setJSON(['ok' => true]);
    }
}
