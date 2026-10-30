/* Offre de lancement terminée. Tarifs habituels sur tout le parcours. */
(function(root){
 'use strict';
 var state=Object.freeze({supported:true,ready:true,active:false,remaining:0,available:0});
 var money=function(n){return Number(n).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});};
 function clean(){document.documentElement.classList.remove('launch-offer-active');document.querySelectorAll('[data-launch-banner],.launch-banner').forEach(function(el){el.remove();});}
 root.EywaLaunchOffer={state:state,amount:function(n){return Number(n);},priceHTML:money,money:money,refresh:function(){clean();return Promise.resolve();},onChange:function(fn){fn(state);},endpoint:'https://eywa-booking.eywa-booking-cloudflare.workers.dev/launch-offer'};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clean);else clean();
})(window);
