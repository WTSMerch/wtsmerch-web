/**
 * WTS Merch V110: normalización segura del catálogo público.
 * NO redefine doGet ni getPublicWebCatalogV94_.
 * Usar desde el exportador que hace POST a wts-catalogo-sync-v110.php:
 *   const snapshot = wtsCatalogoPublicoCorregidoV110_();
 * Preserva precio, mínimos, publicación, modos y URLs de imágenes.
 */
function wtsCatalogoPublicoCorregidoV110_() {
  const snapshot = getPublicWebCatalogV94_({view:'catalog'});
  if (!snapshot || !Array.isArray(snapshot.products)) throw new Error('Catálogo público inválido');
  const byId = {};
  const audit = {matched:0,unmatched:0,stockKnown:0,stockUnknown:0,variantCount:0};
  getWebPublicationRows().forEach(function(r) {
    if (!publicWebYesV12_(r.PUBLICADO)) return;
    const key = String(r.KEY || [r.NOMBRE_PUBLICO,r.CATEGORIA_PUBLICA,r.MARCA_PUBLICA].join('|'));
    const id = publicWebIdV12_(key);
    byId[id] = r;
  });
  snapshot.products.forEach(function(p) {
    const r = byId[p.id];
    if (!r) { audit.unmatched++; return; }
    audit.matched++;
    const flexible = !!r.STOCK_NO_LIMITANTE;
    const raw = r.STOCK_PUBLICO;
    const known = !flexible && raw !== '' && raw != null && Number.isFinite(Number(raw));
    // Nunca presentar 999999 como stock real ni inferir cero cuando falta el dato.
    if (known) {
      p.stock = Math.max(0,Number(raw));
      p.stockStatus = 'known';
    } else {
      delete p.stock;
      p.stockStatus = 'unknown';
    }
    // Mantener únicamente las variantes existentes; no inventar 'Única'.
    const variants = publicWebListV12_(r.VARIANTES)
      .map(publicWebCleanTextV84_)
      .filter(function(v){return !!v && !/^(única|unica)$/i.test(v);});
    p.variants = Array.from(new Set(variants));
    audit.variantCount += p.variants.length;
    if (p.stockStatus === 'known') audit.stockKnown++; else audit.stockUnknown++;
  });
  // Diagnóstico interno: no se incorpora al JSON enviado al sitio.
  Logger.log('WTS V110 auditoría previa: '+JSON.stringify(audit));
  if (audit.unmatched > 0) throw new Error('No se puede sincronizar: '+audit.unmatched+' productos sin correspondencia en publicación');
  return snapshot;
}

/** Diagnóstico solo lectura, sin exportar ni escribir hojas. */
function auditarCatalogoCorregidoV110_() {
  const data = wtsCatalogoPublicoCorregidoV110_();
  const sample = data.products.slice(0,5).map(function(p) {
    return {id:p.id,name:p.name,variants:p.variants,stock:p.stock,
      stockStatus:p.stockStatus};
  });
  const result = {ok:true,total:data.products.length,stockConocido:data.products.filter(function(p){return p.stockStatus==='known';}).length,stockAConfirmar:data.products.filter(function(p){return p.stockStatus==='unknown';}).length,sample:sample};
  Logger.log(JSON.stringify(result,null,2));
  return result;
}
