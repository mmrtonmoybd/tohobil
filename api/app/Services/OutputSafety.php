<?php

namespace App\Services;

class OutputSafety
{
    public const MAX_IMAGE_EDGE = 8000;
    public const MAX_IMAGE_PIXELS = 24000000;

    public static function spreadsheetCell(string $value): string
    {
        if ($value !== '' && preg_match('/^[\t\r\n]*[=+\-@]/', $value) === 1) {
            return "'" . $value;
        }

        return $value;
    }

    public static function dispositionFilename(string $name): string
    {
        $base = basename(str_replace('\\', '/', $name));
        $base = str_replace(["\r", "\n", '"', "\0"], '', $base);
        $clean = preg_replace('/[^\p{L}\p{N} ._()-]+/u', '_', $base);
        $clean = trim(is_string($clean) ? $clean : '', '. ');

        return $clean !== '' ? $clean : 'download';
    }

    public static function imageWithinLimits(?int $width, ?int $height): bool
    {
        if ($width === null || $height === null || $width < 1 || $height < 1) {
            return false;
        }

        if ($width > self::MAX_IMAGE_EDGE || $height > self::MAX_IMAGE_EDGE) {
            return false;
        }

        return ($width * $height) <= self::MAX_IMAGE_PIXELS;
    }
}
