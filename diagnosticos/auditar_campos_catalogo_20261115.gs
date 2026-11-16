/**
 * WTS Merch · Auditoría SOLO LECTURA de variantes y stock publicados.
 * Pegar en Apps Script como archivo .gs independiente y ejecutar
 * auditarCamposCatalogoWTS_20261115. No escribe ni sincroniza.
 * Requiere las funciones existentes getWebPublicationRows() y publicWebYesV12_().
 */
function auditarCamposCatalogoWTS_20261115(){
  const rows=getWebPublicationRows();
  const stats={total:0,publicados:0,variantesVacias:0,stockVacio:0,stockNoLimitante:0};
  const examples=[];
  rows.forEach(function(r){
    stats.total++;
    if(!publicWebYesV12_(r.PUBLICADO))return;
    stats.publicados++;
    const v=String(r.VARIANTES==null?'':r.VARIANTES).trim();
    const st=String(r.STOCK_PUBLICO==null?'':r.STOCK_PUBLICO).trim();
    if(!v||/^(única|unica)$/i.test(v))stats.variantesVacias++;
    if(!st)stats.stockVacio++;
    if(r.STOCK_NO_LIMITANTE)stats.stockNoLimitante++;
    if(examples.length<20&&(!v||/^(única|unica)$/i.test(v)||!st)){
      examples.push({nombre:String(r.NOMBRE_PUBLICO||'').slice(0,80),
        codigo:String(r.CODIGO_ORIGEN||'').slice(0,60),
        origen:String(r.ORIGEN||''),variantes:v.slice(0,160),
        stock:st,stockNoLimitante:!!r.STOCK_NO_LIMITANTE});
    }
  });
  const result={stats:stats,examples:examples};
  Logger.log(JSON.stringify(result,null,2));
  return result;
}
