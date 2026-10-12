<?php
declare(strict_types=1);

function wts_db(): PDO {
    // This file lives outside the deployment symlink and is never committed.
    $path = '/www/wts/wtsmerch.com.ar/private/database.php';
    if (!is_file($path) || !is_readable($path)) {
        throw new RuntimeException('Database configuration unavailable');
    }
    $config = require $path;
    if (!is_array($config)) {
        throw new RuntimeException('Invalid database configuration');
    }
    foreach (['host', 'database', 'username', 'password'] as $key) {
        if (!isset($config[$key]) || !is_string($config[$key]) || $config[$key] === '') {
            throw new RuntimeException('Incomplete database configuration');
        }
    }
    $port = isset($config['port']) ? (int)$config['port'] : 3306;
    $charset = $config['charset'] ?? 'utf8mb4';
    if ($port < 1 || $port > 65535 || $charset !== 'utf8mb4') {
        throw new RuntimeException('Invalid database connection settings');
    }
    return new PDO(
        'mysql:host='.$config['host'].';port='.$port.';dbname='.$config['database'].';charset=utf8mb4',
        $config['username'],
        $config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 5
        ]
    );
}
