<?php

namespace App\Controllers\Admin;

use App\Services\AdminService;
use App\Services\PushQueueService;

class Push extends AdminApiController
{
    public function index()
    {
        $db = db_connect();
        $page = max(1, (int)$this->request->getGet('page'));
        $perPage = min(100, max(10, (int)$this->request->getGet('per_page') ?: 20));
        $status = (string)$this->request->getGet('status');
        $query = $db->table('push_campaigns');
        if (in_array($status, ['draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'], true)) {
            $query->where('status', $status);
        }
        $total = (clone $query)->countAllResults();
        $rows = $query->orderBy('id', 'DESC')->limit($perPage, ($page - 1) * $perPage)->get()->getResultArray();
        foreach ($rows as &$row) {
            $targeted = (int)$db->table('push_deliveries')->where('campaign_id', $row['id'])->countAllResults();
            $opened = (int)$db->table('push_events')->where('campaign_id', $row['id'])->countAllResults();
            $row['targeted'] = $targeted;
            $row['opened'] = $opened;
            $row['open_rate'] = $targeted > 0 ? round($opened / $targeted, 4) : 0;
            unset($row['target_filters']);
        }
        return $this->ok([
            'data' => $rows,
            'templates' => $db->table('push_templates')->orderBy('id', 'DESC')->limit(100)->get()->getResultArray(),
            'automations' => $db->tableExists('push_automations')
                ? $db->table('push_automations')->orderBy('id', 'DESC')->get()->getResultArray()
                : [],
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => (int)ceil($total / $perPage),
            ],
        ]);
    }

    public function estimate()
    {
        $campaign = $this->campaignFromInput($this->input());
        if ($campaign instanceof \CodeIgniter\HTTP\ResponseInterface) {
            return $campaign;
        }
        $estimate = (new PushQueueService())->estimateAudience($campaign + ['status' => 'draft']);
        return $this->ok(['estimate' => $estimate]);
    }

    public function store()
    {
        $input = $this->input();
        $campaign = $this->campaignFromInput($input);
        if ($campaign instanceof \CodeIgniter\HTTP\ResponseInterface) {
            return $campaign;
        }
        $when = (string)($input['when'] ?? 'draft');
        if (!in_array($when, ['draft', 'now', 'schedule'], true)) {
            return $this->fail('VALIDATION_ERROR', 'Choose draft, now, or schedule', 422);
        }
        if ($campaign['target'] === 'all' && !$this->canSendAll()) {
            return $this->fail('FORBIDDEN', 'Sending to all users needs the push.send_all permission', 403);
        }
        if ($when !== 'draft' && $campaign['target'] === 'all') {
            if (!(new AdminService())->verifyPassword((int)$this->admin()['id'], (string)($input['current_password'] ?? ''))) {
                return $this->fail('REAUTH_REQUIRED', 'Re-enter your password to send to all users', 403);
            }
        }
        $campaign['status'] = $when === 'schedule' ? 'scheduled' : ($when === 'now' ? 'sending' : 'draft');
        $campaign['scheduled_at'] = $when === 'schedule' ? $this->scheduleTime($input) : ($when === 'now' ? date('Y-m-d H:i:s') : null);
        if ($when === 'schedule' && !$campaign['scheduled_at']) {
            return $this->fail('VALIDATION_ERROR', 'A schedule time is required', 422);
        }
        $campaign['created_by'] = (int)$this->admin()['id'];
        $db = db_connect();
        $db->table('push_campaigns')->insert($campaign);
        $id = (int)$db->insertID();
        if ($when === 'now') {
            $row = $db->table('push_campaigns')->where('id', $id)->get()->getRowArray();
            (new PushQueueService($db))->enqueue($row);
        }
        $this->audit('push_campaign_saved', "campaign:{$id}", ['status' => $campaign['status'], 'target' => $campaign['target']]);
        return $this->ok(['id' => $id, 'status' => $campaign['status']]);
    }

    public function cancel($id)
    {
        $db = db_connect();
        $row = $db->table('push_campaigns')->where('id', (int)$id)->get()->getRowArray();
        if (!$row) {
            return $this->fail('NOT_FOUND', 'Campaign not found', 404);
        }
        if (!in_array($row['status'], ['draft', 'scheduled'], true)) {
            return $this->fail('CONFLICT', 'Only a draft or scheduled campaign can be cancelled', 409);
        }
        $db->table('push_campaigns')->where('id', (int)$id)->update(['status' => 'cancelled']);
        $this->audit('push_campaign_cancelled', "campaign:{$id}");
        return $this->ok(['status' => 'cancelled']);
    }

    public function duplicate($id)
    {
        $db = db_connect();
        $row = $db->table('push_campaigns')->where('id', (int)$id)->get()->getRowArray();
        if (!$row) {
            return $this->fail('NOT_FOUND', 'Campaign not found', 404);
        }
        unset($row['id'], $row['sent_at'], $row['sent_count'], $row['failed_count'], $row['opened_count'], $row['created_at'], $row['updated_at']);
        $row['status'] = 'draft';
        $row['scheduled_at'] = null;
        $row['created_by'] = (int)$this->admin()['id'];
        $db->table('push_campaigns')->insert($row);
        $newId = (int)$db->insertID();
        $this->audit('push_campaign_duplicated', "campaign:{$newId}", ['from' => (int)$id]);
        return $this->ok(['id' => $newId]);
    }

    public function saveTemplate()
    {
        $input = $this->input();
        $name = trim((string)($input['name'] ?? ''));
        $campaign = $this->campaignFromInput($input);
        if ($campaign instanceof \CodeIgniter\HTTP\ResponseInterface) {
            return $campaign;
        }
        if ($name === '') {
            return $this->fail('VALIDATION_ERROR', 'Template name is required', 422);
        }
        $db = db_connect();
        $db->table('push_templates')->insert([
            'name' => mb_substr($name, 0, 80),
            'category' => $campaign['category'],
            'title_en' => $campaign['title_en'],
            'title_bn' => $campaign['title_bn'],
            'body_en' => $campaign['body_en'],
            'body_bn' => $campaign['body_bn'],
            'logo_mode' => $campaign['logo_mode'],
            'action_type' => $campaign['action_type'],
            'action_value' => $campaign['action_value'],
            'created_by' => (int)$this->admin()['id'],
        ]);
        $id = (int)$db->insertID();
        $this->audit('push_template_saved', "template:{$id}");
        return $this->ok(['id' => $id]);
    }

    public function saveAutomation()
    {
        if (!$this->service()->hasPermission($this->admin(), 'push.automations')) {
            return $this->fail('FORBIDDEN', 'Automation permission is required', 403);
        }
        $input = $this->input();
        $rule = (string)($input['rule'] ?? '');
        if (!in_array($rule, ['inactive_days', 'no_records', 'old_version', 'no_sync'], true)) {
            return $this->fail('VALIDATION_ERROR', 'Unknown automation rule', 422);
        }
        $templateId = (int)($input['template_id'] ?? 0);
        $db = db_connect();
        if (!$db->table('push_templates')->where('id', $templateId)->countAllResults()) {
            return $this->fail('VALIDATION_ERROR', 'Choose a template', 422);
        }
        $cap = min(7, max(1, (int)($input['cap_per_week'] ?? 2)));
        $db->table('push_automations')->insert([
            'name' => mb_substr(trim((string)($input['name'] ?? 'Automation')), 0, 80),
            'enabled' => !empty($input['enabled']) ? 1 : 0,
            'template_id' => $templateId,
            'rule' => $rule,
            'rule_value' => mb_substr(trim((string)($input['rule_value'] ?? '7')), 0, 40),
            'cap_per_week' => $cap,
        ]);
        $id = (int)$db->insertID();
        $this->audit('push_automation_saved', "automation:{$id}", ['rule' => $rule]);
        return $this->ok(['id' => $id]);
    }

    public function uploadImage()
    {
        $file = $this->request->getFile('image');
        if (!$file || !$file->isValid()) {
            return $this->fail('VALIDATION_ERROR', 'Choose an image', 422);
        }
        $info = @getimagesize($file->getTempName());
        if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
            return $this->fail('VALIDATION_ERROR', 'Use a JPEG, PNG, or WebP image', 422);
        }
        if (!function_exists('imagecreatetruecolor')) {
            return $this->fail('UNAVAILABLE', 'Image resizing is not available on this server', 500);
        }
        $src = match ($info[2]) {
            IMAGETYPE_JPEG => imagecreatefromjpeg($file->getTempName()),
            IMAGETYPE_PNG => imagecreatefrompng($file->getTempName()),
            default => imagecreatefromwebp($file->getTempName()),
        };
        if (!$src) {
            return $this->fail('VALIDATION_ERROR', 'Could not read that image', 422);
        }
        $canvas = imagecreatetruecolor(1024, 512);
        imagecopyresampled($canvas, $src, 0, 0, 0, 0, 1024, 512, imagesx($src), imagesy($src));
        imagedestroy($src);
        $dir = FCPATH . 'uploads/push';
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            imagedestroy($canvas);
            return $this->fail('UNAVAILABLE', 'Could not store the image', 500);
        }
        $name = bin2hex(random_bytes(16)) . '.jpg';
        $path = $dir . '/' . $name;
        $quality = 85;
        do {
            imagejpeg($canvas, $path, $quality);
            $quality -= 10;
        } while (filesize($path) > 300 * 1024 && $quality >= 45);
        imagedestroy($canvas);
        if (filesize($path) > 300 * 1024) {
            @unlink($path);
            return $this->fail('VALIDATION_ERROR', 'Image is still over 300 KB after resizing', 422);
        }
        $this->audit('push_image_uploaded', $name);
        return $this->ok(['url' => rtrim(base_url(), '/') . '/uploads/push/' . $name]);
    }

    private function canSendAll(): bool
    {
        return $this->service()->hasPermission($this->admin(), 'push.send_all');
    }

    private function scheduleTime(array $input): ?string
    {
        $raw = trim((string)($input['scheduled_at'] ?? ''));
        if ($raw === '') {
            return null;
        }
        $stamp = strtotime($raw);
        return $stamp ? date('Y-m-d H:i:s', $stamp) : null;
    }

    /** @return array<string, mixed>|\CodeIgniter\HTTP\ResponseInterface */
    private function campaignFromInput(array $input)
    {
        $category = (string)($input['category'] ?? 'announcement');
        $target = (string)($input['target'] ?? 'all');
        $logo = (string)($input['logo_mode'] ?? 'none');
        $action = (string)($input['action_type'] ?? 'open_app');
        $title = trim((string)($input['title_en'] ?? ''));
        $body = trim((string)($input['body_en'] ?? ''));
        if (!in_array($category, ['announcement', 'offer', 'update', 'security'], true)) {
            return $this->fail('VALIDATION_ERROR', 'Unknown push category', 422);
        }
        if (!in_array($target, ['all', 'user', 'selected', 'segment'], true)) {
            return $this->fail('VALIDATION_ERROR', 'Unknown push target', 422);
        }
        if (!in_array($logo, ['none', 'app', 'custom'], true) || !in_array($action, ['open_app', 'screen', 'url'], true)) {
            return $this->fail('VALIDATION_ERROR', 'Unknown logo or tap action', 422);
        }
        if ($title === '' || $body === '' || strlen($title) > 150) {
            return $this->fail('VALIDATION_ERROR', 'English title and body are required', 422);
        }
        $filters = [];
        if ($target === 'user') {
            $filters['user_id'] = (int)($input['user_id'] ?? 0);
            if ($filters['user_id'] <= 0) {
                return $this->fail('VALIDATION_ERROR', 'Choose a user', 422);
            }
        } elseif ($target === 'selected') {
            $filters['user_ids'] = array_values(array_filter(array_map('intval', (array)($input['user_ids'] ?? []))));
            if (!$filters['user_ids']) {
                return $this->fail('VALIDATION_ERROR', 'Choose at least one user', 422);
            }
        } elseif ($target === 'segment') {
            foreach (['platform', 'language', 'country', 'app_version', 'signup_from', 'signup_to'] as $key) {
                if (!empty($input[$key])) {
                    $filters[$key] = mb_substr(trim((string)$input[$key]), 0, 40);
                }
            }
            foreach (['active_within_days', 'inactive_for_days'] as $key) {
                if (!empty($input[$key])) {
                    $filters[$key] = min(3650, max(1, (int)$input[$key]));
                }
            }
            if (!empty($input['phones'])) {
                $phones = is_array($input['phones']) ? $input['phones'] : preg_split('/[\s,]+/', (string)$input['phones']);
                $filters['phones'] = array_values(array_filter(array_map('strval', $phones ?: [])));
            }
        }
        return [
            'category' => $category,
            'title_en' => $title,
            'title_bn' => trim((string)($input['title_bn'] ?? '')) ?: null,
            'body_en' => $body,
            'body_bn' => trim((string)($input['body_bn'] ?? '')) ?: null,
            'image_url' => trim((string)($input['image_url'] ?? '')) ?: null,
            'logo_mode' => $logo,
            'logo_url' => trim((string)($input['logo_url'] ?? '')) ?: null,
            'action_type' => $action,
            'action_value' => trim((string)($input['action_value'] ?? '')) ?: null,
            'target' => $target,
            'target_filters' => json_encode($filters),
        ];
    }
}
