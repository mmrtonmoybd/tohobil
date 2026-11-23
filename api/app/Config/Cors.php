<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Cross-Origin Resource Sharing (CORS) Configuration
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
 */
class Cors extends BaseConfig
{
    public function __construct()
    {
        parent::__construct();

        if (ENVIRONMENT === 'production') {
            $this->default['allowedOrigins'] = [
                'https://tohobil.app',
                'https://www.tohobil.app',
            ];
            $this->default['allowedOriginsPatterns'] = [];
        }
    }

    /**
     * The default CORS configuration.
     *
     * @var array{
     *      allowedOrigins: list<string>,
     *      allowedOriginsPatterns: list<string>,
     *      supportsCredentials: bool,
     *      allowedHeaders: list<string>,
     *      exposedHeaders: list<string>,
     *      allowedMethods: list<string>,
     *      maxAge: int,
     *  }
     */
    public array $default = [
        'allowedOrigins'         => [
            'capacitor://localhost',
            'ionic://localhost',
            'http://localhost',
            'https://localhost',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'https://tohobil.app',
            'https://www.tohobil.app',
        ],
        'allowedOriginsPatterns' => [
            // CodeIgniter wraps this in its own delimiters. Do not add # ^ $ here.
            'https?://(localhost|127\.0\.0\.1)(:\d+)?',
        ],
        'supportsCredentials'   => true,
        'allowedHeaders'         => [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-Auth-Token',
            'X-Device-Id',
            'X-Installation-Id',
            'X-App-Version',
        ],
        'exposedHeaders'         => [],
        'allowedMethods'         => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        'maxAge'                 => 7200,
    ];
}
