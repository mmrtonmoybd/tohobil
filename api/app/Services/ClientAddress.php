<?php

namespace App\Services;

/**
 * The address of the TCP peer. Forwarded headers are ignored so a caller
 * cannot mint a fresh rate-limit bucket with X-Forwarded-For.
 */
class ClientAddress
{
    public static function ip(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';

        return is_string($ip) && filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
    }
}
