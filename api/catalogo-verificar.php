<?php
declare(strict_types=1);
// Staging V110: read-only, same-origin catalog verification proxy.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function respond(int $status, array $data): never {
 http_response_code($status);
 echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
 exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') respond(405,['ok'=>false,'error'=>'Método no permitido']);
if (!function_exists('curl_init')) respond(503,['ok'=>false,'error'=>'cURL no disponible']);
// Use the same staging catalog endpoint configured for the public staging website.
// This is read-only; do not reuse the private order-submission URL.
$configRaw=@file_get_contents(__DIR__.'/../data/config.json');
$config=json_decode((string)$configRaw,true);
$url=is_array($config)?trim((string)($config['catalogApiUrl']??'')):'';
if ($url==='' || !preg_match('~^https://script\\.google\\.com/macros/s/[A-Za-z0-9_-]+/exec$~D',$url)) {
 respond(503,['ok'=>false,'error'=>'URL del catálogo de pruebas no configurada']);
}
// doGet returns the management HTML without catalog parameters.
// api=catalogoPublico selects the read-only JSON catalog route.
// V114 diagnostic: request a single catalog item to isolate full-catalog timeout.
// NOT checkout-ready: a one-item response cannot validate an arbitrary cart.
$url.='?api=catalogoPublico&view=catalog&limit=1&offset=0';
$ch=curl_init($url);
curl_setopt_array($ch,[
 CURLOPT_RETURNTRANSFER=>true,
 CURLOPT_FOLLOWLOCATION=>true,
 CURLOPT_MAXREDIRS=>5,
 CURLOPT_CONNECTTIMEOUT=>8,
 CURLOPT_TIMEOUT=>45,
 CURLOPT_SSL_VERIFYPEER=>true,
 CURLOPT_SSL_VERIFYHOST=>2,
 CURLOPT_HTTPHEADER=>['Accept: application/json'],
 CURLOPT_USERAGENT=>'WTSMerch-Staging-Catalog-Verification/111'
]);
$body=curl_exec($ch);
$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
$error=(int)curl_errno($ch);
$effectiveUrl=(string)curl_getinfo($ch,CURLINFO_EFFECTIVE_URL);
$contentType=(string)curl_getinfo($ch,CURLINFO_CONTENT_TYPE);
$redirectCount=(int)curl_getinfo($ch,CURLINFO_REDIRECT_COUNT);
curl_close($ch);
if ($body===false || $status<200 || $status>=300) respond(502,['ok'=>false,'error'=>'No se pudo consultar el catálogo','codigo_curl'=>$error]);
if (strlen($body)>8000000) respond(502,['ok'=>false,'error'=>'Respuesta del catálogo demasiado grande']);
$data=json_decode($body,true);
if (!is_array($data) || ($data['ok']??false)!==true || !isset($data['products']) || !is_array($data['products'])) {
 // Only structural diagnostics: never expose body, URL, token or private data.
 $keys=is_array($data)?array_slice(array_keys($data),0,12):[];
 $keys=array_values(array_filter($keys,static fn($k)=>is_string($k)&&preg_match('/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/',$k)));
 respond(502,[
  'ok'=>false,
  'error'=>'Respuesta del catálogo inválida',
  'diagnostico'=>[
   'tipo'=>is_array($data)?'json':'no_json',
   'claves'=>$keys,
   'ok_remoto'=>is_array($data)?($data['ok']??null):null,
   'productos_es_lista'=>is_array($data)&&isset($data['products'])&&is_array($data['products']),
   'html'=>is_string($body)&&preg_match('/^\\s*<(?:!doctype|html)/i',$body)===1,
   'json_error'=>json_last_error()===JSON_ERROR_NONE?'ninguno':json_last_error_msg(),
   'http_status'=>$status,
   'redirects'=>$redirectCount,
   'destino'=>preg_match('~^https://([^/]+)~i',$effectiveUrl,$m)?strtolower($m[1]):'desconocido',
   'content_type'=>substr($contentType,0,80),
   'pagina_google_login'=>stripos((string)$body,'accounts.google.com')!==false,
   'pagina_google_error'=>stripos((string)$body,'Google Apps Script')!==false || stripos((string)$body,'script.google.com')!==false
  ]
 ]);
}
echo $body;
