<?php
declare(strict_types=1);
/* WTS V102: diagnóstico seguro para entorno de pruebas. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function result(int $status, array $data): never {
 http_response_code($status);
 echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
 exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
 header('Allow: POST');
 result(405,['ok'=>false,'error'=>'Método no permitido']);
}
if (!function_exists('curl_init')) result(503,['ok'=>false,'error'=>'Servicio no disponible']);
if ((int)($_SERVER['CONTENT_LENGTH']??0)>131072) result(413,['ok'=>false,'error'=>'Solicitud demasiado grande']);
$raw=file_get_contents('php://input',false,null,0,131073);
if (!is_string($raw)||strlen($raw)>131072) result(413,['ok'=>false,'error'=>'Solicitud demasiado grande']);
$data=json_decode($raw,true);
if (!is_array($data)||array_is_list($data)) result(400,['ok'=>false,'error'=>'Solicitud inválida']);
$type=strtoupper(trim((string)($data['tipo']??'')));
if (!in_array($type,['COMPRA','PRESUPUESTO','ASESOR'],true)) result(400,['ok'=>false,'error'=>'Tipo inválido']);
if (!isset($data['cliente'])||!is_array($data['cliente'])) result(400,['ok'=>false,'error'=>'Cliente inválido']);
if (!isset($data['items'])||!is_array($data['items'])||count($data['items'])<1||count($data['items'])>100) result(400,['ok'=>false,'error'=>'Productos inválidos']);
$private='/www/wts/wts-private/';
$secret=trim((string)@file_get_contents($private.'bridge-token'));
$url=trim((string)@file_get_contents($private.'apps-script-url'));
if ($secret===''||!filter_var($url,FILTER_VALIDATE_URL)||!str_starts_with($url,'https://script.google.com/macros/s/')) result(503,['ok'=>false,'error'=>'Integración no configurada']);
$data['bridgeToken']=$secret;
$payload=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
if (!is_string($payload)) result(400,['ok'=>false,'error'=>'Datos inválidos']);
$ch=curl_init($url);
curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$payload,CURLOPT_HTTPHEADER=>['Content-Type: application/json; charset=utf-8','Accept: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>true,CURLOPT_MAXREDIRS=>5,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>35,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2]);
$body=curl_exec($ch);
$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
$curlErr=(int)curl_errno($ch);
$finalUrl=(string)curl_getinfo($ch,CURLINFO_EFFECTIVE_URL);
curl_close($ch);
if ($body===false) result(502,['ok'=>false,'error'=>'Fallo de conexión con Apps Script','etapa'=>'transporte','codigo_curl'=>$curlErr]);
if ($status<200||$status>=300) result(502,['ok'=>false,'error'=>'Apps Script devolvió un estado HTTP no exitoso','etapa'=>'http','codigo_http'=>$status]);

$reply=json_decode((string)$body,true);
if (is_array($reply) && ($reply['ok']??null)===false) {
 // Solo mensajes de validación conocidos, nunca detalles internos ni credenciales.
 $error=(string)($reply['error']??'');
 $allowed=['CUIT inválido.','Email inválido.','Producto o cantidad inválidos.','Cantidad inferior al mínimo.','Stock insuficiente.','Producto no habilitado para compra.','Cantidad de renglones inválida.','Tipo inválido.','Solicitud no autorizada.'];
 if (in_array($error,$allowed,true)) result(422,['ok'=>false,'error'=>$error]);
 result(502,['ok'=>false,'error'=>'Apps Script rechazó la solicitud; revisar el registro de ejecuciones antes de reenviar.']);
}
if (!is_array($reply)) result(502,['ok'=>false,'error'=>'Respuesta no JSON de Apps Script','etapa'=>'formato','codigo_http'=>$status]);
if (($reply['ok']??false)!==true||empty($reply['id'])) result(502,['ok'=>false,'error'=>'Apps Script no confirmó un registro','etapa'=>'respuesta','ok_remoto'=>($reply['ok']??null),'tiene_id'=>!empty($reply['id'])]);
result(200,['ok'=>true,'id'=>(string)$reply['id']]);
