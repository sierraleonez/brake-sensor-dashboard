<?php

return [
    'url'    => env('INFLUXDB_URL', 'http://localhost:8086'),
    'token'  => env('INFLUXDB_TOKEN', ''),
    'org'    => env('INFLUXDB_ORG', ''),
    'bucket' => env('INFLUXDB_BUCKET', 'sensor_logs'),
];
