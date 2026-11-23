<?php

namespace App\Controllers\Api\V1;

use App\Controllers\BaseController;
use App\Services\Identity;

abstract class ApiController extends BaseController
{
    protected function identity(): Identity { return new Identity(db_connect()); }
    protected function input(): array { return $this->request->getJSON(true) ?: []; }
    protected function fail(string $code, string $message, int $status = 422) { return $this->response->setStatusCode($status)->setJSON(['error'=>['code'=>$code,'message'=>$message]]); }
    protected function ok(array $data = [], int $status = 200) { return $this->response->setStatusCode($status)->setJSON($data); }
    protected function user(): array { return $this->request->authUser; }
}
