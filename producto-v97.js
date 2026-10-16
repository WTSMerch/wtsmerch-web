/* WTS V97 - ficha de producto, rama de pruebas */
function wtsEsc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function setupProduct(){
 const host=document.getElementById("productPage");if(!host)return;
 const params=new URLSearchParams(location.search),p=productById(params.get("id"));
 if(!p){host.innerHTML='<section style="padding:40px"><h1>Producto no disponible</h1><a href="catalogo.html">Volver al catálogo</a></section>';return;}
 const min=Math.max(1,Math.ceil(Number(p.min)||1));
 const variants=Array.isArray(p.variants)?p.variants.filter(Boolean):[];
 const images=[p.image,...(Array.isArray(p.images)?p.images:[])].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
 const selected=params.get("variant")||variants[0]||"";
 const qty=Math.max(min,Number(params.get("qty"))||min);
 const img=images[0]||"assets/termo-acero.svg";
 const buy=p.canBuy===true&&Array.isArray(p.modes)&&p.modes.includes("buy")&&Number(p.publicPrice)>0;
 host.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:32px;padding:30px 0">
 <section><img id="pdMainImage" src="${wtsEsc(img)}" alt="${wtsEsc(p.name)}" style="width:100%;max-height:520px;object-fit:contain">
 <div style="display:flex;gap:8px;flex-wrap:wrap">${images.slice(0,8).map((url,i)=>`<button type="button" data-pd-img="${wtsEsc(url)}" aria-label="Imagen ${i+1}"><img src="${wtsEsc(url)}" alt="" style="width:65px;height:65px;object-fit:contain"></button>`).join("")}</div></section>
 <section><a href="catalogo.html">← Volver al catálogo</a><p>${wtsEsc(p.category||"")}${p.brand?" · "+wtsEsc(p.brand):""}</p><h1>${wtsEsc(p.name)}</h1>
 <p>${wtsEsc(p.description||p.descripcion||p.desc||"Consultá las características y opciones de personalización.")}</p>
 ${p.characteristics||p.caracteristicas||p.features?`<h3>Características</h3><p style="white-space:pre-line">${wtsEsc(p.characteristics||p.caracteristicas||p.features)}</p>`:""}
 <p><strong>${Number(p.publicPrice)>0?ars(p.publicPrice)+" neto + IVA":"Precio a consultar"}</strong></p>
 <p>Pedido mínimo: ${min} unidades</p>
 ${variants.length?`<label for="pdVariant">Color / variante</label><select id="pdVariant" style="display:block;width:100%;padding:12px;margin:8px 0 18px">${variants.map(v=>`<option value="${wtsEsc(v)}" ${v===selected?"selected":""}>${wtsEsc(v)}</option>`).join("")}</select>`:""}
 <label for="pdQty">Cantidad</label><input id="pdQty" type="number" min="${min}" step="1" value="${qty}" style="display:block;width:140px;padding:12px;margin:8px 0 18px">
 <p>${buy?"Compra habilitada, sujeta a disponibilidad.":"Disponible para presupuesto o consulta. Compra directa no habilitada."}</p>
 <button type="button" id="pdAdd" class="btn primary">Agregar a la selección</button><p id="pdMsg" role="status" aria-live="polite"></p></section></div>`;
 host.querySelectorAll("[data-pd-img]").forEach(b=>b.addEventListener("click",()=>{host.querySelector("#pdMainImage").src=b.dataset.pdImg;}));
 host.querySelector("#pdAdd").addEventListener("click",()=>{
 const amount=Number(host.querySelector("#pdQty").value),variant=host.querySelector("#pdVariant")?.value||"",msg=host.querySelector("#pdMsg");
 if(!Number.isSafeInteger(amount)||amount<min){msg.textContent="Cantidad inválida. Mínimo: "+min;return;}
 if(p.stockStatus==="known"&&amount>Number(p.stock||0)){msg.textContent="La cantidad supera el stock disponible.";return;}
 const cart=normalizedCart(),row=cart.find(x=>x.id===p.id&&x.variant===variant);
 if(row)row.qty+=amount;else cart.push({id:p.id,qty:amount,variant,notes:""});
 saveCart(cart);msg.textContent="Producto agregado a la selección.";openCart();
 });
}
document.addEventListener("error",e=>{
 const el=e.target;if(!(el instanceof HTMLImageElement)||el.dataset.wtsFallback)return;
 el.dataset.wtsFallback="1";el.src="assets/termo-acero.svg";
},true);
