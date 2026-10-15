/* Disponibilité de l'offre partagée : le serveur est la source de vérité. */
(function(root){
  'use strict';
  var endpoint='https://tubular-granita-827569.netlify.app/.netlify/functions/launch-offer';
  var state={supported:false,ready:false,active:false,remaining:0,available:0},listeners=[],pending,paymentCopy=[];
  var money=function(n){return Number(n).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});};
  function amount(normal){return state.active?Math.round(Number(normal)*100/5)/100:Number(normal);}
  function priceHTML(normal){
    var current=amount(normal);
    return state.active&&Number(normal)>0?'<span class="launch-price"><del aria-label="Tarif habituel : '+money(normal)+'">'+money(normal)+'</del><strong aria-label="Prix remisé : '+money(current)+'">'+money(current)+'</strong><span class="launch-badge">−80 %</span></span>':money(normal);
  }
  function update(value){
    var previous=JSON.stringify(state);
    state.ready=true;state.supported=value.supported===true;state.active=value.active===true&&Number(value.available)>0;
    state.remaining=Math.max(0,Math.min(2,Number(value.remaining)||0));state.available=Math.max(0,Math.min(2,Number(value.available)||0));
    document.documentElement.classList.toggle('launch-offer-active',state.active);
    document.querySelectorAll('[data-launch-banner]').forEach(function(el){el.hidden=!state.active;});
    paymentCopy.forEach(function(item){item.el.textContent=state.active?item.offer:item.normal;});
    if(previous!==JSON.stringify(state))listeners.forEach(function(fn){fn(state);});
  }
  function refresh(){
    if(pending)return pending;
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},5000);
    pending=fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(function(r){if(!r.ok)throw Error('Indisponible');return r.json();}).then(update).catch(function(){update({active:false,remaining:0,available:0});}).finally(function(){clearTimeout(timer);pending=null;});
    return pending;
  }
  function banner(){
    document.querySelectorAll('.how-steps p').forEach(function(el){var normal=el.textContent,offer=normal.replace('avant le versement de l’acompte','avant le règlement de votre réservation').replace('vous confirmez et réglez l’acompte','vous confirmez et réglez intégralement votre devis remisé pendant l’offre de lancement');if(offer!==normal)paymentCopy.push({el:el,normal:normal,offer:offer});});
    var main=document.querySelector('main'),hero=document.querySelector('#accueil');if(!main&&!hero)return;
    var el=document.createElement('aside');el.className='launch-banner';el.dataset.launchBanner='';el.hidden=true;
    el.innerHTML='<strong>Offre de lancement : −80 %</strong><span>Sur tout votre devis, personnalisations et déplacement compris. Pour les deux premières réservations réglées intégralement.</span>';
    if(hero)hero.after(el);else main.prepend(el);
  }
  root.EywaLaunchOffer={state:state,amount:amount,priceHTML:priceHTML,money:money,refresh:refresh,onChange:function(fn){listeners.push(fn);if(state.ready)fn(state);},endpoint:endpoint};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){banner();refresh();});else{banner();refresh();}
  window.addEventListener('pageshow',refresh);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh();});
  setInterval(function(){if(!document.hidden)refresh();},30000);
})(window);
