
let PRODUCTS=[];
const FALLBACK_PRODUCTS=[];
const cartKey="wts_public_cart_v7";
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const ars=n=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(n||0));
const IVA_RATE=.21;
const ivaAmount=net=>Number(net||0)*IVA_RATE;
const grossAmount=net=>Number(net||0)+ivaAmount(net);

let CATALOG_SOURCES=null;

let CATALOG_SOURCE_LABEL="demo";

function parseCsvLine(line){
 const out=[];let cur="";let quoted=false;
 for(let i=0;i<line.length;i++){
   const ch=line[i];
   if(ch==='"'){
     if(quoted&&line[i+1]==='"'){cur+='"';i++}
     else quoted=!quoted;
   }else if(ch===','&&!quoted){
     out.push(cur);cur="";
   }else cur+=ch;
 }
 out.push(cur);
 return out;
}
function parseCatalogCsv(text){
 const lines=String(text||"").replace(/\r/g,"").split("\n").filter(x=>x.trim()!=="");
 if(lines.length<2)return [];
 const headers=parseCsvLine(lines[0]).map(x=>x.trim());
 return lines.slice(1).map(line=>{
   const cells=parseCsvLine(line);
   const row={};
   headers.forEach((h,i)=>row[h]=(cells[i]??"").trim());
   return row;
 }).filter(row=>row.id||row.name);
}
function splitPipe(value){
 return String(value||"").split("|").map(x=>x.trim()).filter(Boolean);
}
function toBool(value,defaultValue=true){
 const v=String(value??"").trim().toLowerCase();
 if(!v)return defaultValue;
 return !["0","false","no","n"].includes(v);
}
function normalizeCatalogStock(p){
 // Stock omitido o nulo no equivale a cero. Nunca inventar disponibilidad.
 const raw=p.stock;
 const status=String(p.stockStatus||"").toLowerCase();
 const unknown=status==="unknown"||status==="pending"||raw===undefined||raw===null||raw===""||!Number.isFinite(Number(raw));
 if(unknown)return {...p,stock:null,stockStatus:"unknown",canBuy:false};
 return {...p,stock:Math.max(0,Number(raw)),stockStatus:status||"known"};
}
function validateCatalogProducts(list){
 const seen=new Set(),valid=[];
 list.forEach(raw=>{
   const p=normalizeCatalogStock(raw);
   if(!p.id||!p.name||!p.category)return;
   if(seen.has(p.id))return;
   seen.add(p.id);
   if(p.active!==false)valid.push(p);
 });
 return valid;
}

let CATALOG_META={categories:[],brands:[],collections:[],total:0};
let CATALOG_API_URL="";

async function getCatalogApiUrl(){
 if(CATALOG_API_URL)return CATALOG_API_URL;
 try{
   const cfg=await fetch("data/config.json",{cache:"no-store"});
   if(cfg.ok){const j=await cfg.json();CATALOG_API_URL=String(j.catalogApiUrl||"").trim();}
 }catch(e){}
 return CATALOG_API_URL;
}
async function fetchCatalogSlice(params={}){
 const apiUrl=await getCatalogApiUrl();
 if(!apiUrl)return {products:[],total:0,meta:{}};
 const u=new URL(apiUrl,location.href);
 Object.entries(params).forEach(([k,v])=>{
   if(v!==undefined&&v!==null&&String(v)!=="")u.searchParams.set(k,String(v));
 });
 const res=await fetch(u.toString(),{cache:"no-store"});
 if(!res.ok)throw new Error(`catalogo ${res.status}`);
 const data=await res.json();
 if(!data?.ok)throw new Error("catalogo inválido");
 return data;
}
async function loadPublicCatalog(){
 try{
   // Inicio: solo necesita destacados, no los 1493 productos.
   if($("#featuredGrid")&&!$("#catalogGrid")){
     const data=await fetchCatalogSlice({view:"home",limit:6});
     CATALOG_META=data.meta||{};
     CATALOG_SOURCE_LABEL="catalogo-publico-home";
     return validateCatalogProducts((data.products||[]).map(p=>({...p,active:p.active!==false})));
   }
   // Catálogo: primera página pequeña + metadatos de filtros.
   if($("#catalogGrid")){
     const data=await fetchCatalogSlice({view:"catalog",limit:24,offset:0});
     CATALOG_META=data.meta||{};
     CATALOG_META.total=Number(data.total||0);
     CATALOG_SOURCE_LABEL="catalogo-publico-paginado";
     return validateCatalogProducts((data.products||[]).map(p=>({...p,active:p.active!==false})));
   }
   // Ficha: solicitar el ID exacto; el catálogo general está paginado.
   if(document.getElementById("productPage")){
     const id=new URLSearchParams(location.search).get("id")||"";
     if(!id)return [];
     const data=await fetchCatalogSlice({view:"product",id,limit:1});
     CATALOG_META=data.meta||{};
     CATALOG_SOURCE_LABEL="catalogo-publico-producto";
     return validateCatalogProducts((data.products||[]).map(p=>({...p,active:p.active!==false})));
   }
   // Producto / carrito / checkout conservan compatibilidad completa por ahora.
   const data=await fetchCatalogSlice({});
   const list=Array.isArray(data?.products)?data.products:[];
   const normalized=validateCatalogProducts(list.map(p=>({...p,active:p.active!==false})));
   if(normalized.length){CATALOG_SOURCE_LABEL="catalogo-publico";return normalized;}
 }catch(e){}
 if(document.getElementById("productPage"))return [];
 try{
   const res=await fetch("data/catalogo_publico.json",{cache:"no-store"});
   if(!res.ok)throw new Error("catalogo-publico");
   const data=await res.json();
   const list=Array.isArray(data?.products)?data.products:[];
   const normalized=validateCatalogProducts(list.map(p=>({...p,active:p.active!==false})));
   if(normalized.length){CATALOG_SOURCE_LABEL="catalogo_publico.json";return normalized;}
 }catch(e){}
 return [];
}
function computedNetPrice(product){return Number(product?.publicPrice||0);}
function taxBreakdownHtml(net,subtotalLabel="Subtotal neto"){
 const iva=ivaAmount(net),total=grossAmount(net);
 return `<div class="tax-line"><span>${subtotalLabel}</span><b>${ars(net)}</b></div><div class="tax-line"><span>IVA 21%</span><b>${ars(iva)}</b></div><div class="tax-line tax-total"><span>Total con IVA</span><b>${ars(total)}</b></div>`;
}


function setupFileInput(inputId,listId){
 const input=$(inputId),list=$(listId); if(!input||!list)return;
 const render=()=>{
   const names=[...(input.files||[])].map(f=>f.name);
   list.textContent=names.length?`${names.length} archivo${names.length===1?"":"s"}: ${names.join(" · ")}`:"";
 };
 input.addEventListener("change",render);render();
}
function fileNames(inputId){
 const input=$(inputId);
 return input?[...(input.files||[])].map(f=>f.name):[];
}
const getCart=()=>{try{return JSON.parse(localStorage.getItem(cartKey)||"[]")}catch{return[]}};
const saveCart=c=>{localStorage.setItem(cartKey,JSON.stringify(c));renderCart();renderCheckout();};
const productById=id=>PRODUCTS.find(p=>p.id===id);
const cartLineKey=(id,variant)=>`${id}::${variant||""}`;
const stockLimit=p=>p&&p.stockStatus!=="unknown"&&p.stock!==undefined&&p.stock!==null&&p.stock!==""&&Number.isFinite(Number(p.stock))?Math.max(0,Number(p.stock)):null;
const cartQuantityLimit=p=>{const stock=stockLimit(p);return stock===null||stock===0?999999:stock;};
const cartCanBuy=()=>{const c=normalizedCart();return c.length>0&&c.every(r=>{const p=productById(r.id),stock=stockLimit(p);return p&&p.canBuy!==false&&(!Array.isArray(p.modes)||p.modes.includes("buy"))&&stock!==null&&stock>0&&r.qty<=stock;});};

function normalizedCart(){
  const raw=getCart();
  return raw.map(x=>typeof x==="string"?{id:x,qty:productById(x)?.min||1}:x)
    .filter(x=>productById(x.id))
    .map(x=>{const p=productById(x.id);return {id:x.id,qty:Math.min(Math.max(Number(x.qty)||1,1),cartQuantityLimit(p)),variant:x.variant||p?.variants?.[0]||"",notes:x.notes||""}});
}

