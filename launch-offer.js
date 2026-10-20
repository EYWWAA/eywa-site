/* Disponibilité de l'offre partagée : le serveur est la source de vérité. */
(function(root){
  'use strict';
  var endpoint='https://eywa-booking.eywa-booking-cloudflare.workers.dev/launch-offer';
  var state={supported:false,ready:false,active:false,remaining:0,available:0},listeners=[],pending,pendingDisplay=false,paymentCopy=[];
  var cacheKey='eywa-launch-display-cloudflare-v1',cacheTTL=5*60*1000,errorTTL=60*1000,memoryCache;
  var money=function(n){return Number(n).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});};
  function amount(normal){return state.active?Math.round(Number(normal)*100/5)/100:Number(normal);}
  function priceHTML(normal){
    var current=amount(normal);
    return state.active&&Number(normal)>0?'<span class="launch-price"><del aria-label="Tarif habituel : '+money(normal)+'">'+money(normal)+'</del><strong aria-label="Prix remisé : '+money(current)+'">'+money(current)+'</strong><span class="launch-badge">−80 %</span></span>':money(normal);
  }
  function update(value){
    var previous=JSON.stringify(state);
    state.ready=true;state.supported=value.supported===true;state.active=value.active===true&&Number(value.available)>0;
    state.remaining=Math.max(0,Math.min(1,Number(value.remaining)||0));state.available=Math.max(0,Math.min(1,Number(value.available)||0));
    document.documentElement.classList.toggle('launch-offer-active',state.active);
    document.querySelectorAll('[data-launch-banner]').forEach(function(el){el.hidden=!state.active;});
    paymentCopy.forEach(function(item){item.el.textContent=state.active?item.offer:item.normal;});
    if(previous!==JSON.stringify(state))listeners.forEach(function(fn){fn(state);});
  }
  // Display cache only. A payment refresh always bypasses it; checkout also
  // claims the single reservation atomically on the server.
  function readCache(){
    var saved=memoryCache;
    try{var stored=JSON.parse(root.sessionStorage.getItem(cacheKey));if(stored&&(!saved||stored.savedAt>saved.savedAt))saved=stored;}catch(_){}
    var age=saved?Date.now()-Number(saved.savedAt):Infinity;
    return saved&&age>=0&&age<(saved.failed?errorTTL:cacheTTL)?saved:null;
  }
  function saveCache(value,failed){
    memoryCache={savedAt:Date.now(),failed:failed,value:value};
    try{root.sessionStorage.setItem(cacheKey,JSON.stringify(memoryCache));}catch(_){}
  }
  function refresh(options){
    var cachedDisplay=options&&options.cached===true;
    if(pending)return cachedDisplay||!pendingDisplay?pending:pending.then(function(){return refresh();});
    var saved=cachedDisplay&&readCache();
    if(saved){update(saved.value);return Promise.resolve();}
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},5000);
    // A distinct uncacheable URL prevents a shared display cache from being
    // used when confirming the amount immediately before payment.
    var url=cachedDisplay?endpoint:endpoint+'?fresh=1';
    pendingDisplay=cachedDisplay;
    pending=fetch(url,{cache:cachedDisplay?'default':'no-store',signal:controller.signal}).then(function(r){if(!r.ok)throw Error('Indisponible');return r.json();}).then(function(value){saveCache(value,false);update(value);}).catch(function(){var unavailable={active:false,remaining:0,available:0};saveCache(unavailable,true);update(unavailable);}).finally(function(){clearTimeout(timer);pending=null;});
    return pending;
  }
  function refreshDisplay(){return refresh({cached:true});}
  function banner(){
    document.querySelectorAll('.how-steps p').forEach(function(el){var normal=el.textContent,offer=normal.replace('avant le versement de l’acompte','avant le règlement de votre réservation').replace('vous confirmez et réglez l’acompte','vous confirmez et réglez intégralement votre devis remisé pendant l’offre de lancement');if(offer!==normal)paymentCopy.push({el:el,normal:normal,offer:offer});});
    var main=document.querySelector('main'),hero=document.querySelector('#accueil');if(!main&&!hero)return;
    var el=document.createElement('aside');el.className='launch-banner';el.dataset.launchBanner='';el.hidden=true;
    el.innerHTML='<strong>Offre de lancement : −80 %</strong><span>Sur tout votre devis, personnalisations et déplacement compris. Offre valable pour la première réservation réglée intégralement.</span>';
    if(hero)hero.after(el);else main.prepend(el);
  }
  root.EywaLaunchOffer={state:state,amount:amount,priceHTML:priceHTML,money:money,refresh:refresh,onChange:function(fn){listeners.push(fn);if(state.ready)fn(state);},endpoint:endpoint};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){banner();refreshDisplay();});else{banner();refreshDisplay();}
  window.addEventListener('pageshow',refreshDisplay);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)refreshDisplay();});
})(window);
