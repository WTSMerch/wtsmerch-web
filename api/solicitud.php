<?php
declare(strict_types=1);
// WTS Merch: receptor de solicitudes web. Las credenciales permanecen fuera del repositorio.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $status, array $data): never {
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  header('Allow: POST');
  respond(405, ['ok'=>false, 'error'=>'Método no permitido']);
}
if (!function_exists('curl_init')) respond(503, ['ok'=>false, 'error'=>'Servicio no disponible']);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 131072) respond(413, ['ok'=>false, 'error'=>'Solicitud demasiado grande']);
$raw = file_get_contents('php://input', false, null, 0, 131073);
if (!is_string($raw) || strlen($raw) > 131072) respond(413, ['ok'=>false, 'error'=>'Solicitud demasiado grande']);
$data = json_decode($raw, true);
if (!is_array($data) || array_is_list($data)) respond(400, ['ok'=>false, 'error'=>'Solicitud inválida']);
$type = strtoupper(trim((string)($data['tipo'] ?? '')));
if (!in_array($type, ['COMPRA','PRESUPUESTO','ASESOR'], true)) respond(400, ['ok'=>false, 'error'=>'Tipo inválido']);
if (!isset($data['cliente']) || !is_array($data['cliente'])) respond(400, ['ok'=>false, 'error'=>'Cliente inválido']);
if (!isset($data['items']) || !is_array($data['items']) || count($data['items']) > 100 || ($type !== 'ASESOR' && count($data['items']) < 1)) respond(400, ['ok'=>false, 'error'=>'Productos inválidos']);
$private = '/www/wts/wts-private/';
$secret = trim((string)@file_get_contents($private . 'bridge-token'));
$url = trim((string)@file_get_contents($private . 'apps-script-url'));
if ($secret === '' || !filter_var($url, FILTER_VALIDATE_URL) || !str_starts_with($url, 'https://script.google.com/macros/s/')) {
  respond(503, ['ok'=>false, 'error'=>'Integración no configurada']);
}
$data['bridgeToken'] = $secret;
$payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if (!is_string($payload)) respond(400, ['ok'=>false, 'error'=>'Datos inválidos']);
$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json; charset=utf-8', 'Accept: application/json'],
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_MAXREDIRS => 5,
  CURLOPT_CONNECTTIMEOUT => 8,
  CURLOPT_TIMEOUT => 35,
  CURLOPT_SSL_VERIFYPEER => true,
  CURLOPT_SSL_VERIFYHOST => 2
]);
$body = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = (int)curl_errno($ch);
curl_close($ch);
if ($body === false) respond(502, ['ok'=>false, 'error'=>'Fallo de conexión con Apps Script', 'codigo_curl'=>$curlError]);
if ($status < 200 || $status >= 300) respond(502, ['ok'=>false, 'error'=>'Apps Script devolvió un estado HTTP no exitoso', 'codigo_http'=>$status]);
$reply = json_decode((string)$body, true);
if (!is_array($reply)) respond(502, ['ok'=>false, 'error'=>'Respuesta no JSON de Apps Script']);
if (($reply['ok'] ?? false) !== true || empty($reply['id'])) respond(502, ['ok'=>false, 'error'=>'Apps Script no confirmó el registro; revisar ejecuciones antes de reenviar']);
respond(200, ['ok'=>true, 'id'=>(string)$reply['id']]);
