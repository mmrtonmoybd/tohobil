<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;

/**
 * One daily pull of every currency, stored once on the server.
 * Mobile clients read the snapshot. They do not call the provider.
 */
class ExchangeRateService
{
    public function refresh(BaseConnection $db): bool
    {
        if (!$db->tableExists('app_config')) {
            return false;
        }
        $key = $this->apiKey($db, true);
        $rates = $this->fetchUsdRates($key);
        if ($rates === null) {
            return false;
        }
        $db->table('app_config')->replace([
            'config_key' => 'exchange_rate_snapshot',
            'config_value' => json_encode([
                'base' => 'USD',
                'date' => date('Y-m-d'),
                'rates' => $rates,
            ], JSON_UNESCAPED_SLASHES),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return true;
    }

    /**
     * @return array{date: string, rates: array<string, string>}|null
     */
    public function snapshot(BaseConnection $db): ?array
    {
        if (!$db->tableExists('app_config')) {
            return null;
        }
        $row = $db->table('app_config')->select('config_value')
            ->where('config_key', 'exchange_rate_snapshot')
            ->get()->getRowArray();
        $payload = json_decode((string)($row['config_value'] ?? ''), true);
        if (!is_array($payload) || ($payload['base'] ?? '') !== 'USD' || !is_array($payload['rates'] ?? null)) {
            return null;
        }
        $rates = [];
        foreach ($payload['rates'] as $code => $value) {
            $decimal = $this->decimal($value);
            if (is_string($code) && preg_match('/^[A-Z]{3}$/', $code) && $decimal !== null) {
                $rates[$code] = $decimal;
            }
        }
        if (!isset($rates['USD'], $rates['BDT'])) {
            return null;
        }
        $date = (string)($payload['date'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $date = date('Y-m-d');
        }

        return ['date' => $date, 'rates' => $rates];
    }

    /**
     * Units of $quote per 1 unit of $base, from USD-based decimals.
     */
    public static function crossRate(string $quotePerUsd, string $basePerUsd): string
    {
        if (function_exists('bccomp') && bccomp($basePerUsd, '0', 12) !== 1) {
            return '0';
        }
        if (function_exists('bcdiv')) {
            $value = bcdiv($quotePerUsd, $basePerUsd, 8);
            $trimmed = rtrim(rtrim($value, '0'), '.');

            return $trimmed === '' ? '0' : $trimmed;
        }
        $base = (float)$basePerUsd;
        if ($base <= 0) {
            return '0';
        }
        $text = rtrim(rtrim(sprintf('%.8F', ((float)$quotePerUsd) / $base), '0'), '.');

        return $text === '' ? '0' : $text;
    }

    private function apiKey(BaseConnection $db, bool $persistEnv): string
    {
        $row = $db->table('app_config')->select('config_value')
            ->where('config_key', 'exchange_rate_api_key')
            ->get()->getRowArray();
        $stored = $this->validKey((string)($row['config_value'] ?? ''));
        if ($stored !== '') {
            return $stored;
        }
        $fromEnv = $this->validKey((string) env('exchangeRate.apiKey'));
        if ($fromEnv !== '' && $persistEnv) {
            $db->table('app_config')->replace([
                'config_key' => 'exchange_rate_api_key',
                'config_value' => $fromEnv,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }

        return $fromEnv;
    }

    private function validKey(string $key): string
    {
        $key = trim($key);

        return preg_match('/^[A-Za-z0-9]{16,64}$/', $key) === 1 ? $key : '';
    }

    /**
     * @return array<string, string>|null
     */
    private function fetchUsdRates(string $key): ?array
    {
        $attempts = [];
        if ($key !== '') {
            $attempts[] = 'https://v6.exchangerate-api.com/v6/' . $key . '/latest/USD';
        }
        $attempts[] = 'https://open.er-api.com/v6/latest/USD';
        foreach ($attempts as $url) {
            $raw = $this->httpGet($url);
            $payload = is_string($raw) ? json_decode($raw, true) : null;
            if (!is_array($payload) || ($payload['result'] ?? '') !== 'success') {
                continue;
            }
            $rates = $payload['conversion_rates'] ?? $payload['rates'] ?? null;
            $kept = $this->keepRates(is_array($rates) ? $rates : []);
            if (isset($kept['USD'], $kept['BDT'])) {
                return $kept;
            }
        }

        return null;
    }

    /**
     * @param array<mixed> $rates
     * @return array<string, string>
     */
    private function keepRates(array $rates): array
    {
        $kept = [];
        foreach ($rates as $code => $value) {
            if (!is_string($code) || preg_match('/^[A-Z]{3}$/', $code) !== 1) {
                continue;
            }
            $decimal = $this->decimal($value);
            if ($decimal !== null) {
                $kept[$code] = $decimal;
            }
        }

        return $kept;
    }

    private function decimal(mixed $value): ?string
    {
        if (is_string($value)) {
            $value = trim($value);
            if (preg_match('/^\d+(\.\d+)?$/', $value) !== 1 || (float)$value <= 0) {
                return null;
            }

            return $value;
        }
        if (!is_int($value) && !is_float($value)) {
            return null;
        }
        if (!is_finite($value) || $value <= 0) {
            return null;
        }
        $text = rtrim(rtrim(sprintf('%.8F', $value), '0'), '.');

        return preg_match('/^\d+(\.\d+)?$/', $text) === 1 ? $text : null;
    }

    private function httpGet(string $url): ?string
    {
        set_error_handler(static fn (): bool => true);
        try {
            if (!function_exists('curl_init')) {
                $context = stream_context_create([
                    'http' => ['timeout' => 12, 'ignore_errors' => true, 'follow_location' => 0],
                ]);
                $body = file_get_contents($url, false, $context);

                return is_string($body) && $body !== '' ? $body : null;
            }
            $ch = curl_init($url);
            if ($ch === false) {
                return null;
            }
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 12,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            ]);
            $body = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if (!is_string($body) || $body === '' || $code < 200 || $code >= 300) {
                return null;
            }

            return $body;
        } finally {
            restore_error_handler();
        }
    }
}