function card(p){
 return `<article class="product-card">
  <div class="product-card-media">
    <a class="product-image" href="producto.html?id=${encodeURIComponent(p.id)}" aria-label="Ver ${p.name}"><img src="${p.image}" alt="${p.name}" loading="${$("#featuredGrid")&&!$("#catalogGrid")?"eager":"lazy"}" fetchpriority="${$("#featuredGrid")&&!$("#catalogGrid")?"high":"auto"}" decoding="async"></a>
  </div>
  <div class="product-info">
    <div class="product-meta-badges"><span class="meta">${p.category}</span>${p.brand?`<span class="brand-chip">${p.brand}</span>`:""}${Array.isArray(p.collection)&&p.collection.includes("Tecnología Premium")?`<span class="premium-chip">Tecnología Premium</span>`:""}</div>
    <h3><a href="producto.html?id=${encodeURIComponent(p.id)}">${p.name}</a></h3>
    <div class="price-line">${computedNetPrice(p)?`<b>${ars(computedNetPrice(p))}</b><small> neto + IVA</small>`:"<b>Consultar</b>"}</div>
    <div class="product-facts">
      <span><strong>Mínimo</strong> ${p.min} u.</span>
      <span class="stock-badge ${p.stockStatus==="unknown"?"stock-pending":(p.stock>0?"in-stock":"no-stock")}">${p.stockStatus==="unknown"?"Disponibilidad a confirmar":(p.stock>0?`Disponible · ${p.stock} u.`:"Sin stock")}</span>
    </div>
    <div class="card-actions catalog-card-actions">
      <a class="card-detail-link" href="producto.html?id=${encodeURIComponent(p.id)}">Ver colores y detalles</a>
      ${p.stockStatus==="unknown"
        ?`<a class="quick-add full-add selection-link" href="producto.html?id=${encodeURIComponent(p.id)}">Agregar a selección</a>`
        :`<button class="quick-add full-add" data-add="${p.id}" ${p.stock<=0?"disabled":""}>${p.stock>0?"Agregar al carrito":"Sin stock"}</button>`}
    </div>
  </div>
 </article>`;
}

async function hydrateCartProducts(){
 // El catálogo paginado no contiene necesariamente los productos del carrito.
 // Recuperamos sus fichas sin modificar el almacenamiento local.
 const raw=getCart();
 if(!Array.isArray(raw))return;
 const ids=[...new Set(raw.map(row=>typeof row==="string"?row:row&&row.id).filter(Boolean))];
 const missing=ids.filter(id=>!productById(id));
 if(!missing.length)return;
 await Promise.all(missing.map(async id=>{
  try{
   const data=await fetchCatalogSlice({view:"product",id,limit:1});
   const product=validateCatalogProducts(data.products||[]).find(p=>p.id===id);
   if(product&&!productById(id))PRODUCTS.push(product);
  }catch(e){console.warn("No se pudo recuperar un producto del carrito",id);}
 }));
}
async function loadProducts(){
 const publicProducts=await loadPublicCatalog();
 PRODUCTS=document.getElementById('productPage')?publicProducts:(publicProducts.length?publicProducts:FALLBACK_PRODUCTS);
 await hydrateCartProducts();
 initPage();
}

function setupFeaturedAutoplay(){
 const rail=$("#featuredGrid");
 if(!rail)return;

 let timer=null;
 let observer=null;

 const stop=()=>{
   if(timer){ clearInterval(timer); timer=null; }
 };

 const move=()=>{
   const cards=rail.querySelectorAll(".product-card");
   if(cards.length<2)return;

   const first=cards[0];
   const second=cards[1];
   let amount=0;

   if(second){
     amount=second.getBoundingClientRect().left-first.getBoundingClientRect().left;
   }
   if(!amount || amount<20){
     const gap=parseFloat(getComputedStyle(rail).gap)||18;
     amount=first.getBoundingClientRect().width+gap;
   }

   const max=rail.scrollWidth-rail.clientWidth;
   if(max<=10)return;

   if(rail.scrollLeft>=max-10){
     rail.scrollTo({left:0,behavior:"smooth"});
   }else{
     rail.scrollBy({left:amount,behavior:"smooth"});
   }
 };

 const start=()=>{
   stop();
   if(rail.querySelectorAll(".product-card").length<2)return;
   timer=setInterval(move,3000);
 };

 const armWhenReady=()=>{
   if(rail.querySelectorAll(".product-card").length>=2){
     start();
     if(observer){ observer.disconnect(); observer=null; }
     return true;
   }
   return false;
 };

 // En Home las tarjetas llegan después del fetch: esperar a que existan.
 if(!armWhenReady()){
   observer=new MutationObserver(armWhenReady);
   observer.observe(rail,{childList:true,subtree:false});
 }

 // Comportamiento solicitado: pausa al posar el mouse y reanuda al salir.
 rail.addEventListener("mouseenter",stop);
 rail.addEventListener("mouseleave",start);
 rail.addEventListener("touchstart",stop,{passive:true});
 rail.addEventListener("touchend",()=>setTimeout(start,1200),{passive:true});
 window.addEventListener("resize",start,{passive:true});
}

function setupFeaturedMarqueeV34(){
  const rail=$("#featuredGrid");
  if(!rail)return;

  let built=false;
  const build=()=>{
    if(built)return true;
    const cards=Array.from(rail.children).filter(el=>el.classList && el.classList.contains("product-card"));
    if(cards.length<2)return false;

    built=true;
    rail.style.animation="none";

    const viewport=document.createElement("div");
    viewport.className="featured-viewport-v34";
    const track=document.createElement("div");
    track.className="featured-track-v34";

    cards.forEach(c=>track.appendChild(c));
    cards.forEach(c=>track.appendChild(c.cloneNode(true)));

    rail.innerHTML="";
    viewport.appendChild(track);
    rail.appendChild(viewport);

    let x=0, paused=false, last=performance.now(), loopWidth=0;
    const measure=()=>{
      const originals=Array.from(track.children).slice(0,cards.length);
      if(!originals.length)return;
      const gap=parseFloat(getComputedStyle(track).gap)||14;
      loopWidth=originals.reduce((sum,c)=>sum+c.getBoundingClientRect().width,0)+gap*originals.length;
    };
    const frame=(now)=>{
      const dt=Math.min(40,now-last); last=now;
      if(!paused && loopWidth>0){
        x-=28*(dt/1000); // continuous, calm movement
        if(-x>=loopWidth)x+=loopWidth;
        track.style.transform=`translate3d(${x}px,0,0)`;
      }
      requestAnimationFrame(frame);
    };

    viewport.addEventListener("mouseenter",()=>paused=true);
    viewport.addEventListener("mouseleave",()=>{paused=false;last=performance.now();});
    viewport.addEventListener("touchstart",()=>paused=true,{passive:true});
    viewport.addEventListener("touchend",()=>{paused=false;last=performance.now();},{passive:true});

    requestAnimationFrame(()=>{
      measure();
      window.addEventListener("resize",measure,{passive:true});
      requestAnimationFrame(frame);
      bindAdds();
    });
    return true;
  };

  if(!build()){
    const obs=new MutationObserver(()=>{
      if(build())obs.disconnect();
    });
    obs.observe(rail,{childList:true});
  }
}

