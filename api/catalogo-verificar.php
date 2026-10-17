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
$url=trim((string)@file_get_contents('/www/wts/wts-private/apps-script-url'));
if ($url==='' || !preg_match('~^https://script\\.google\\.com/macros/s/[A-Za-z0-9_-]+/exec$~D',$url)) {
 respond(503,['ok'=>false,'error'=>'URL del catálogo no configurada']);
}
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
 CURLOPT_USERAGENT=>'WTSMerch-Staging-Catalog-Verification/110'
]);
$body=curl_exec($ch);
$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
$error=(int)curl_errno($ch);
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
   'json_error'=>json_last_error()===JSON_ERROR_NONE?'ninguno':json_last_error_msg()
  ]
 ]);
}
echo $body;
