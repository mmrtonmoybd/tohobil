<?php

namespace App\Controllers\Admin;

class Announcements extends AdminApiController
{
    public function index()
    {
        $db = db_connect();
        $items = $db->table('announcements')
            ->orderBy('id', 'DESC')
            ->get()
            ->getResultArray();

        return $this->ok([
            'status' => 'ok',
            'data'   => $items,
        ]);
    }

    public function store()
    {
        $input = $this->input();
        $title = trim((string)($input['title'] ?? ''));
        $body = trim((string)($input['body'] ?? ''));

        if (!$title || !$body) {
            return $this->fail('VALIDATION_ERROR', 'Title and body are required', 422);
        }

        $db = db_connect();
        $id = $db->table('announcements')->insert([
            'title'          => $title,
            'body'           => $body,
            'image_url'      => !empty($input['image_url']) ? trim((string)$input['image_url']) : null,
            'action_url'     => !empty($input['action_url']) ? trim((string)$input['action_url']) : null,
            'target_segment' => !empty($input['target_segment']) ? trim((string)$input['target_segment']) : 'all',
            'starts_at'      => !empty($input['starts_at']) ? date('Y-m-d H:i:s', strtotime($input['starts_at'])) : null,
            'ends_at'        => !empty($input['ends_at']) ? date('Y-m-d H:i:s', strtotime($input['ends_at'])) : null,
            'is_active'      => !empty($input['is_active']) ? 1 : 0,
            'dismissible'    => isset($input['dismissible']) ? (int)(bool)$input['dismissible'] : 1,
            'created_at'     => date('Y-m-d H:i:s'),
        ]);

        $this->audit('announcement_created', "announcement:{$id}", ['title' => $title]);

        return $this->ok(['status' => 'ok', 'id' => $id, 'message' => 'Announcement created']);
    }

    public function update($id)
    {
        $db = db_connect();
        $existing = $db->table('announcements')->where('id', (int)$id)->get()->getRowArray();
        if (!$existing) {
            return $this->fail('NOT_FOUND', 'Announcement not found', 404);
        }

        $input = $this->input();
        $update = [];
        if (isset($input['title'])) $update['title'] = trim((string)$input['title']);
        if (isset($input['body'])) $update['body'] = trim((string)$input['body']);
        if (isset($input['image_url'])) $update['image_url'] = trim((string)$input['image_url']) ?: null;
        if (isset($input['action_url'])) $update['action_url'] = trim((string)$input['action_url']) ?: null;
        if (isset($input['target_segment'])) $update['target_segment'] = trim((string)$input['target_segment']);
        if (isset($input['starts_at'])) $update['starts_at'] = $input['starts_at'] ? date('Y-m-d H:i:s', strtotime($input['starts_at'])) : null;
        if (isset($input['ends_at'])) $update['ends_at'] = $input['ends_at'] ? date('Y-m-d H:i:s', strtotime($input['ends_at'])) : null;
        if (isset($input['is_active'])) $update['is_active'] = (int)(bool)$input['is_active'];
        if (isset($input['dismissible'])) $update['dismissible'] = (int)(bool)$input['dismissible'];

        if (!empty($update)) {
            $db->table('announcements')->where('id', (int)$id)->update($update);
            $this->audit('announcement_updated', "announcement:{$id}", $update);
        }

        return $this->ok(['status' => 'ok', 'message' => 'Announcement updated']);
    }

    public function delete($id)
    {
        $db = db_connect();
        $db->table('announcements')->where('id', (int)$id)->delete();
        $this->audit('announcement_deleted', "announcement:{$id}");
        return $this->ok(['status' => 'ok', 'message' => 'Announcement deleted']);
    }
}
