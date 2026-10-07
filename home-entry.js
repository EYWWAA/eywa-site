/* Fermer la FAQ à chaque arrivée, y compris après un retour avec le cache du navigateur. */
(function(){
  var black=new URLSearchParams(location.search).get("noir");
  if(["muse","profond","chaud"].includes(black))document.body.setAttribute("data-home-black",black);
  function closeFaq(){document.querySelectorAll('#faq details').forEach(function(item){item.open=false;});}
  closeFaq();
  window.addEventListener('pageshow',function(){closeFaq();requestAnimationFrame(closeFaq);});
})();

