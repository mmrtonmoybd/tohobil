<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class RateLimit implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $throttler = service('throttler');
        $ip = \App\Services\ClientAddress::ip();
        $path = $request->getUri()->getPath();

        // 1. Strict limit for authentication & OTP endpoints (5 attempts per minute)
        if (str_contains($path, 'auth/otp') || str_contains($path, 'auth/login') || str_contains($path, 'auth/register')) {
            $key = 'rate_auth_' . md5($ip);
            if ($throttler->check($key, 5, 60) === false) {
                return service('response')
                    ->setStatusCode(429)
                    ->setJSON([
                        'error' => [
                            'code'    => 'RATE_LIMITED',
                            'message' => 'Too many login attempts. Please wait 1 minute.',
                        ]
                    ]);
            }
        }

        // 2. General write endpoints limit (60 requests per minute)
        if (in_array(strtoupper($request->getMethod()), ['POST', 'PUT', 'DELETE'], true)) {
            $key = 'rate_write_' . md5($ip);
            if ($throttler->check($key, 60, 60) === false) {
                return service('response')
                    ->setStatusCode(429)
                    ->setJSON([
                        'error' => [
                            'code'    => 'RATE_LIMITED',
                            'message' => 'Too many requests. Please slow down.',
                        ]
                    ]);
            }
        }

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return $response;
    }
}
