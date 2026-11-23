<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;

class SyncService
{
    private const SYNCABLE_TABLES = [
        'books' => [
            'columns' => ['id', 'user_id', 'name', 'icon', 'color', 'currency', 'is_default', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['is_default' => 0],
        ],
        'book_members' => [
            'columns' => ['id', 'book_id', 'user_id', 'role', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['role' => 'owner'],
        ],
        'accounts' => [
            'columns' => ['id', 'user_id', 'book_id', 'name', 'type', 'provider', 'currency', 'opening_balance', 'color', 'icon', 'include_in_total', 'is_archived', 'sort_order', 'credit_limit', 'statement_day', 'due_day', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['opening_balance' => 0, 'include_in_total' => 1, 'is_archived' => 0, 'sort_order' => 0],
        ],
        'categories' => [
            'columns' => ['id', 'user_id', 'book_id', 'name', 'i18n_key', 'kind', 'parent_id', 'icon', 'color', 'sort_order', 'is_default', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['sort_order' => 0, 'is_default' => 0],
        ],
        'tags' => [
            'columns' => ['id', 'user_id', 'book_id', 'name', 'color', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => [],
        ],
        'people' => [
            'columns' => ['id', 'user_id', 'book_id', 'name', 'phone', 'note', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['note' => ''],
        ],
        'debts' => [
            'columns' => ['id', 'user_id', 'book_id', 'person_id', 'direction', 'amount', 'currency', 'date', 'due_date', 'interest_rate_bps', 'note', 'settled_at', 'write_off_amount', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['interest_rate_bps' => 0, 'note' => '', 'write_off_amount' => 0],
        ],
        'debt_entries' => [
            'columns' => ['id', 'user_id', 'book_id', 'debt_id', 'kind', 'amount', 'currency', 'account_id', 'occurred_at', 'note', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['note' => ''],
        ],
        'debt_installments' => [
            'columns' => ['id', 'user_id', 'book_id', 'debt_id', 'due_date', 'amount', 'paid_amount', 'paid_event_id', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['paid_amount' => 0],
        ],
        'transactions' => [
            'columns' => ['id', 'user_id', 'book_id', 'type', 'amount', 'currency', 'account_id', 'to_account_id', 'fee', 'exchange_rate', 'category_id', 'occurred_at', 'note', 'parent_id', 'recurring_rule_id', 'goal_id', 'asset_id', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['fee' => 0, 'exchange_rate' => null, 'note' => '', 'recurring_rule_id' => null, 'goal_id' => null, 'asset_id' => null],
        ],
        'favorites' => [
            'columns' => ['id', 'user_id', 'book_id', 'name', 'type', 'amount', 'account_id', 'category_id', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => [],
        ],
        'attachments' => [
            'columns' => ['id', 'user_id', 'book_id', 'entity_type', 'entity_id', 'kind', 'mime', 'size', 'original_name', 'sha256', 'width', 'height', 'remote_id', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => [],
        ],
        'documents' => [
            'columns' => ['id', 'user_id', 'book_id', 'title', 'folder', 'date', 'expiry_date', 'tags', 'note', 'entity_type', 'entity_id', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['note' => ''],
        ],
        'recurring_rules' => [
            'columns' => ['id', 'user_id', 'book_id', 'name', 'type', 'amount', 'currency', 'account_id', 'to_account_id', 'category_id', 'person_id', 'note', 'frequency', 'interval_step', 'by_day', 'start_date', 'end_date', 'max_count', 'current_count', 'mode', 'next_run_at', 'is_subscription', 'icon', 'color', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['interval_step' => 1, 'current_count' => 0, 'mode' => 'remind', 'is_subscription' => 0, 'note' => ''],
        ],
        'budgets' => [
            'columns' => ['id', 'user_id', 'book_id', 'category_id', 'amount', 'currency', 'period', 'rollover', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['period' => 'monthly', 'rollover' => 0],
        ],
        'goals' => [
            'columns' => ['id', 'user_id', 'book_id', 'name', 'icon', 'color', 'target_amount', 'currency', 'target_date', 'linked_account_id', 'current_amount', 'achieved_at', 'note', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['current_amount' => 0, 'note' => ''],
        ],
        'assets' => [
            'columns' => ['id', 'user_id', 'book_id', 'type', 'name', 'institution', 'principal', 'current_value', 'profit_rate', 'start_date', 'maturity_date', 'unit', 'currency', 'note', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['principal' => 0, 'current_value' => 0, 'profit_rate' => null, 'maturity_date' => null, 'unit' => null, 'note' => ''],
        ],
        'asset_valuations' => [
            'columns' => ['id', 'user_id', 'book_id', 'asset_id', 'date', 'value', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['value' => 0],
        ],
        'exchange_rates' => [
            'columns' => ['id', 'user_id', 'book_id', 'base', 'quote', 'rate', 'date', 'source', 'created_at', 'updated_at', 'deleted_at', 'server_rev'],
            'defaults' => ['source' => 'server'],
        ],
    ];

    public function __construct(private readonly BaseConnection $db) {}

    public function getCurrentRevision(int $userId): int
    {
        $row = $this->db->table('user_sync_revisions')->select('current_rev')->where('user_id', $userId)->get()->getRowArray();
        return (int)($row['current_rev'] ?? 0);
    }

    private function nextRevision(int $userId): int
    {
        $this->db->query(
            "INSERT INTO user_sync_revisions (user_id, current_rev) VALUES (?, 1) ON DUPLICATE KEY UPDATE current_rev = current_rev + 1",
            [$userId]
        );
        $row = $this->db->query("SELECT current_rev FROM user_sync_revisions WHERE user_id = ?", [$userId])->getRowArray();
        return (int)($row['current_rev'] ?? 1);
    }

    public function push(int $userId, array $changes): array
    {
        $nowMs = (int)(microtime(true) * 1000);
        $maxAllowedFuture = $nowMs + 60000; // clamp far future timestamps (> 1 min)

        $this->db->transStart();

        $currentRev = $this->nextRevision($userId);
        $accepted = [];
        $conflicts = [];

        // 1. Process standard entity tables
        foreach (self::SYNCABLE_TABLES as $table => $meta) {
            if (empty($changes[$table]) || !is_array($changes[$table])) {
                continue;
            }

            $accepted[$table] = [];
            $conflicts[$table] = [];

            foreach ($changes[$table] as $raw) {
                if (!is_array($raw) || empty($raw['id'])) {
                    continue;
                }

                $id = trim((string)$raw['id']);
                if (strlen($id) > 36) {
                    continue;
                }

                $incomingUpdatedAt = (int)($raw['updated_at'] ?? $nowMs);
                $clampedUpdatedAt = min($incomingUpdatedAt, $maxAllowedFuture);
                $createdAt = (int)($raw['created_at'] ?? $nowMs);
                $deletedAt = !empty($raw['deleted_at']) ? (int)$raw['deleted_at'] : null;

                // Check existing record. Authorization uses the stored book,
                // never a book id supplied only to borrow someone else's membership.
                $existing = $this->db->table($table)->where('id', $id)->get()->getRowArray();
                $authBookId = is_array($existing)
                    ? ($existing['book_id'] ?? ($raw['book_id'] ?? null))
                    : ($raw['book_id'] ?? null);

                if ($table === 'books') {
                    if ($existing && (int)$existing['user_id'] !== $userId) {
                        $conflicts[$table][] = ['id' => $id, 'reason' => 'OWNERSHIP_MISMATCH'];
                        continue;
                    }
                } elseif ($table === 'book_members') {
                    if (!$this->ownsBook($userId, (string)($authBookId ?? ''))) {
                        if (!$existing || (int)$existing['user_id'] !== $userId) {
                            $conflicts[$table][] = ['id' => $id, 'reason' => 'OWNERSHIP_MISMATCH'];
                            continue;
                        }
                        $raw['role'] = $existing['role'];
                    }
                } elseif (!$this->mayWriteBook($userId, $authBookId === null ? null : (string)$authBookId)) {
                    $conflicts[$table][] = ['id' => $id, 'reason' => 'OWNERSHIP_MISMATCH'];
                    continue;
                } elseif ($existing && (int)$existing['user_id'] !== $userId && !$this->mayWriteBook($userId, (string)($existing['book_id'] ?? ''))) {
                    $conflicts[$table][] = ['id' => $id, 'reason' => 'OWNERSHIP_MISMATCH'];
                    continue;
                }

                if ($existing) {

                    // Conflict resolution: Last-write-wins by updated_at
                    if ((int)$existing['updated_at'] > $incomingUpdatedAt) {
                        $conflicts[$table][] = [
                            'id' => $id,
                            'server_rev' => (int)$existing['server_rev'],
                            'server_updated_at' => (int)$existing['updated_at'],
                        ];
                        continue;
                    }

                    // Build update data filtered by allowed columns
                    $updateData = [];
                    foreach ($meta['columns'] as $col) {
                        if ($col === 'id' || $col === 'user_id') {
                            continue;
                        }
                        if ($col === 'server_rev') {
                            $updateData['server_rev'] = $currentRev;
                        } elseif ($col === 'updated_at') {
                            $updateData['updated_at'] = $clampedUpdatedAt;
                        } elseif ($col === 'deleted_at') {
                            $updateData['deleted_at'] = $deletedAt;
                        } elseif (array_key_exists($col, $raw)) {
                            $val = $raw[$col];
                            if ($val === null && isset($meta['defaults'][$col])) {
                                $val = $meta['defaults'][$col];
                            }
                            $updateData[$col] = $val;
                        }
                    }

                    $update = $this->db->table($table)->where('id', $id);
                    if ((int)$existing['user_id'] === $userId) {
                        $update->where('user_id', $userId);
                    } elseif (isset($existing['book_id'])) {
                        $update->where('book_id', $existing['book_id']);
                    }
                    $update->update($updateData);
                    $accepted[$table][] = [
                        'id' => $id,
                        'server_rev' => $currentRev,
                        'updated_at' => $clampedUpdatedAt,
                    ];
                } else {
                    // Insert new record
                    $insertData = [
                        'id' => $id,
                        'user_id' => $userId,
                        'server_rev' => $currentRev,
                        'created_at' => $createdAt,
                        'updated_at' => $clampedUpdatedAt,
                        'deleted_at' => $deletedAt,
                    ];

                    foreach ($meta['columns'] as $col) {
                        if (in_array($col, ['id', 'user_id', 'server_rev', 'created_at', 'updated_at', 'deleted_at'], true)) {
                            continue;
                        }
                        if (array_key_exists($col, $raw)) {
                            $val = $raw[$col];
                            if ($val === null && isset($meta['defaults'][$col])) {
                                $val = $meta['defaults'][$col];
                            }
                            $insertData[$col] = $val;
                        } elseif (isset($meta['defaults'][$col])) {
                            $insertData[$col] = $meta['defaults'][$col];
                        } else {
                            $insertData[$col] = null;
                        }
                    }

                    $this->db->table($table)->insert($insertData);
                    $accepted[$table][] = [
                        'id' => $id,
                        'server_rev' => $currentRev,
                        'updated_at' => $clampedUpdatedAt,
                    ];
                }
            }
        }

        // 2. Process transaction_tags junction
        if (!empty($changes['transaction_tags']) && is_array($changes['transaction_tags'])) {
            $accepted['transaction_tags'] = [];
            foreach ($changes['transaction_tags'] as $tt) {
                if (empty($tt['transaction_id']) || empty($tt['tag_id'])) {
                    continue;
                }
                $tId = trim((string)$tt['transaction_id']);
                $tagId = trim((string)$tt['tag_id']);
                $createdAt = (int)($tt['created_at'] ?? $nowMs);
                $deletedAt = !empty($tt['deleted_at']) ? (int)$tt['deleted_at'] : null;

                $existing = $this->db->table('transaction_tags')
                    ->where('transaction_id', $tId)
                    ->where('tag_id', $tagId)
                    ->get()
                    ->getRowArray();

                if ($existing) {
                    if ((int)$existing['user_id'] === $userId) {
                        $this->db->table('transaction_tags')
                            ->where('transaction_id', $tId)
                            ->where('tag_id', $tagId)
                            ->update([
                                'deleted_at' => $deletedAt,
                                'server_rev' => $currentRev,
                            ]);
                        $accepted['transaction_tags'][] = [
                            'transaction_id' => $tId,
                            'tag_id' => $tagId,
                            'server_rev' => $currentRev,
                        ];
                    }
                } else {
                    $this->db->table('transaction_tags')->insert([
                        'transaction_id' => $tId,
                        'tag_id' => $tagId,
                        'user_id' => $userId,
                        'created_at' => $createdAt,
                        'deleted_at' => $deletedAt,
                        'server_rev' => $currentRev,
                    ]);
                    $accepted['transaction_tags'][] = [
                        'transaction_id' => $tId,
                        'tag_id' => $tagId,
                        'server_rev' => $currentRev,
                    ];
                }
            }
        }

        // 3. Process user_settings
        if (isset($changes['user_settings']) && is_array($changes['user_settings'])) {
            $settingsJson = is_string($changes['user_settings']['settings_json'] ?? null)
                ? $changes['user_settings']['settings_json']
                : json_encode($changes['user_settings']);
            $incomingUpdatedAt = (int)($changes['user_settings']['updated_at'] ?? $nowMs);
            $clampedUpdatedAt = min($incomingUpdatedAt, $maxAllowedFuture);

            $existing = $this->db->table('user_settings')->where('user_id', $userId)->get()->getRowArray();
            if ($existing) {
                if ((int)$existing['updated_at'] <= $incomingUpdatedAt) {
                    $this->db->table('user_settings')->where('user_id', $userId)->update([
                        'settings_json' => $settingsJson,
                        'updated_at' => $clampedUpdatedAt,
                        'server_rev' => $currentRev,
                    ]);
                    $accepted['user_settings'] = [
                        'server_rev' => $currentRev,
                        'updated_at' => $clampedUpdatedAt,
                    ];
                }
            } else {
                $this->db->table('user_settings')->insert([
                    'user_id' => $userId,
                    'settings_json' => $settingsJson,
                    'updated_at' => $clampedUpdatedAt,
                    'server_rev' => $currentRev,
                ]);
                $accepted['user_settings'] = [
                    'server_rev' => $currentRev,
                    'updated_at' => $clampedUpdatedAt,
                ];
            }
        }

        $this->db->transComplete();

        return [
            'ok' => true,
            'server_rev' => $currentRev,
            'accepted' => $accepted,
            'conflicts' => $conflicts,
        ];
    }

    public function pull(int $userId, int $since = 0, int $limit = 500): array
    {
        $since = max(0, $since);
        $limit = min(500, max(1, $limit));

        $changes = [];
        $totalFetched = 0;
        $maxRev = $since;

        foreach (self::SYNCABLE_TABLES as $table => $meta) {
            $remaining = $limit - $totalFetched;
            if ($remaining <= 0) {
                break;
            }

            $rows = $this->db->table($table)
                ->where('user_id', $userId)
                ->where('server_rev >', $since)
                ->orderBy('server_rev', 'ASC')
                ->limit($remaining)
                ->get()
                ->getResultArray();

            if (!empty($rows)) {
                $changes[$table] = $rows;
                $totalFetched += count($rows);
                foreach ($rows as $r) {
                    if ((int)$r['server_rev'] > $maxRev) {
                        $maxRev = (int)$r['server_rev'];
                    }
                }
            } else {
                $changes[$table] = [];
            }
        }

        // Transaction tags
        if ($totalFetched < $limit) {
            $remaining = $limit - $totalFetched;
            $ttRows = $this->db->table('transaction_tags')
                ->where('user_id', $userId)
                ->where('server_rev >', $since)
                ->orderBy('server_rev', 'ASC')
                ->limit($remaining)
                ->get()
                ->getResultArray();

            $changes['transaction_tags'] = $ttRows ?: [];
            $totalFetched += count($changes['transaction_tags']);
            foreach ($changes['transaction_tags'] as $r) {
                if ((int)$r['server_rev'] > $maxRev) {
                    $maxRev = (int)$r['server_rev'];
                }
            }
        } else {
            $changes['transaction_tags'] = [];
        }

        // User settings
        $settings = $this->db->table('user_settings')
            ->where('user_id', $userId)
            ->where('server_rev >', $since)
            ->get()
            ->getRowArray();

        if ($settings) {
            $changes['user_settings'] = $settings;
            if ((int)$settings['server_rev'] > $maxRev) {
                $maxRev = (int)$settings['server_rev'];
            }
        } else {
            $changes['user_settings'] = null;
        }

        $currentRev = $this->getCurrentRevision($userId);
        if ($maxRev < $currentRev && $totalFetched === 0) {
            $maxRev = $currentRev;
        }

        return [
            'changes' => $changes,
            'latest_rev' => $maxRev,
            'has_more' => ($totalFetched >= $limit),
        ];
    }

    private function ownsBook(int $userId, string $bookId): bool
    {
        if ($bookId === '' || !$this->db->tableExists('books')) {
            return false;
        }

        $book = $this->db->table('books')->where('id', $bookId)->where('deleted_at', null)->get()->getRowArray();

        return $book !== null && (int)$book['user_id'] === $userId;
    }

    private function mayWriteBook(int $userId, ?string $bookId): bool
    {
        if ($bookId === null || $bookId === '') {
            return false;
        }

        if ($this->ownsBook($userId, $bookId)) {
            return true;
        }

        if (!$this->db->tableExists('book_members')) {
            return false;
        }

        $membership = $this->db->table('book_members')
            ->where('book_id', $bookId)
            ->where('user_id', $userId)
            ->where('deleted_at', null)
            ->get()
            ->getRowArray();

        return $membership !== null && in_array($membership['role'], ['owner', 'editor'], true);
    }
}
