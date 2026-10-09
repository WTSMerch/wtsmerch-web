<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['error'=>'method_not_allowed']); exit;
}
require_once __DIR__.'/db.php';
try {
    $limit = filter_input(INPUT_GET, 'limit', FILTER_VALIDATE_INT);
    $offset = filter_input(INPUT_GET, 'offset', FILTER_VALIDATE_INT);
    $limit = $limit === false || $limit === null ? 24 : max(1, min(100, $limit));
    $offset = $offset === false || $offset === null ? 0 : max(0, $offset);
    $db = wts_db();
    $stmt = $db->prepare('SELECT p.id, p.supplier_sku, p.name, p.description, p.unit_price_ex_vat, p.vat_rate, p.currency, p.min_qty, p.updated_at, s.name AS supplier FROM wts_products p JOIN wts_suppliers s ON s.id=p.supplier_id WHERE p.published=1 AND p.available=1 AND s.active=1 ORDER BY p.id DESC LIMIT :lim OFFSET :off');
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
    $stmt->execute();
    echo json_encode(['items'=>$stmt->fetchAll(),'limit'=>$limit,'offset'=>$offset], JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable $e) {
    error_log('WTS catalog API failure: '.$e->getMessage());
    http_response_code(503);
    echo json_encode(['error'=>'catalog_unavailable']);
}
