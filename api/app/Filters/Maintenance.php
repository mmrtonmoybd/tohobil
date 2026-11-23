<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class Maintenance implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $path = $request->getUri()->getPath();

        // Exempt health and status endpoints so clients can check maintenance state
        if (str_contains($path, 'app/status') || str_contains($path, 'health')) {
            return null;
        }

        $db = db_connect();
        if (!$db->tableExists('app_config')) {
            return null;
        }

        $row = $db->table('app_config')->where('config_key', 'maintenance')->get()->getRowArray();
        $isMaintenance = ($row && $row['config_value'] === 'true');

        if ($isMaintenance) {
            $msgRow = $db->table('app_config')->where('config_key', 'maintenance_message')->get()->getRowArray();
            $message = $msgRow['config_value'] ?? 'Tohobil is currently undergoing scheduled maintenance. Please check back shortly.';

            return service('response')
                ->setStatusCode(503)
                ->setJSON([
                    'error' => [
                        'code'    => 'MAINTENANCE',
                        'message' => $message,
                    ]
                ]);
        }

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return $response;
    }
}