// Ficha pública: datos existentes del catálogo, sin inventar stock ni variantes.
function setupProduct(){
 const host=document.getElementById("productPage");if(!host)return;
 const detailParams=new URLSearchParams(location.search);
 const id=detailParams.get("id")||"";
 const originalVariant=detailParams.get("variant");
 const editingCart=detailParams.has("qty")&&originalVariant!==null;
 const p=PRODUCTS.find(x=>String(x.id)===id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 if(!p){host.innerHTML='<div class="product-not-found"><h1>Producto no disponible</h1><a href="catalogo.html">Volver al catálogo</a></div>';return;}
 const photos=[p.image,...(Array.isArray(p.images)?p.images:[])].filter(Boolean);
 const unique=[...new Set(photos)];
 const variants=Array.isArray(p.variants)?p.variants.filter(v=>v&&String(v).toLowerCase()!=="única"&&String(v).toLowerCase()!=="unica"):[];
 const known=p.stock!==undefined&&p.stock!==null&&p.stock!==""&&Number.isFinite(Number(p.stock))&&p.stockStatus!=="unknown";
 const min=Math.max(1,Number(p.min)||1),net=computedNetPrice(p);
 host.innerHTML='<div class="product-detail"><a href="catalogo.html">← Volver al catálogo</a><div class="product-detail-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:32px;margin:24px 0"><section><img src="'+esc(unique[0]||"")+'" alt="'+esc(p.name)+'" style="width:100%;max-height:520px;object-fit:contain"></section><section><p>'+esc(p.category||"")+'</p><h1>'+esc(p.name)+'</h1>'+(p.desc||p.description?'<p>'+esc(p.desc||p.description)+'</p>':"")+'<p><strong>'+(net?ars(net)+" neto + IVA":"Consultar precio")+'</strong></p>'+(net?taxBreakdownHtml(net,"Precio neto por unidad"):"")+'<p>Mínimo: '+min+' unidades</p><p>'+(known?(Number(p.stock)>0?"Disponibilidad: "+Number(p.stock)+" unidades":"Sin stock"):"Disponibilidad a confirmar")+'</p>'+(variants.length?'<label for="wtsDetailVariant">Color / variante</label><select id="wtsDetailVariant">'+variants.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join("")+'</select>':"")+'<label for="wtsDetailQty">Cantidad</label><input id="wtsDetailQty" type="number" min="'+min+'" value="'+min+'"><button id="wtsDetailAdd" type="button" '+(known&&Number(p.stock)<=0?"disabled":"")+'>'+(known&&Number(p.stock)<=0?"Sin stock":"Agregar al carrito")+'</button></section></div></div>';
 const qtyInput=host.querySelector("#wtsDetailQty"),variantInput=host.querySelector("#wtsDetailVariant");
 if(editingCart){
   const requestedQty=Number(detailParams.get("qty"));
   if(Number.isInteger(requestedQty)&&requestedQty>0)qtyInput.value=String(requestedQty);
   if(variantInput&&variants.includes(originalVariant))variantInput.value=originalVariant;
   host.querySelector("#wtsDetailAdd").textContent="Actualizar carrito";
 }
 host.querySelector("#wtsDetailAdd")?.addEventListener("click",()=>{
   const qty=Math.max(min,Math.floor(Number(host.querySelector("#wtsDetailQty").value)||min));
   if(known&&qty>Number(p.stock)){alert("La cantidad supera la disponibilidad indicada.");return;}
   const variant=host.querySelector("#wtsDetailVariant")?.value||"";
   const c=getCart();
   const sourceIndex=editingCart?c.findIndex(x=>x.id===p.id&&(x.variant||"")===originalVariant):-1;
   const notes=sourceIndex>=0?c[sourceIndex].notes||"":"";
   // Reemplazar la línea editada; conservar las demás variantes del pedido.
   if(sourceIndex>=0)c.splice(sourceIndex,1);
   const existing=c.find(x=>x.id===p.id&&(x.variant||"")===variant);
   if(existing)existing.qty=qty;else c.push({id:p.id,qty,variant,notes});
   saveCart(c);showCartToast(p,{qty,variant});
 });
}
function initPage(){
 const feat=$("#featuredGrid"); if(feat){const f=PRODUCTS.filter(p=>p.featured);feat.innerHTML=(f.length?f:PRODUCTS).slice(0,6).map(card).join("");}
 setupCatalog(); if(typeof setupProduct==="function")setupProduct(); setupSearch(); setupCart(); setupCheckout(); setupConsult(); setupQuoteOnly(); setupHeaderScrollSearch(); setupBackToTop(); setupFeaturedMarqueeV34(); bindAdds();
}
// Habilitar la consulta sin esperar a la API remota del catálogo.
function bootEmptyAdvisor(){
 if(!$("#consultSelection"))return;
 try{
   if(getCart().length===0)setupConsult();
 }catch(_){setupConsult();}
}
if(document.readyState==="loading"){
 document.addEventListener("DOMContentLoaded",bootEmptyAdvisor,{once:true});
}else{bootEmptyAdvisor();}
loadProducts();

function setupHeaderScrollSearch(){
 const header=$(".site-header"); if(!header)return;
 // Home has its own welcome-aware header/search controller.
 if($("#bienvenida"))return;

 const inline=$(".search-inline");
 if(!inline)return;

 let expanded=false;
 const refresh=()=>{
   const scrolled=window.scrollY>24;
   if(scrolled)expanded=true;
   header.classList.toggle("header-scrolled",scrolled);
   header.classList.toggle("search-expanded",expanded);
 };

 window.addEventListener("scroll",refresh,{passive:true});
 refresh();

 inline.addEventListener("keydown",e=>{
   if(e.key==="Enter"){
     const q=inline.value.trim();
     if(q)window.location.href=`catalogo.html?q=${encodeURIComponent(q)}`;
   }
 });

 $(".search-open",header)?.addEventListener("click",()=>{
   expanded=true;
   header.classList.add("search-expanded");
   window.setTimeout(()=>inline.focus(),80);
 });
}
function setupWelcomeGate(){
 const gate=$("#bienvenida"), header=$(".site-header"), enter=$("#enterStore");
 if(!gate||!header)return;

 const key="wts_store_entered_v2";
 let entered=false;
 try{ entered=sessionStorage.getItem(key)==="1"; }catch(_){ entered=false; }

 function finishStore(){
   gate.hidden=true;
   gate.classList.remove("welcome-leaving");
   document.body.classList.remove("welcome-locked");
   header.classList.remove("over-welcome");
   header.classList.add("after-welcome");
   window.scrollTo(0,0);
   try{ sessionStorage.setItem(key,"1"); }catch(_){}
 }

 function showStore(animate=true){
   // Do not block the button because of a stale session flag.
   entered=true;
   document.body.classList.remove("welcome-locked");
   header.classList.remove("over-welcome");
   header.classList.add("after-welcome");
   if(!animate){ finishStore(); return; }
   gate.classList.add("welcome-leaving");
   window.setTimeout(finishStore,320);
 }

 function showWelcome(){
   entered=false;
   gate.hidden=false;
   gate.classList.remove("welcome-leaving");
   document.body.classList.add("welcome-locked");
   header.classList.add("over-welcome");
   header.classList.remove("after-welcome");
   window.scrollTo(0,0);
 }

 if(entered){
   finishStore();
 }else{
   showWelcome();
 }

 if(enter){
   enter.onclick=(e)=>{
     e.preventDefault();
     e.stopPropagation();
     showStore(true);
   };
 }

 // Global fallback for local file:// testing and unusual browser event handling.
 window.enterWTSStore=()=>showStore(true);

 const blockScroll=e=>{
   if(!entered && !gate.hidden){
     e.preventDefault();
     return false;
   }
 };
 window.addEventListener("wheel",blockScroll,{passive:false});
 window.addEventListener("touchmove",blockScroll,{passive:false});
}
function setupBackToTop(){
 const btn=$(".back-to-top"); if(!btn)return;
 const refresh=()=>btn.classList.toggle("visible",window.scrollY>520);
 window.addEventListener("scroll",refresh,{passive:true});refresh();
 btn.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
}
function bindAdds(){
 $$('[data-add]').forEach(b=>b.onclick=()=>{
   const id=b.dataset.add,p=productById(id);
   if(!p||p.stock<=0)return;
   const c=normalizedCart();
   const defaultVariant=p.variants?.[0]||'';
   let row=c.find(x=>x.id===id&&x.variant===defaultVariant);
   if(row){row.qty=Math.min(p.stock,row.qty+p.min)}
   else{row={id,qty:Math.min(p.min,p.stock),variant:defaultVariant,notes:''};c.push(row)}
   saveCart(c);
   showCartToast(p,row);
 })
}
function ensureCartToast(){
 let toast=document.getElementById('cartToast');
 if(!toast){toast=document.createElement('div');toast.id='cartToast';toast.className='cart-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.appendChild(toast)}
 return toast;
}
function showCartToast(p,row){
 const toast=ensureCartToast();
 toast.innerHTML=`<div class="cart-toast-icon">✓</div><div class="cart-toast-copy"><b>Producto agregado al carrito</b><span>${p.name}</span><small>${row.qty} unidades${row.variant?` · ${row.variant}`:''}</small></div><button class="toast-close" aria-label="Cerrar">×</button><div class="cart-toast-actions"><button type="button" id="toastContinue">Seguir comprando</button><button type="button" class="primary-mini" id="toastCart">Ver carrito</button></div>`;
 toast.classList.remove('show');void toast.offsetWidth;toast.classList.add('show');
 clearTimeout(window.__wtsToastTimer);window.__wtsToastTimer=setTimeout(()=>toast.classList.remove('show'),7000);
 $('#toastContinue')?.addEventListener('click',()=>toast.classList.remove('show'));
 $('#toastCart')?.addEventListener('click',()=>{toast.classList.remove('show');openCart()});
 $('.toast-close',toast)?.addEventListener('click',()=>toast.classList.remove('show'));
}

function setupCatalog(){
 const grid=$("#catalogGrid");if(!grid)return;
 const cf=$("#categoryFilters");
 const categories=(CATALOG_META.categories||[]).filter(Boolean);
 cf.innerHTML=categories.map(c=>`<label><input class="catFilter" type="checkbox" value="${c}"> ${c}</label>`).join("");

 const params=new URLSearchParams(location.search);
 const urlcat=params.get("cat"),urlq=params.get("q"),urlbrand=params.get("brand"),urlcollection=params.get("collection");
 if(urlcat){const el=$(`.catFilter[value="${CSS.escape(urlcat)}"]`);if(el)el.checked=true}
 if(urlq&&$("#catalogSearch"))$("#catalogSearch").value=urlq;
 if(urlbrand){const el=$(`.brandFilter[value="${CSS.escape(urlbrand)}"]`);if(el)el.checked=true}
 if(urlcollection){const el=$(`.collectionFilter[value="${CSS.escape(urlcollection)}"]`);if(el)el.checked=true}

 const categoryName=p=>String(p.category||"Sin categoría").trim()||"Sin categoría";
 const groupedCatalogHtml=items=>{\n   const sort=$("#sortSelect")?.value||"category";\n   if(sort!=="category")return items.map(card).join("");
   let previous="";
   return [...items].sort((a,b)=>categoryName(a).localeCompare(categoryName(b),"es")||String(a.name||"").localeCompare(String(b.name||""),"es")).map(p=>{
     const cat=categoryName(p),heading=cat!==previous?`<div class="catalog-category-heading" role="heading" aria-level="2"><span>${cat.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</span></div>`:"";
     previous=cat;return heading+card(p);
   }).join("");
 };
 const INITIAL_LIMIT=24, APPEND_LIMIT=12;
 let offset=0,loading=false,total=Number(CATALOG_META.total||0),observer=null;

 const updateUrl=()=>{
   const u=new URL(location.href);
   const brand=$(".brandFilter:checked")?.value||"";
   const collection=$(".collectionFilter:checked")?.value||"";
   const term=($("#catalogSearch")?.value||"").trim();
   const cat=$(".catFilter:checked")?.value||"";
   if(brand)u.searchParams.set("brand",brand);else u.searchParams.delete("brand");
   if(collection)u.searchParams.set("collection",collection);else u.searchParams.delete("collection");
   if(term)u.searchParams.set("q",term);else u.searchParams.delete("q");
   if(cat)u.searchParams.set("cat",cat);else u.searchParams.delete("cat");
   history.replaceState(null,"",u.pathname+u.search);
 };

 const updateScope=()=>{
   const brand=$(".brandFilter:checked")?.value||"";
   const collection=$(".collectionFilter:checked")?.value||"";
   const scope=$("#catalogScope"),heading=$("#catalogHeading"),intro=$("#catalogIntro");
   if(!scope)return;
   const active=brand||collection;
   scope.hidden=!active;
   if(active){
     const label=brand||collection;
     scope.innerHTML=`<span>Viendo</span><b>${label}</b><button type="button" id="clearScope">Ver todo el catálogo</button>`;
     if(heading)heading.textContent=label;
     if(intro)intro.textContent=brand?`Explorá los productos ${brand} disponibles en WTS Merch.`:`Explorá nuestra selección de ${label}.`;
     $("#clearScope")?.addEventListener("click",()=>{
       $$(".brandFilter,.collectionFilter").forEach(x=>x.checked=false);
       updateUrl();loadPage(false);
     });
   }else{
     if(heading)heading.textContent="Productos para potenciar tu marca";
     if(intro)intro.textContent="Explorá ideas, filtrá por categoría y armá una selección para solicitar presupuesto.";
   }
 };

 function removeLegacyMore(){
   document.getElementById("catalogLoadMore")?.remove();
   document.getElementById("catalogMoreBtn")?.remove();
 }

 function armInfiniteScroll(){
   removeLegacyMore();
   let sentinel=document.getElementById("catalogScrollSentinelV96");
   if(offset>=total){
     if(observer)observer.disconnect();
     sentinel?.remove();
     return;
   }
   if(!sentinel){
     sentinel=document.createElement("div");
     sentinel.id="catalogScrollSentinelV96";
     sentinel.setAttribute("aria-hidden","true");
     sentinel.style.cssText="height:2px;width:100%;pointer-events:none";
     grid.insertAdjacentElement("afterend",sentinel);
   }
   if(observer)observer.disconnect();
   observer=new IntersectionObserver(entries=>{
     if(entries.some(e=>e.isIntersecting)&&!loading&&offset<total)loadPage(true);
   },{root:null,rootMargin:"800px 0px",threshold:0});
   observer.observe(sentinel);
 }

 async function loadPage(append=false){
   if(loading)return;
   loading=true;
   if(!append){
     offset=0;
     if(observer)observer.disconnect();
     document.getElementById("catalogScrollSentinelV96")?.remove();
     removeLegacyMore();
     grid.innerHTML=`<div class="catalog-loading"><p>Cargando productos…</p></div>`;
   }
   const term=($("#catalogSearch")?.value||"").trim();
   const cat=$(".catFilter:checked")?.value||"";
   const brand=$(".brandFilter:checked")?.value||"";
   const collection=$(".collectionFilter:checked")?.value||"";
   const sort=$("#sortSelect")?.value||"category";
   const requestLimit=append?APPEND_LIMIT:INITIAL_LIMIT;
   try{
     const data=await fetchCatalogSlice({view:"catalog",limit:requestLimit,offset,q:term,cat,brand,collection,sort});
     const rows=validateCatalogProducts((data.products||[]).map(p=>({...p,active:p.active!==false})));
     total=Number.isFinite(Number(data.total))?Number(data.total):rows.length;
     if(append)PRODUCTS=PRODUCTS.concat(rows.filter(p=>!PRODUCTS.some(x=>x.id===p.id)));
     else PRODUCTS=rows;
     const html=groupedCatalogHtml(PRODUCTS);
     grid.innerHTML=html||`<div class="catalog-empty-state"><span class="eyebrow">SIN RESULTADOS</span><h3>No encontramos productos.</h3><p>Probá quitando filtros o realizando otra búsqueda.</p></div>`;
     offset+=rows.length;
     if($("#resultsCount"))$("#resultsCount").textContent=`${total} producto${total===1?"":"s"}`;
     updateScope();bindAdds();
   }catch(e){
     if(!append)grid.innerHTML=`<div class="catalog-empty-state"><h3>No pudimos cargar el catálogo.</h3><p>Reintentá en unos segundos.</p></div>`;
   }finally{
     loading=false;
     armInfiniteScroll();
   }
 }

 let debounce;
 ["input","change"].forEach(ev=>document.addEventListener(ev,e=>{
   if(!e.target.matches("#catalogSearch,.catFilter,#sortSelect,.brandFilter,.collectionFilter"))return;
   if(e.target.matches(".brandFilter")&&e.target.checked)$$(".collectionFilter").forEach(y=>y.checked=false);
   if(e.target.matches(".collectionFilter")&&e.target.checked)$$(".brandFilter").forEach(y=>y.checked=false);
   updateUrl();
   clearTimeout(debounce);
   debounce=setTimeout(()=>loadPage(false),e.type==="input"?250:0);
 }));

 const hasInitialFilter=!!(urlcat||urlq||urlbrand||urlcollection);
 if(hasInitialFilter){
   loadPage(false);
 }else{
   grid.innerHTML=groupedCatalogHtml(PRODUCTS)||`<div class="catalog-empty-state"><h3>No encontramos productos.</h3></div>`;
   offset=PRODUCTS.length;
   if($("#resultsCount"))$("#resultsCount").textContent=`${total} producto${total===1?"":"s"}`;
   updateScope();bindAdds();armInfiniteScroll();
 }
}
function setupSearch(){
 const ov=$(".search-overlay");if(!ov)return;
 $$(".search-open").forEach(b=>b.onclick=()=>ov.classList.add("open"));$(".overlay-close").onclick=()=>ov.classList.remove("open");
 const inp=$("#globalSearch"),res=$("#searchResults");inp?.addEventListener("input",()=>{const t=inp.value.toLowerCase().trim();if(!t){res.innerHTML="";return}
 const arr=PRODUCTS.filter(p=>`${p.name} ${p.category} ${p.tag}`.toLowerCase().includes(t)).slice(0,6);
 res.innerHTML=arr.map(p=>`<a class="search-result" href="producto.html?id=${p.id}"><img src="${p.image}"><div><b>${p.name}</b><small>${p.category}</small></div></a>`).join("")});
}
function openCart(){$(".cart-drawer")?.classList.add("open");$(".drawer-backdrop")?.classList.add("open")}
function closeCart(){$(".cart-drawer")?.classList.remove("open");$(".drawer-backdrop")?.classList.remove("open")}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$(".cart-drawer.open"))closeCart()});
function setupCart(){
 $$(".cart-open").forEach(b=>b.onclick=openCart);if($(".drawer-close"))$(".drawer-close").onclick=closeCart;if($(".drawer-backdrop"))$(".drawer-backdrop").onclick=closeCart;
 renderCart();
}

