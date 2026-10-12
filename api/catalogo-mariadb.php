<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['ok'=>false,'error'=>'method_not_allowed']);
    exit;
}

require_once __DIR__.'/db.php';

try {
    $db = wts_db();
    $view = (string)($_GET['view'] ?? 'catalog');
    $limit = filter_input(INPUT_GET, 'limit', FILTER_VALIDATE_INT);
    $offset = filter_input(INPUT_GET, 'offset', FILTER_VALIDATE_INT);
    $limit = $limit === null || $limit === false ? ($view === 'home' ? 6 : 24) : max(1, min(100, $limit));
    $offset = $offset === null || $offset === false ? 0 : max(0, $offset);

    $where = 'p.published = 1 AND p.available = 1 AND s.active = 1 AND c.active = 1';
    $joins = ' FROM wts_products p JOIN wts_suppliers s ON s.id = p.supplier_id JOIN wts_categories c ON c.id = p.category_id ';
    $total = (int)$db->query('SELECT COUNT(*)'.$joins.' WHERE '.$where)->fetchColumn();

    $sql = 'SELECT p.id, p.name, p.description, p.attributes_json, p.unit_price_ex_vat, p.currency, p.min_qty, p.available, c.name AS category, s.name AS supplier,
        (SELECT i.image_url FROM wts_product_images i WHERE i.product_id = p.id AND i.enabled = 1 AND i.variant_id IS NULL ORDER BY i.sort_order ASC, i.id ASC LIMIT 1) AS image'
        .$joins.' WHERE '.$where.' ORDER BY p.updated_at DESC, p.id DESC LIMIT :lim OFFSET :off';
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $products = [];
    foreach ($stmt->fetchAll() as $p) {
        $attributes = json_decode((string)($p['attributes_json'] ?? ''), true);
        $products[] = [
            'id' => (string)$p['id'],
            'name' => (string)$p['name'],
            'description' => (string)($p['description'] ?? ''),
            'category' => (string)$p['category'],
            'brand' => (string)$p['supplier'],
            'image' => (string)($p['image'] ?? ''),
            'publicPrice' => (float)$p['unit_price_ex_vat'],
            'currency' => (string)$p['currency'],
            'min' => (int)$p['min_qty'],
            'active' => true,
            'stockStatus' => 'unknown',
            'stock' => null,
            'variants' => [],
            'featured' => false,
            'attributes' => is_array($attributes) ? $attributes : [],
        ];
    }

    echo json_encode([
        'ok' => true,
        'products' => $products,
        'total' => $total,
        'meta' => ['categories'=>[], 'brands'=>[], 'collections'=>[], 'total'=>$total],
        'limit' => $limit,
        'offset' => $offset,
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    error_log('WTS catalog API failure: '.$e->getMessage());
    http_response_code(503);
    echo json_encode(['ok'=>false,'error'=>'catalog_unavailable']);
}
