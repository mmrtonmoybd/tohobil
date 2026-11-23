<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;

class Identity
{
    public function __construct(private readonly BaseConnection $db) {}

    public static function phone(string $value): ?string
    {
        $value = strtr(trim($value), ['০'=>'0','১'=>'1','২'=>'2','৩'=>'3','৪'=>'4','৫'=>'5','৬'=>'6','৭'=>'7','৮'=>'8','৯'=>'9']);
        $value = preg_replace('/[\s()\-]/', '', $value);
        if (preg_match('/^01[3-9]\d{8}$/', $value)) $value = '+88' . $value;
        return preg_match('/^\+[1-9]\d{7,14}$/', $value) ? $value : null;
    }

    public function config(string $key, string $fallback = ''): string
    {
        return (string)($this->db->table('app_config')->select('config_value')->where('config_key', $key)->get()->getRowArray()['config_value'] ?? $fallback);
    }

    public function userForToken(?string $token): ?array
    {
        if (!$token || !preg_match('/^[a-f0-9]{64}$/', $token)) return null;
        $row = $this->db->table('auth_tokens t')->select('t.id token_id,t.device_id,t.expires_at,u.*')
            ->join('users u', 'u.id=t.user_id')->where('t.token_hash', hash('sha256', $token))
            ->where('t.revoked_at', null)->where('t.expires_at >', date('Y-m-d H:i:s'))->get()->getRowArray();
        return $row ?: null;
    }

    public function blocked(string $type, ?string $value): ?array
    {
        if (!$value) return null;
        $query = $this->db->table('blocklist')->where('type', $type)->where('value', $value)
            ->groupStart()->where('expires_at', null)->orWhere('expires_at >', date('Y-m-d H:i:s'))->groupEnd();
        return $query->get()->getRowArray() ?: null;
    }

    public function ipBlocked(string $ip): ?array
    {
        if ($match = $this->blocked('ip', $ip)) return $match;
        foreach ($this->db->table('blocklist')->where('type', 'cidr')->groupStart()->where('expires_at', null)->orWhere('expires_at >', date('Y-m-d H:i:s'))->groupEnd()->get()->getResultArray() as $entry) {
            if (self::inCidr($ip, $entry['value'])) return $entry;
        }
        return null;
    }

    public static function inCidr(string $ip, string $cidr): bool
    {
        $parts = explode('/', $cidr, 2);
        if (count($parts) !== 2 || !ctype_digit($parts[1])) return false;
        $address = inet_pton($ip); $network = inet_pton($parts[0]);
        if ($address === false || $network === false || strlen($address) !== strlen($network)) return false;
        $bits = (int)$parts[1];
        if ($bits < 0 || $bits > strlen($address) * 8) return false;
        $whole = intdiv($bits, 8); $rest = $bits % 8;
        return substr($address, 0, $whole) === substr($network, 0, $whole)
            && (!$rest || (ord($address[$whole]) & (0xff << (8 - $rest))) === (ord($network[$whole]) & (0xff << (8 - $rest))));
    }

    public function issueToken(int $userId, ?int $deviceId = null): string
    {
        $token = bin2hex(random_bytes(32));
        $this->db->table('auth_tokens')->insert(['user_id'=>$userId,'device_id'=>$deviceId,'token_hash'=>hash('sha256',$token),'expires_at'=>date('Y-m-d H:i:s', time()+60*60*24*30)]);
        return $token;
    }

    public function audit(?int $userId, string $event, string $ip, ?string $details = null): void
    {
        $this->db->table('audit_log')->insert(['user_id'=>$userId,'event'=>$event,'ip'=>$ip,'details'=>$details]);
    }

    public function requestDeletion(int $userId): void
    {
        if (!$this->db->fieldExists('deletion_requested_at', 'users')) {
            $this->purgeUser($userId);
            return;
        }
        $existing = $this->db->table('users')->select('deletion_requested_at')->where('id', $userId)->get()->getRowArray();
        if (!$existing) {
            return;
        }
        $this->db->table('users')->where('id', $userId)->update([
            'status' => 'disabled',
            'status_reason' => 'Deletion requested',
            'deletion_requested_at' => $existing['deletion_requested_at'] ?: date('Y-m-d H:i:s'),
        ]);
        if ($this->db->tableExists('auth_tokens')) {
            $this->db->table('auth_tokens')->where('user_id', $userId)->delete();
        }
    }

    public function purgeDueDeletions(int $graceDays = 30): int
    {
        if (!$this->db->fieldExists('deletion_requested_at', 'users')) {
            return 0;
        }
        $cutoff = date('Y-m-d H:i:s', time() - max(1, $graceDays) * 86400);
        $rows = $this->db->table('users')->select('id')
            ->where('deletion_requested_at IS NOT NULL', null, false)
            ->where('deletion_requested_at <=', $cutoff)
            ->get()->getResultArray();
        foreach ($rows as $row) {
            $this->purgeUser((int)$row['id']);
        }
        return count($rows);
    }

    public function purgeUser(int $userId): void
    {
        $folder = WRITEPATH . 'uploads/users/' . $userId;
        if (is_dir($folder)) {
            $files = glob($folder . '/*');
            if ($files) {
                foreach ($files as $f) {
                    if (is_file($f)) {
                        @unlink($f);
                    }
                }
            }
            @rmdir($folder);
        }

        // Find all books owned by user
        $bookMembers = $this->db->table('book_members')
            ->where('user_id', $userId)
            ->where('role', 'owner')
            ->get()
            ->getResultArray();
        $bookIds = array_column($bookMembers, 'book_id');

        if (!empty($bookIds)) {
            $tables = ['attachments', 'documents', 'transaction_tags', 'transactions', 'debt_installments', 'debts', 'people', 'budgets', 'goals', 'assets', 'asset_valuations', 'recurring_rules', 'accounts', 'categories', 'tags'];
            foreach ($tables as $table) {
                if ($this->db->tableExists($table)) {
                    $this->db->table($table)->whereIn('book_id', $bookIds)->delete();
                }
            }
            if ($this->db->tableExists('books')) {
                $this->db->table('books')->whereIn('id', $bookIds)->delete();
            }
        }

        $userTables = ['attachments', 'documents', 'book_members', 'user_settings', 'devices', 'auth_tokens', 'otp_codes', 'audit_log'];
        foreach ($userTables as $userTable) {
            if ($this->db->tableExists($userTable)) {
                $this->db->table($userTable)->where('user_id', $userId)->delete();
            }
        }

        $this->db->table('users')->where('id', $userId)->delete();
    }

    public static function publicUser(array $user): array
    {
        return array_intersect_key($user, array_flip(['id','phone','name','email','occupation','birth_date','city','country','currency','language','status','status_reason','photo_path','marketing_push_opt_in']));
    }
}
