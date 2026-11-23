<?php

namespace App\Filters;

use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Mobile API CORS. The framework filter reads Config\Cors, writes the
 * allow-origin header on the shared response, and answers preflight.
 * It must also be registered in the after list so normal responses keep
 * the header when a later step replaces the response object.
 *
 * The debug app at https://localhost calls the emulator host at http://10.0.2.2.
 * Chrome treats that as a private-network request and drops it unless the
 * preflight allows it.
 */
class Cors extends \CodeIgniter\Filters\Cors
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $result = parent::before($request, $arguments);
        $response = $result instanceof ResponseInterface ? $result : service('response');
        $this->allowPrivateNetwork($response);

        return $result;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        $result = parent::after($request, $response, $arguments);
        $this->allowPrivateNetwork($result instanceof ResponseInterface ? $result : $response);

        return $result;
    }

    private function allowPrivateNetwork(ResponseInterface $response): void
    {
        $response->setHeader('Access-Control-Allow-Private-Network', 'true');
    }
}
