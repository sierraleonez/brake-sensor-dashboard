<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use InfluxDB2\Client;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $range = in_array($request->query('range'), ['1h', '24h', '7d'])
            ? $request->query('range')
            : '24h';

        $client = new Client([
            'url'     => config('influxdb.url'),
            'token'   => config('influxdb.token'),
            'org'     => config('influxdb.org'),
            'bucket'  => config('influxdb.bucket'),
            'timeout' => 10,
        ]);

        $queryApi = $client->createQueryApi();
        $bucket   = config('influxdb.bucket');

        // Query A: latest single record
        $fluxCurrent = <<<FLUX
from(bucket: "{$bucket}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "msg.payload.suhu")
  |> last()
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
FLUX;

        // Query B: historical aggregated per 5-min window
        $fluxHistory = <<<FLUX
from(bucket: "{$bucket}")
  |> range(start: -{$range})
  |> filter(fn: (r) => r._measurement == "msg.payload.suhu" and r._field == "suhu")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> keep(columns: ["_time", "_value"])
FLUX;

        $current = null;
        $history = [];

        try {
            $currentResult = $queryApi->query($fluxCurrent);
            foreach ($currentResult as $table) {
                foreach ($table->records as $record) {
                    $current = [
                        'device_id' => $record->values['device_id'] ?? 'unknown',
                        'suhu'      => (float) ($record->values['suhu'] ?? 0),
                        'unit'      => $record->values['unit'] ?? 'C',
                        'status'    => $record->values['status'] ?? 'AMAN',
                        'time'      => (string) $record->values['_time'],
                    ];
                    break 2;
                }
            }

            $historyResult = $queryApi->query($fluxHistory);
            foreach ($historyResult as $table) {
                foreach ($table->records as $record) {
                    $history[] = [
                        'time'  => (string) $record->values['_time'],
                        'value' => $record->values['_value'] !== null
                            ? (float) $record->values['_value']
                            : null,
                    ];
                }
            }
        } catch (\Exception $e) {
            logger()->error('InfluxDB query failed: '.$e->getMessage());
        }

        $client->close();

        return Inertia::render('Dashboard', [
            'current' => $current,
            'history' => $history,
            'range'   => $range,
        ]);
    }
}
