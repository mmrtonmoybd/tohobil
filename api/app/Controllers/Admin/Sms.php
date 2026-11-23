<?php

namespace App\Controllers\Admin;

class Sms extends AdminApiController
{
    public function index()
    {
        $db = db_connect();
        $rows = $db->tableExists('sms_log')
            ? $db->table('sms_log')->orderBy('id', 'DESC')->limit(100)->get()->getResultArray()
            : [];
        $today = $db->tableExists('sms_log')
            ? (int)$db->table('sms_log')->where('created_at >=', date('Y-m-d 00:00:00'))->countAllResults()
            : 0;
        $config = [];
        foreach ($db->table('app_config')->whereIn('config_key', ['sms_driver', 'sms_sender'])->get()->getResultArray() as $row) {
            $config[$row['config_key']] = $row['config_value'];
        }
        return $this->ok([
            'driver' => $config['sms_driver'] ?? 'log',
            'sender' => $config['sms_sender'] ?? 'Tohobil',
            'sent_today' => $today,
            'log' => $rows,
        ]);
    }

    public function test()
    {
        $input = $this->input();
        $phone = preg_replace('/\s+/', '', (string)($input['phone'] ?? '')) ?? '';
        if (!preg_match('/^\+[1-9]\d{7,14}$/', $phone)) {
            return $this->fail('VALIDATION_ERROR', 'Use an E.164 phone number', 422);
        }
        $db = db_connect();
        $db->table('sms_log')->insert([
            'phone' => $phone,
            'purpose' => 'test',
            'masked_body' => 'Tohobil test code ******',
            'status' => 'logged',
        ]);
        $this->audit('sms_test_sent', $phone);
        return $this->ok(['status' => 'logged', 'message' => 'Development SMS driver stored a masked test message']);
    }
}