function compactCartChoices(){
  const drawer=document.querySelector(".cart-drawer");if(!drawer)return;
  drawer.querySelectorAll(".service-paths").forEach(el=>el.remove());
  let block=drawer.querySelector(".compact-cart-choices");
  if(!block){
    block=document.createElement("div");block.className="compact-cart-choices";
    const cartProducts=normalizedCart().map(x=>productById(x.id)).filter(Boolean);
    const canCheckout=cartCanBuy();
    block.innerHTML=`<div class="compact-choice-title">Continuar como:</div><div class="compact-choice-row">${canCheckout?`<a href="checkout.html" class="compact-choice primary"><b>Comprar</b><span>Continuar pedido</span></a>`:`<span class="compact-choice disabled-choice"><b>Compra directa</b><span>Disponibilidad a confirmar</span></span>`}<a href="cotizacion.html" class="compact-choice ${canCheckout?'':'primary'}"><b>Presupuesto</b><span>Sin confirmar compra</span></a><a href="consulta.html" class="compact-choice"><b>Asesor</b><span>Recibir ayuda</span></a></div>`;
    const sum=drawer.querySelector("#cartSummary");if(sum)sum.insertAdjacentElement("afterend",block);
  }
}

function renderCart(){
 const c=normalizedCart(),items=$("#cartItems"),empty=$("#drawerEmpty"),sum=$("#cartSummary");
 $$(".cart-count").forEach(x=>x.textContent=c.reduce((a,b)=>a+b.qty,0));
 if(!items)return;
 items.innerHTML=c.map((row,i)=>{const p=productById(row.id),sub=computedNetPrice(p)*row.qty,href=`producto.html?id=${encodeURIComponent(p.id)}&variant=${encodeURIComponent(row.variant||"")}&qty=${encodeURIComponent(row.qty)}`;return `<div class="cart-item">
   <a class="cart-product-link cart-product-image" href="${href}" aria-label="Volver a ${p.name}"><img src="${p.image}" alt="${p.name}"></a><div class="cart-item-main"><a class="cart-product-link cart-product-name" href="${href}"><b>${p.name}</b></a><small>${row.variant||""}</small><small>Mínimo total del producto: ${p.min} u. · ${stockLimit(p)===null?"Disponibilidad a confirmar":`Stock ${stockLimit(p)} u.`}</small>
   <div class="qty-control"><button data-dec="${i}">−</button><input data-qty="${i}" type="number" min="1" ${stockLimit(p)===null||stockLimit(p)===0?"":`max="${stockLimit(p)}"`} step="1" value="${row.qty}"><button data-inc="${i}">+</button></div><a class="cart-edit-link" href="${href}">Cambiar color / agregar variante</a></div>
   <div class="cart-item-price"><b>${computedNetPrice(p)?ars(sub):"Consultar"}</b><button data-remove="${i}" aria-label="Quitar ${p.name} ${row.variant||""}">×</button></div></div>`}).join("");
 if(empty)empty.style.display=c.length?"none":"block";
 const total=c.reduce((a,row)=>a+computedNetPrice(productById(row.id))*row.qty,0);
 if(sum)sum.innerHTML=c.length?`${taxBreakdownHtml(total,"Subtotal neto")}<small>Los precios de los productos se muestran sin IVA. El envío, si corresponde, se confirma antes de producir.</small>`:"";
 $$("[data-remove]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.remove);saveCart(c.filter((_,idx)=>idx!==i))});
 $$("[data-inc]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.inc),r=c[i],p=productById(r.id);r.qty=Math.min(cartQuantityLimit(p),r.qty+1);saveCart(c)});
 $$("[data-dec]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.dec),r=c[i],p=productById(r.id);r.qty=Math.max(1,r.qty-1);saveCart(c)});
 $$("[data-qty]").forEach(inp=>inp.onchange=()=>{const i=Number(inp.dataset.qty),r=c[i],p=productById(r.id),v=Math.max(1,Number(inp.value)||1);r.qty=Math.min(cartQuantityLimit(p),v);saveCart(c)});
 compactCartChoices();
}

function cartMinimumIssues(){
 const c=normalizedCart(),totals={};
 c.forEach(r=>totals[r.id]=(totals[r.id]||0)+r.qty);
 return Object.entries(totals).map(([id,qty])=>({p:productById(id),qty})).filter(x=>x.p&&x.qty<x.p.min);
}
function cartMinimumMessage(){
 const issues=cartMinimumIssues();
 if(!issues.length)return "";
 return `Revisá las cantidades mínimas: ${issues.map(x=>`${x.p.name}: ${x.qty}/${x.p.min} unidades`).join(" · ")}. Podés repartir el mínimo entre colores o variantes del mismo producto.`;
}

function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||"").trim())}

