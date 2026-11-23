<?php

namespace App\Services;

/**
 * Text-message one-time codes are off until an SMS gateway is connected.
 * Admin authenticator (TOTP) is a separate system and stays on.
 */
final class SmsOtp
{
    public static function enabled(): bool
    {
        return false;
    }
}
