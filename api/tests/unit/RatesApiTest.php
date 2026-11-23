<?php

namespace Tests\Unit;

use App\Controllers\Api\V1\Rates;
use CodeIgniter\Config\Services;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;

final class RatesApiTest extends CIUnitTestCase
{
    private function invokeRates(string $base = 'BDT'): array
    {
        $uri = new URI('http://localhost:8000/api/v1/rates?base=' . $base);
        $request = new IncomingRequest(new App(), $uri, null, new UserAgent());
        $request->setGlobal('get', ['base' => $base]);
        $response = new Response(new App());

        $controller = new Rates();
        $controller->initController($request, $response, Services::logger());

        $res = $controller->index();
        return json_decode($res->getBody(), true);
    }

    public function testReturnsRatesForDefaultBase(): void
    {
        $data = $this->invokeRates('BDT');
        $this->assertSame('BDT', $data['base']);
        $this->assertArrayHasKey('rates', $data);
        $this->assertSame(1.0, (float)$data['rates']['BDT']);
        $this->assertGreaterThan(0, $data['rates']['USD']);
        $this->assertArrayHasKey('EUR', $data['rates']);
        $this->assertArrayHasKey('date', $data);
        $this->assertSame('server', $data['source']);
    }

    public function testReturnsRatesForUsdBase(): void
    {
        $data = $this->invokeRates('USD');
        $this->assertSame('USD', $data['base']);
        $this->assertSame(1.0, (float)$data['rates']['USD']);
        $this->assertGreaterThan(50, (float)$data['rates']['BDT']);
        $this->assertGreaterThan(0, (float)$data['rates']['EUR']);
        $this->assertLessThan(2, (float)$data['rates']['EUR']);
    }
}
