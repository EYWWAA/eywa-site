/* Fermer la FAQ à chaque arrivée, y compris après un retour avec le cache du navigateur. */
(function(){
  function closeFaq(){document.querySelectorAll('#faq details').forEach(function(item){item.open=false;});}
  closeFaq();
  window.addEventListener('pageshow',function(){closeFaq();requestAnimationFrame(closeFaq);});
})();
