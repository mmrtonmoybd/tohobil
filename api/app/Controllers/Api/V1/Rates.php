<?php

namespace App\Controllers\Api\V1;

use App\Services\ExchangeRateService;
use CodeIgniter\HTTP\ResponseInterface;

class Rates extends ApiController
{
    /**
     * Standard baseline benchmark rates (units of foreign currency per 1 USD)
     */
    private const BASE_USD_RATES = [
        'USD' => 1.0,
        'BDT' => 121.50,
        'EUR' => 0.92,
        'GBP' => 0.79,
        'SAR' => 3.75,
        'AED' => 3.67,
        'INR' => 84.40,
        'CAD' => 1.40,
        'AUD' => 1.54,
        'MYR' => 4.45,
        'SGD' => 1.34,
        'JPY' => 154.20,
    ];

    /**
     * GET /api/v1/rates?base=USD
     */
    public function index(): ResponseInterface
    {
        $base = strtoupper(trim((string)$this->request->getGet('base')));
        if (!$base) {
            parse_str((string)$this->request->getUri()->getQuery(), $query);
            $base = strtoupper(trim((string)($query['base'] ?? 'BDT')));
        }
        if (strlen($base) !== 3) {
            $base = 'BDT';
        }

        $service = new ExchangeRateService();
        $snapshot = $service->snapshot(db_connect());
        $usdRates = $snapshot['rates'] ?? null;
        $date = $snapshot['date'] ?? date('Y-m-d');
        if ($usdRates === null) {
            $usdRates = [];
            foreach (self::BASE_USD_RATES as $currency => $rateVsUsd) {
                $usdRates[$currency] = rtrim(rtrim(sprintf('%.8F', $rateVsUsd), '0'), '.');
            }
        }

        $baseInUsd = $usdRates[$base] ?? null;
        if ($baseInUsd === null || (float)$baseInUsd <= 0) {
            $base = 'USD';
            $baseInUsd = $usdRates['USD'] ?? '1';
        }

        $calculatedRates = [];
        foreach ($usdRates as $currency => $rateVsUsd) {
            if ($currency === $base) {
                $calculatedRates[$currency] = 1.0;
                continue;
            }
            $calculatedRates[$currency] = (float) ExchangeRateService::crossRate((string)$rateVsUsd, (string)$baseInUsd);
        }

        return $this->response->setJSON([
            'base' => $base,
            'date' => $date,
            'updated_at' => (int)(microtime(true) * 1000),
            'source' => 'server',
            'rates' => $calculatedRates,
        ]);
    }
}
