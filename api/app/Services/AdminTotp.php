<?php

namespace App\Services;

/** RFC 6238 TOTP, six digits, 30-second steps, SHA-1 authenticator compatibility. */
class AdminTotp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function generateSecret(): string
    {
        $bytes = random_bytes(20);
        $bits = '';
        foreach (str_split($bytes) as $byte) $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        $secret = '';
        foreach (str_split($bits, 5) as $chunk) $secret .= self::ALPHABET[bindec($chunk)];
        return $secret;
    }

    public static function provisioningUri(string $email, string $secret): string
    {
        return 'otpauth://totp/' . rawurlencode('Tohobil:' . $email)
            . '?secret=' . rawurlencode($secret) . '&issuer=Tohobil&algorithm=SHA1&digits=6&period=30';
    }

    /** Returns accepted time step or null. Previous steps and malformed codes fail closed. */
    public static function verify(string $secret, string $code, ?int $lastStep = null, ?int $now = null): ?int
    {
        if (!preg_match('/^\d{6}$/D', $code)) return null;
        $key = self::decodeBase32($secret);
        if ($key === null) return null;
        $step = intdiv($now ?? time(), 30);
        foreach ([$step, $step - 1, $step + 1] as $candidate) {
            if ($candidate < 0 || ($lastStep !== null && $candidate <= $lastStep)) continue;
            $digest = hash_hmac('sha1', pack('N2', 0, $candidate), $key, true);
            $offset = ord($digest[19]) & 15;
            $binary = (unpack('N', substr($digest, $offset, 4))[1] & 0x7fffffff) % 1000000;
            if (hash_equals(str_pad((string)$binary, 6, '0', STR_PAD_LEFT), $code)) return $candidate;
        }
        return null;
    }

    private static function decodeBase32(string $secret): ?string
    {
        $secret = strtoupper($secret);
        if (!preg_match('/^[A-Z2-7]{32}$/D', $secret)) return null;
        $bits = '';
        foreach (str_split($secret) as $char) $bits .= str_pad(decbin(strpos(self::ALPHABET, $char)), 5, '0', STR_PAD_LEFT);
        $bytes = '';
        foreach (str_split($bits, 8) as $chunk) if (strlen($chunk) === 8) $bytes .= chr(bindec($chunk));
        return $bytes;
    }
}