function onlyDigits(value){return String(value||"").replace(/\D/g,"")}
function validCuit(value){return onlyDigits(value).length===11}
function formatCuit(value){
 const d=onlyDigits(value).slice(0,11);
 if(d.length<=2)return d;
 if(d.length<=10)return `${d.slice(0,2)}-${d.slice(2)}`;
 return `${d.slice(0,2)}-${d.slice(2,10)}-${d.slice(10)}`;
}
function setupCuitInput(selector){
 const input=$(selector); if(!input)return;
 input.addEventListener("input",()=>{input.value=formatCuit(input.value)});
}
function setupRequiredDate(selector){
 const input=$(selector); if(!input)return;
 const now=new Date();
 const local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
 input.min=local;
}
function validRequiredDate(selector){
 const input=$(selector); if(!input||!input.value)return false;
 const now=new Date();
 const local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
 return input.value>=local;
}
function showFormError(host,msg){
  if(!host)return;
  host.textContent=msg;
  host.hidden=false;
  host.scrollIntoView({behavior:"smooth",block:"center"});
}
function clearFormError(host){if(host){host.hidden=true;host.textContent=""}}
function openFlowModal(id){
  const m=$(id);
  if(!m)return;
  m.classList.add("open");
  m.setAttribute("aria-hidden","false");
}


