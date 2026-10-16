/* V98: fallback de imágenes sin exponer enlaces internos de proveedores. */
(function(){
 const fallback="assets/termo-acero.svg";
 document.addEventListener("error",function(e){
  const img=e.target;
  if(!(img instanceof HTMLImageElement)||img.dataset.wtsFallbackApplied)return;
  img.dataset.wtsFallbackApplied="1";
  img.src=fallback;
 },true);
})();
