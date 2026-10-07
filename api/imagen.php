<?php
declare(strict_types=1);

/*
 * WTS Merch · V94 · Puente de imágenes
 * Recibe /api/imagen.php?id=<id>&n=<indice>
 * Consulta Apps Script sólo para resolver el origen y redirige al archivo real.
 */

const WTS_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwQQzX6DTJuOgA2jU3v4WnCC8PWYZ5n9ZUbkXwMzopIFk4HV_oKQ0A5D4vR4mlOzs4/exec';
const WTS_BRIDGE_TOKEN = 'PYcHMJJuwUqVqlRjICi03LxJhDmQfJdMafwhQ4eaj_c';

function fail_image(int $status = 404): never {
    http_response_code($status);
    header('Cache-Control: public, max-age=300');
    header('Content-Type: image/svg+xml; charset=utf-8');
    echo '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700"><rect width="900" height="700" fill="#f4f6f8"/><path d="M360 285h180v130H360z" fill="none" stroke="#c7cdd4" stroke-width="10"/><circle cx="410" cy="330" r="18" fill="#c7cdd4"/><path d="m380 390 55-55 38 38 28-28 40 45" fill="none" stroke="#c7cdd4" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    exit;
}

$id = trim((string)($_GET['id'] ?? ''));
$n  = max(0, (int)($_GET['n'] ?? 0));

if ($id === '' || !preg_match('/^[A-Za-z0-9_-]{3,100}$/', $id)) {
    fail_image(400);
}

$cacheDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'wtsmerch_img_v94';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
$cacheKey = hash('sha256', $id . '|' . $n);
$cacheFile = $cacheDir . DIRECTORY_SEPARATOR . $cacheKey . '.url';
$origin = '';

if (is_file($cacheFile) && (time() - (int)@filemtime($cacheFile) < 21600)) {
    $origin = trim((string)@file_get_contents($cacheFile));
}

if ($origin === '') {
    $query = http_build_query([
        'api'   => 'imagenOrigenV89',
        'token' => WTS_BRIDGE_TOKEN,
        'id'    => $id,
        'n'     => $n,
    ], '', '&', PHP_QUERY_RFC3986);

    $url = WTS_APPS_SCRIPT_URL . '?' . $query;
    $body = false;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_USERAGENT => 'WTSMerch-ImageBridge/94',
        ]);
        $body = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($code < 200 || $code >= 300) $body = false;
    } else {
        $ctx = stream_context_create(['http' => [
            'timeout' => 10,
            'follow_location' => 1,
            'header' => "User-Agent: WTSMerch-ImageBridge/94\r\n",
        ]]);
        $body = @file_get_contents($url, false, $ctx);
    }

    if ($body === false) fail_image(502);

    $data = json_decode((string)$body, true);
    if (!is_array($data) || empty($data['ok']) || empty($data['url'])) fail_image(404);
    $origin = trim((string)$data['url']);

    $parts = @parse_url($origin);
    if (!$parts || !in_array(strtolower((string)($parts['scheme'] ?? '')), ['http','https'], true) || empty($parts['host'])) {
        fail_image(404);
    }

    @file_put_contents($cacheFile, $origin, LOCK_EX);
}

header('Cache-Control: public, max-age=21600, stale-while-revalidate=86400');
header('Location: ' . $origin, true, 302);
exit;