function showRequestReceiptV116(selector,reply){
 const modal=$(selector);
 if(!modal||!reply?.id)return;
 let receipt=modal.querySelector(".wts-request-receipt");
 if(!receipt){receipt=document.createElement("p");receipt.className="wts-request-receipt";receipt.setAttribute("role","status");const target=modal.querySelector(".flow-modal-content")||modal;target.appendChild(receipt);}
 receipt.textContent="Número de solicitud: "+String(reply.id);
}
function rejectUnsentFilesV117(selector){
 const input=$(selector);
 if(input&&input.files&&input.files.length){
  throw new Error("Los archivos adjuntos aún no se transfieren al sistema. Quitalos para enviar la solicitud sin adjuntos.");
 }
}
const requestInFlightV117=new Set();
function requestTokenV117(payload){
 const key="wts_pending_request_"+String(payload.tipo||"");
 const fingerprint=JSON.stringify(payload);
 try{
  const previous=JSON.parse(sessionStorage.getItem(key)||"null");
  if(previous&&previous.fingerprint===fingerprint&&previous.id)return previous.id;
 }catch(e){}
 const id="wts_"+(typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID().replace(/-/g,""):String(Date.now())+"_"+Math.random().toString(36).slice(2));
 try{sessionStorage.setItem(key,JSON.stringify({fingerprint,id}));}catch(e){}
 return id;
}
async function sendWebRequestV88(payload,button){
 const flow=String(payload.tipo||"");
 if(requestInFlightV117.has(flow))throw new Error("La solicitud ya se está enviando.");
 requestInFlightV117.add(flow);
 payload.requestId=requestTokenV117(payload);
 if(button){button.disabled=true;button.dataset.oldText=button.textContent;button.textContent="Enviando…";}
 try{
  const res=await fetch("api/solicitud.php",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  let j;
  try{j=await res.json();}catch(e){throw new Error("El servidor no devolvió una confirmación válida. Consultá antes de reenviar.");}
  if(!res.ok||j?.ok!==true)throw new Error(j?.error||"No se pudo registrar la solicitud");
  if(typeof j.id!=="string"||!j.id.trim())throw new Error("El servidor no confirmó un número de registro. Consultá antes de reenviar.");
  try{sessionStorage.removeItem("wts_pending_request_"+flow);}catch(e){}
  return j;
 }finally{
  requestInFlightV117.delete(flow);
  if(button){button.disabled=false;button.textContent=button.dataset.oldText||button.textContent;}
 }
}
function requestItemsV88(){return normalizedCart().map(r=>{const p=productById(r.id)||{};return {id:r.id,nombre:p.name||"",variante:r.variant||"",cantidad:Number(r.qty||0),precioNeto:Number(p.publicPrice||0)};});}
function customerV88(prefix){return {nombre:$("#"+prefix+"Name")?.value.trim()||"",empresa:$("#"+prefix+"Company")?.value.trim()||"",cuit:$("#"+prefix+"Cuit")?.value.trim()||"",email:$("#"+prefix+"Email")?.value.trim()||"",telefono:$("#"+prefix+"Phone")?.value.trim()||"",direccion:$("#"+prefix+"Address")?.value.trim()||"",localidad:$("#"+prefix+"City")?.value.trim()||"",codigoPostal:$("#"+prefix+"Postal")?.value.trim()||"",fechaNecesaria:$("#"+prefix+"Date")?.value||""};}

function setupCheckout(){
 renderCheckout();
 setupFileInput("#checkoutFiles","#checkoutFileList");
 setupCuitInput("#checkoutCuit");
 setupRequiredDate("#checkoutDate");
 const stages=[null,$("#checkoutStep1"),$("#checkoutStep2"),$("#checkoutStep3")];
 const marks=[null,$("#stepMark1"),$("#stepMark2"),$("#stepMark3")];
 const titles={
   1:["Revisá tu pedido","Confirmá productos, colores y cantidades antes de ingresar tus datos."],
   2:["Datos y entrega","Completá sólo la información necesaria para coordinar tu pedido."],
   3:["Última revisión","Verificá los datos y el pedido antes de confirmarlo."]
 };
 function goStep(n){
   for(let i=1;i<=3;i++){if(stages[i])stages[i].hidden=i!==n;if(marks[i])marks[i].className=i<n?"done":i===n?"active":""}
   if($("#checkoutTitle"))$("#checkoutTitle").textContent=titles[n][0];
   if($("#checkoutIntro"))$("#checkoutIntro").textContent=titles[n][1];
   window.scrollTo({top:0,behavior:"smooth"});
 }
 $("#toCheckoutData")?.addEventListener("click",()=>{
   const c=normalizedCart(); if(!c.length)return;
   const minMsg=cartMinimumMessage(); if(minMsg){alert(minMsg);return}
   goStep(2);
 });
 $("#backToReview")?.addEventListener("click",()=>goStep(1));
 $("#backToData")?.addEventListener("click",()=>goStep(2));

 $("#toCheckoutConfirm")?.addEventListener("click",()=>{
   const err=$("#checkoutError");clearFormError(err);
   if(!normalizedCart().length)return showFormError(err,"El carrito está vacío. Agregá al menos un producto antes de continuar.");
   const minMsg=cartMinimumMessage();if(minMsg)return showFormError(err,minMsg);
   const name=$("#checkoutName")?.value.trim(), email=$("#checkoutEmail")?.value.trim(), phone=$("#checkoutPhone")?.value.trim();
   if(!name)return showFormError(err,"Completá tu nombre y apellido.");
   if(!$("#checkoutCompany")?.value.trim())return showFormError(err,"Completá la empresa u organización.");
   if(!$("#checkoutCuit")?.value.trim())return showFormError(err,"Completá el CUIT.");
   if(!validCuit($("#checkoutCuit")?.value))return showFormError(err,"Ingresá un CUIT válido de 11 dígitos.");
   if(!email||!validEmail(email))return showFormError(err,"Ingresá un email válido.");
   if(!phone)return showFormError(err,"Ingresá un teléfono de contacto.");
   if(!$("#checkoutDate")?.value)return showFormError(err,"Indicá la fecha en que necesitás el pedido.");
   if(!validRequiredDate("#checkoutDate"))return showFormError(err,"La fecha necesaria no puede ser anterior a hoy.");
   if(!$("#checkoutAddress")?.value.trim())return showFormError(err,"Indicá la dirección.");
   if(!$("#checkoutCity")?.value.trim())return showFormError(err,"Indicá la localidad.");
   if(!$("#checkoutPostal")?.value.trim())return showFormError(err,"Indicá el código postal.");
   renderFinalCheckout();
   goStep(3);
 });
 $("#placeOrder")?.addEventListener("click",async e=>{if(!cartCanBuy()){alert("La compra directa no está disponible para uno o más productos. Solicitá presupuesto o contactá a un asesor.");return;}try{rejectUnsentFilesV117("#checkoutFiles");const receipt=await sendWebRequestV88({tipo:"COMPRA",cliente:customerV88("checkout"),entregaCanal:$('input[name="delivery"]:checked')?.value||"",comentarios:$("#checkoutComments")?.value.trim()||"",items:requestItemsV88()},e.currentTarget);showRequestReceiptV116("#checkoutSuccess",receipt);openFlowModal("#checkoutSuccess");localStorage.removeItem(CART_KEY);}catch(err){alert(err.message||"No se pudo confirmar el registro.");}});
}
function renderFinalCheckout(){
 const c=normalizedCart(), host=$("#finalOrderItems"), totals=$("#finalOrderTotals"), summary=$("#finalCustomerSummary");
 if(host)host.innerHTML=c.map(r=>{const p=productById(r.id),unit=p.publicPrice||0;return `<div class="final-order-line"><img src="${p.image}" alt=""><div><b>${p.name}</b><small>${r.variant||""} · ${r.qty} u.</small></div><strong>${computedNetPrice(p)?ars(unit*r.qty):"A cotizar"}</strong></div>`}).join("");
 const total=c.reduce((a,r)=>a+computedNetPrice(productById(r.id))*r.qty,0);
 if(totals)totals.innerHTML=`${taxBreakdownHtml(total,"Subtotal neto")}<small>Envío a confirmar</small>`;
 if(summary){
   const files=fileNames("#checkoutFiles");
   const comments=$("#checkoutComments")?.value.trim();
   summary.innerHTML=`
     <div class="clean-summary-row"><span>Nombre y apellido</span><div><b>${$("#checkoutName")?.value||""}</b></div></div>
     <div class="clean-summary-row"><span>Empresa</span><div><b>${$("#checkoutCompany")?.value||""}</b><small>CUIT ${$("#checkoutCuit")?.value||""}</small></div></div>
     <div class="clean-summary-row"><span>Contacto</span><div><b>${$("#checkoutEmail")?.value||""}</b><small>${$("#checkoutPhone")?.value||""}</small></div></div>
     <div class="clean-summary-row"><span>Dirección</span><div><b>${$("#checkoutAddress")?.value||""}</b><small>${$("#checkoutCity")?.value||""} · CP ${$("#checkoutPostal")?.value||""}</small></div></div>
     <div class="clean-summary-row"><span>Entrega</span><div><b>${$('input[name="delivery"]:checked')?.value==="retiro"?"Retiro":"Envío"}</b><small>${$('input[name="delivery"]:checked')?.value==="retiro"?"A coordinar":"Entrega a coordinar"}</small></div></div>
     <div class="clean-summary-row"><span>Fecha necesaria</span><div><b>${$("#checkoutDate")?.value||""}</b></div></div>
     ${comments?`<div class="clean-summary-row"><span>Comentarios</span><div><small>${comments}</small></div></div>`:""}
     ${files.length?`<div class="clean-summary-row"><span>Archivos</span><div><b>${files.length} adjunto${files.length===1?"":"s"}</b><small>${files.join(" · ")}</small></div></div>`:""}`;
 }
}
function renderCheckout(){
 const host=$("#checkoutItems"),tot=$("#checkoutTotals");if(!host||!tot)return;
 const c=normalizedCart();
 if(!c.length){host.innerHTML=`<div class="empty-review">No hay productos seleccionados. <a href="catalogo.html">Volver al catálogo</a></div>`;tot.innerHTML="";return}
 host.innerHTML=c.map(r=>{const p=productById(r.id),unit=p.publicPrice||0,sub=unit*r.qty;return `<div class="review-item"><img src="${p.image}" alt="${p.name}"><div class="review-item-copy"><b>${p.name}</b><small>${r.variant||""}</small><span>${r.qty} u. × ${computedNetPrice(p)?ars(unit):"A cotizar"}</span></div><strong>${computedNetPrice(p)?ars(sub):"A cotizar"}</strong></div>`}).join("");
 const total=c.reduce((a,r)=>a+computedNetPrice(productById(r.id))*r.qty,0);
 tot.innerHTML=`${taxBreakdownHtml(total,"Subtotal neto productos")}<div class="review-total-line muted"><span>Envío</span><span>A confirmar</span></div>`;
}
function setupConsult(){
 const consultRoot=$("#consultSelection");
 if(!consultRoot || consultRoot.dataset.wtsConsultInitialized==="1")return;
 consultRoot.dataset.wtsConsultInitialized="1";
 setupCuitInput("#consultCuit");
 setupRequiredDate("#consultDate");
 setupFileInput("#consultFiles","#consultFileList");
 const host=$("#consultSelection"),totalHost=$("#consultTotal");
 if(!host)return;

 const steps=[null,$("#advisorStep1"),$("#advisorStep2"),$("#advisorStep3")];
 const marks=[null,$("#advisorMark1"),$("#advisorMark2"),$("#advisorMark3")];
 const titles={
   1:["¿En qué podemos ayudarte?","Podés consultar por tu selección actual o contarnos una necesidad desde cero."],
   2:["Contanos un poco más","Con estos datos podemos entender mejor el contexto y orientar la respuesta."],
   3:["Revisá antes de enviar","Confirmá que la información refleje lo que necesitás."]
 };
 const c=normalizedCart();
 const total=c.reduce((a,r)=>a+computedNetPrice(productById(r.id))*r.qty,0);

 host.innerHTML=c.length
   ?c.map(r=>{
      const p=productById(r.id),unit=p.publicPrice||0;
      return `<div class="advisor-review-item"><img src="${p.image}" alt=""><div><b>${p.name}</b><small>${r.variant||""} · ${r.qty} u.</small><span>${p.publicPrice?`${ars(unit)} c/u · ${ars(unit*r.qty)}`:"A cotizar"}</span></div></div>`
    }).join("")
   :`<div class="advisor-empty"><b>No tenés productos seleccionados.</b><p>No hay problema: elegí “Busco algo que no está en el catálogo” y contanos qué necesitás.</p></div>`;

 if(totalHost){
   totalHost.innerHTML=c.length?`<span>Subtotal de referencia</span><b>${ars(total)}</b>`:"";
 }

 function goAdvisorStep(n){
   for(let i=1;i<=3;i++){
     if(steps[i])steps[i].hidden=i!==n;
     if(marks[i])marks[i].className=i<n?"done":i===n?"active":"";
   }
   if($("#advisorTitle"))$("#advisorTitle").textContent=titles[n][0];
   if($("#advisorIntro"))$("#advisorIntro").textContent=titles[n][1];
   clearFormError($("#consultError"));
   window.scrollTo({top:0,behavior:"smooth"});
 }

 $("#toAdvisorData")?.addEventListener("click",()=>{
   const type=$('input[name="consultType"]:checked')?.value||"mismos";
   // El asesoramiento admite consultas sin productos asociados.
   // La opción inicial no debe bloquear el avance cuando el carrito está vacío.
   if(!c.length && type==="mismos"){
     const idea=$('input[name="consultType"][value="idea"]');
     if(idea)idea.checked=true;
   }
   goAdvisorStep(2);
 });

 $("#backAdvisorNeed")?.addEventListener("click",()=>goAdvisorStep(1));
 $("#backAdvisorData")?.addEventListener("click",()=>goAdvisorStep(2));

 $("#toAdvisorConfirm")?.addEventListener("click",()=>{
   const err=$("#consultError");clearFormError(err);
   const name=$("#consultName")?.value.trim();
   const email=$("#consultEmail")?.value.trim();
   const phone=$("#consultPhone")?.value.trim();

   if(!name)return showFormError(err,"Completá tu nombre y apellido.");
   if(!$("#consultCompany")?.value.trim())return showFormError(err,"Completá la empresa.");
   if(!$("#consultCuit")?.value.trim())return showFormError(err,"Completá el CUIT.");
   if(!validCuit($("#consultCuit")?.value))return showFormError(err,"Ingresá un CUIT válido de 11 dígitos.");
   if(!email||!validEmail(email))return showFormError(err,"Ingresá un email válido.");
   if(!phone)return showFormError(err,"Ingresá un teléfono de contacto.");
   if(!$("#consultAddress")?.value.trim())return showFormError(err,"Completá la dirección.");
   if(!$("#consultCity")?.value.trim())return showFormError(err,"Completá la localidad.");
   if(!$("#consultPostal")?.value.trim())return showFormError(err,"Completá el código postal.");
   if(!$("#consultDate")?.value)return showFormError(err,"Indicá la fecha en que necesitás el pedido.");
   if(!validRequiredDate("#consultDate"))return showFormError(err,"La fecha necesaria no puede ser anterior a hoy.");

   const type=$('input[name="consultType"]:checked')?.value||"mismos";
   const typeLabels={
     mismos:"Consulta por productos seleccionados",
     alternativas:"Búsqueda de alternativas",
     idea:"Producto o idea fuera del catálogo"
   };

   const summary=$("#advisorCustomerSummary");
   if(summary){
     const afiles=fileNames("#consultFiles");
     const company=$("#consultCompany")?.value.trim();
     const contactBits=[email,phone].filter(Boolean).join(" · ");
     summary.innerHTML=`
       <div class="advisor-summary-row clean-summary-row"><span>Contacto</span><div><b>${name}</b><small>${contactBits}</small></div></div>
       <div class="advisor-summary-row clean-summary-row"><span>Empresa</span><div><b>${company}</b><small>CUIT ${$("#consultCuit")?.value.trim()||""}</small></div></div>
       <div class="advisor-summary-row clean-summary-row"><span>Dirección</span><div><b>${$("#consultAddress")?.value.trim()||""}</b><small>${$("#consultCity")?.value.trim()||""} · CP ${$("#consultPostal")?.value.trim()||""}</small></div></div>
       <div class="advisor-summary-row clean-summary-row"><span>Necesidad</span><div><b>${typeLabels[type]}</b></div></div>
       <div class="advisor-summary-row clean-summary-row"><span>Fecha necesaria</span><div><b>${$("#consultDate")?.value||""}</b></div></div>
       ${afiles.length?`<div class="advisor-summary-row clean-summary-row"><span>Archivos</span><div><b>${afiles.length} adjunto${afiles.length===1?"":"s"}</b><small>${afiles.join(" · ")}</small></div></div>`:""}`;
   }

   const need=$("#advisorNeedSummary");
   if(need){
     const qty=$("#consultQty")?.value.trim();
     const use=$("#consultUse")?.value;
     const budget=$("#consultBudget")?.value.trim();
     const comments=$("#consultComments")?.value.trim();
     const cards=[];
     if(qty)cards.push(`<div><span>Cantidad estimada</span><b>${qty}</b></div>`);
     if(use)cards.push(`<div><span>Tipo de acción</span><b>${use}</b></div>`);
     if(budget)cards.push(`<div><span>Presupuesto objetivo</span><b>${budget}</b></div>`);
     if(comments)cards.push(`<div class="wide"><span>Comentarios</span><p>${comments}</p></div>`);
     need.innerHTML=cards.join("");
     need.hidden=!cards.length;
   }

   const items=$("#advisorFinalItems");
   if(items)items.innerHTML=c.length
     ?c.map(r=>{
        const p=productById(r.id),unit=p.publicPrice||0;
        return `<div class="final-order-line"><img src="${p.image}" alt=""><div><b>${p.name}</b><small>${r.variant||""} · ${r.qty} u.</small></div><strong>${computedNetPrice(p)?ars(unit*r.qty):"A cotizar"}</strong></div>`
      }).join("")
     :`<p class="advisor-no-selection">Consulta sin productos asociados.</p>`;

   const totals=$("#advisorFinalTotal");
   if(totals)totals.innerHTML=c.length?taxBreakdownHtml(total,"Subtotal neto de referencia"):"";

   goAdvisorStep(3);
 });

 $("#sendConsult")?.addEventListener("click",async e=>{try{rejectUnsentFilesV117("#consultFiles");const receipt=await sendWebRequestV88({tipo:"ASESOR",cliente:customerV88("consult"),entregaCanal:$('input[name="consultType"]:checked')?.value||"",presupuestoObjetivo:$("#consultBudget")?.value.trim()||"",comentarios:$("#consultComments")?.value.trim()||"",items:requestItemsV88()},e.currentTarget);showRequestReceiptV116("#advisorSuccess",receipt);openFlowModal("#advisorSuccess");}catch(err){alert(err.message||"No se pudo confirmar el registro.");}});
}
function setupQuoteOnly(){
 setupCuitInput("#quoteCuit");
 setupRequiredDate("#quoteDate");
 setupFileInput("#quoteFiles","#quoteFileList");
 const preview=$("#quotePreview"),totalHost=$("#quoteTotal");if(!preview||!totalHost)return;
 const stages=[null,$("#quoteStep1"),$("#quoteStep2"),$("#quoteStep3")];
 const marks=[null,$("#quoteMark1"),$("#quoteMark2"),$("#quoteMark3")];
 const titles={
   1:["Revisá lo que querés cotizar","Podés solicitar valores sin confirmar una compra y conservar tu selección para seguir comparando."],
   2:["Contanos dónde enviamos la propuesta","Completá los datos necesarios y, si querés, agregá fecha o presupuesto objetivo."],
   3:["Confirmá la solicitud","Revisá la información antes de enviar el pedido de cotización."]
 };
 const c=normalizedCart();
 preview.innerHTML=c.length?c.map(r=>{const p=productById(r.id),unit=p.publicPrice||0;return `<div class="review-item"><img src="${p.image}"><div class="review-item-copy"><b>${p.name}</b><small>${r.variant||""}</small><span>${r.qty} u. × ${computedNetPrice(p)?ars(unit):"A cotizar"}</span></div><strong>${computedNetPrice(p)?ars(unit*r.qty):"A cotizar"}</strong></div>`}).join(""):`<p>No hay productos seleccionados todavía.</p>`;
 const total=c.reduce((a,r)=>a+computedNetPrice(productById(r.id))*r.qty,0);
 totalHost.innerHTML=c.length?`${taxBreakdownHtml(total,"Subtotal neto de referencia")}<small>El valor final puede variar según disponibilidad, entrega y condiciones de la propuesta.</small>`:"";

 function goQuoteStep(n){
   for(let i=1;i<=3;i++){if(stages[i])stages[i].hidden=i!==n;if(marks[i])marks[i].className=i<n?"done":i===n?"active":""}
   if($("#quoteTitle"))$("#quoteTitle").textContent=titles[n][0];
   if($("#quoteIntro"))$("#quoteIntro").textContent=titles[n][1];
   window.scrollTo({top:0,behavior:"smooth"});
 }
 $("#toQuoteData")?.addEventListener("click",()=>{
   if(!c.length)return;
   const minMsg=cartMinimumMessage();if(minMsg){alert(minMsg);return}
   goQuoteStep(2);
 });
 $("#backQuoteReview")?.addEventListener("click",()=>goQuoteStep(1));
 $("#backQuoteData")?.addEventListener("click",()=>goQuoteStep(2));

 $("#toQuoteConfirm")?.addEventListener("click",()=>{
   const err=$("#quoteError");clearFormError(err);
   if(!c.length)return showFormError(err,"Agregá al menos un producto al carrito.");
   const minMsg=cartMinimumMessage();if(minMsg)return showFormError(err,minMsg);
   const name=$("#quoteName")?.value.trim(),email=$("#quoteEmail")?.value.trim(),phone=$("#quotePhone")?.value.trim();
   if(!name)return showFormError(err,"Completá tu nombre y apellido.");
   if(!$("#quoteCompany")?.value.trim())return showFormError(err,"Completá la empresa u organización.");
   if(!$("#quoteCuit")?.value.trim())return showFormError(err,"Completá el CUIT.");
   if(!validCuit($("#quoteCuit")?.value))return showFormError(err,"Ingresá un CUIT válido de 11 dígitos.");
   if(!email||!validEmail(email))return showFormError(err,"Ingresá un email válido.");
   if(!phone)return showFormError(err,"Ingresá un teléfono de contacto.");
   if(!$("#quoteAddress")?.value.trim())return showFormError(err,"Completá la dirección.");
   if(!$("#quoteCity")?.value.trim())return showFormError(err,"Completá la localidad.");
   if(!$("#quotePostal")?.value.trim())return showFormError(err,"Completá el código postal.");
   if(!$("#quoteDate")?.value)return showFormError(err,"Indicá la fecha en que necesitás el pedido.");
   if(!validRequiredDate("#quoteDate"))return showFormError(err,"La fecha necesaria no puede ser anterior a hoy.");
   const channel=$('input[name="quoteChannel"]:checked')?.value||"email";
   const summary=$("#quoteCustomerSummary"),items=$("#quoteFinalItems"),totals=$("#quoteFinalTotal");
   if(summary){
     const qfiles=fileNames("#quoteFiles");
     const target=$("#quoteTarget")?.value.trim();
     const comments=$("#quoteComments")?.value.trim();
     summary.innerHTML=`
       <div class="clean-summary-row"><span>Nombre y apellido</span><div><b>${name}</b></div></div>
       <div class="clean-summary-row"><span>Empresa</span><div><b>${$("#quoteCompany")?.value.trim()||""}</b><small>CUIT ${$("#quoteCuit")?.value.trim()||""}</small></div></div>
       <div class="clean-summary-row"><span>Contacto</span><div><b>${email}</b><small>${phone}</small></div></div>
       <div class="clean-summary-row"><span>Dirección</span><div><b>${$("#quoteAddress")?.value.trim()||""}</b><small>${$("#quoteCity")?.value.trim()||""} · CP ${$("#quotePostal")?.value.trim()||""}</small></div></div>
       <div class="clean-summary-row"><span>Fecha necesaria</span><div><b>${$("#quoteDate")?.value||""}</b><small>Recepción: ${channel==="whatsapp"?"WhatsApp":"Email"}</small></div></div>
       ${target?`<div class="clean-summary-row"><span>Presupuesto objetivo</span><div><b>${target}</b></div></div>`:""}
       ${comments?`<div class="clean-summary-row"><span>Observaciones</span><div><small>${comments}</small></div></div>`:""}
       ${qfiles.length?`<div class="clean-summary-row"><span>Archivos</span><div><b>${qfiles.length} adjunto${qfiles.length===1?"":"s"}</b><small>${qfiles.join(" · ")}</small></div></div>`:""}`;
   }
   if(items)items.innerHTML=c.map(r=>{const p=productById(r.id),unit=p.publicPrice||0;return `<div class="final-order-line"><img src="${p.image}" alt=""><div><b>${p.name}</b><small>${r.variant||""} · ${r.qty} u.</small></div><strong>${computedNetPrice(p)?ars(unit*r.qty):"A cotizar"}</strong></div>`}).join("");
   if(totals)totals.innerHTML=`${taxBreakdownHtml(total,"Subtotal neto de referencia")}<small>Presupuesto sin compromiso</small>`;
   goQuoteStep(3);
 });
 $("#generateQuote")?.addEventListener("click",async e=>{try{rejectUnsentFilesV117("#quoteFiles");const receipt=await sendWebRequestV88({tipo:"PRESUPUESTO",cliente:customerV88("quote"),entregaCanal:$('input[name="quoteChannel"]:checked')?.value||"",presupuestoObjetivo:$("#quoteTarget")?.value.trim()||"",comentarios:$("#quoteComments")?.value.trim()||"",items:requestItemsV88()},e.currentTarget);showRequestReceiptV116("#quoteSuccess",receipt);openFlowModal("#quoteSuccess");}catch(err){alert(err.message||"No se pudo confirmar el registro.");}});
}

document.addEventListener("click",e=>{
  if(e.target.classList?.contains("flow-modal")){e.target.classList.remove("open");e.target.setAttribute("aria-hidden","true")}
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape")$$(".flow-modal.open").forEach(m=>{m.classList.remove("open");m.setAttribute("aria-hidden","true")});
});

window.selectPublicImage=function(btn){
  const main=document.getElementById("pdMainImage");
  if(main)main.src=btn.dataset.image||"";
  document.querySelectorAll(".wts-public-thumb").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");
};


/* V35: bootstrap independiente del carrusel.
   No depende de initPage ni del momento en que termina el fetch de productos. */
(function(){
  function bootFeaturedV35(){
    const rail=document.getElementById("featuredGrid");
    if(!rail || rail.dataset.v35Ready==="1") return;

    const cards=Array.from(rail.children).filter(el=>el.classList && el.classList.contains("product-card"));
    if(cards.length<2){
      window.setTimeout(bootFeaturedV35,250);
      return;
    }

    rail.dataset.v35Ready="1";
    rail.style.animation="none";
    rail.style.transform="none";

    const viewport=document.createElement("div");
    viewport.className="featured-viewport-v35";
    const track=document.createElement("div");
    track.className="featured-track-v35";

    cards.forEach(c=>track.appendChild(c));
    cards.forEach(c=>track.appendChild(c.cloneNode(true)));
    rail.replaceChildren(viewport);
    viewport.appendChild(track);

    let paused=false, x=0, last=performance.now(), loopWidth=0;

    function measure(){
      const originals=Array.from(track.children).slice(0,cards.length);
      const gap=parseFloat(getComputedStyle(track).columnGap)||14;
      loopWidth=originals.reduce((n,c)=>n+c.getBoundingClientRect().width,0)+gap*originals.length;
    }

    function animate(now){
      const dt=Math.min(50,now-last);
      last=now;
      if(!paused && loopWidth>0){
        x-=36*(dt/1000);
        if(-x>=loopWidth) x+=loopWidth;
        track.style.transform="translate3d("+x+"px,0,0)";
      }
      requestAnimationFrame(animate);
    }

    viewport.addEventListener("mouseenter",()=>paused=true);
    viewport.addEventListener("mouseleave",()=>{paused=false;last=performance.now();});
    viewport.addEventListener("touchstart",()=>paused=true,{passive:true});
    viewport.addEventListener("touchend",()=>{paused=false;last=performance.now();},{passive:true});

    requestAnimationFrame(()=>{
      measure();
      window.addEventListener("resize",measure,{passive:true});
      requestAnimationFrame(animate);
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",bootFeaturedV35,{once:true});
  }else{
    bootFeaturedV35();
  }
})();
