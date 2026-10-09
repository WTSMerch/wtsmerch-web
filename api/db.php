<?php
declare(strict_types=1);
function wts_db(): PDO {
    $host = getenv('WTS_DB_HOST');
    $name = getenv('WTS_DB_NAME');
    $user = getenv('WTS_DB_USER');
    $pass = getenv('WTS_DB_PASSWORD');
    if (!$host || !$name || !$user || $pass === false || $pass === '') {
        throw new RuntimeException('Database configuration unavailable');
    }
    return new PDO(
        'mysql:host='.$host.';dbname='.$name.';charset=utf8mb4',
        $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
         PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
         PDO::ATTR_EMULATE_PREPARES => false]
    );
}
