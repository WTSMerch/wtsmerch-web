<?php
declare(strict_types=1);
/**
 * WTS Merch - receptor V94 (preparación, NO publicar).
 * Estado: integración de registro pendiente. Nunca confirma una solicitud
 * que no haya sido efectivamente registrada.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $status, string $error): never {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, 'Método no permitido.');
}
if (isset($_SERVER['CONTENT_LENGTH']) && (int)$_SERVER['CONTENT_LENGTH'] > 65536) {
    respond(413, 'Solicitud demasiado grande.');
}
$raw = file_get_contents('php://input', false, null, 0, 65537);
if ($raw === false || strlen($raw) > 65536) respond(413, 'Solicitud demasiado grande.');
$payload = json_decode($raw, true);
if (!is_array($payload) || json_last_error() !== JSON_ERROR_NONE) {
    respond(400, 'JSON inválido.');
}
$tipo = $payload['tipo'] ?? null;
if (!is_string($tipo) || !in_array($tipo, ['COMPRA', 'PRESUPUESTO', 'ASESOR'], true)) {
    respond(422, 'Tipo de solicitud inválido.');
}
$cliente = $payload['cliente'] ?? null;
if (!is_array($cliente)) respond(422, 'Datos del cliente inválidos.');
foreach (['nombre', 'empresa', 'cuit', 'email', 'telefono', 'direccion', 'localidad', 'codigoPostal', 'fechaNecesaria'] as $field) {
    if (!isset($cliente[$field]) || !is_string($cliente[$field]) || trim($cliente[$field]) === '') {
        respond(422, 'Falta un dato obligatorio.');
    }
}
if (!filter_var($cliente['email'], FILTER_VALIDATE_EMAIL)) respond(422, 'Email inválido.');
if (!preg_match('/^\\d{11}$/', preg_replace('/\\D+/', '', $cliente['cuit']))) respond(422, 'CUIT inválido.');
$items = $payload['items'] ?? null;
if (!is_array($items) || count($items) < 1 || count($items) > 100) {
    respond(422, 'El pedido debe contener entre 1 y 100 renglones.');
}
foreach ($items as $item) {
    if (!is_array($item) || !isset($item['id'], $item['cantidad']) ||
        !is_string($item['id']) || trim($item['id']) === '' ||
        !is_numeric($item['cantidad']) || (int)$item['cantidad'] < 1 ||
        (float)$item['cantidad'] !== (float)(int)$item['cantidad']) {
        respond(422, 'Renglón de producto inválido.');
    }
}
// PENDIENTE: verificar productos, precios y mínimos contra catálogo confiable,
// y persistir la solicitud en un destino configurado, con confirmación real.
// No confiar en precioNeto ni en autorizaciones aportadas por el navegador.
// Hasta implementar lo anterior, fallar cerrado para los tres tipos.
respond(503, 'Recepción temporalmente no disponible. No se registró la solicitud.');
