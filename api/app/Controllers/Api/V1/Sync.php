<?php

namespace App\Controllers\Api\V1;

use App\Services\SyncService;

class Sync extends ApiController
{
    private function syncService(): SyncService
    {
        return new SyncService(db_connect());
    }

    public function push()
    {
        $user = $this->user();
        $input = $this->input();

        $changes = $input['changes'] ?? $input;
        if (!is_array($changes)) {
            return $this->fail('INVALID_PAYLOAD', 'Payload must contain changes object', 400);
        }

        $result = $this->syncService()->push((int)$user['id'], $changes);
        return $this->response->setJSON($result);
    }

    public function pull()
    {
        $user = $this->user();
        $sinceParam = $this->request->getGet('since');
        if ($sinceParam === null) {
            parse_str($this->request->getUri()->getQuery(), $parsed);
            $sinceParam = $parsed['since'] ?? null;
        }
        $limitParam = $this->request->getGet('limit');
        if ($limitParam === null) {
            if (!isset($parsed)) {
                parse_str($this->request->getUri()->getQuery(), $parsed);
            }
            $limitParam = $parsed['limit'] ?? null;
        }

        $since = (int)($sinceParam ?? 0);
        $limit = (int)($limitParam ?? 500);

        $result = $this->syncService()->pull((int)$user['id'], $since, $limit);
        return $this->response->setJSON($result);
    }
}
