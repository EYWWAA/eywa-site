/* Palette chaude retenue pour le site. */
(function(){
 var theme='warm';
 var brown=new URLSearchParams(location.search).get('marron');
 if(['rose','caramel','noisette','cannelle','cafe'].indexOf(brown)<0)brown=null;
 if(brown)document.documentElement.dataset.eywaBrown=brown;
 document.documentElement.dataset.eywaTheme=theme;
 try{sessionStorage.setItem('eywa-comparison-theme',theme)}catch(e){}
 function links(){
  document.querySelectorAll('a[href]').forEach(function(a){
   var raw=a.getAttribute('href');if(!raw||raw.charAt(0)==='#')return;
   try{var u=new URL(raw,location.href);if(u.origin!==location.origin||!(u.pathname.endsWith('.html')||u.pathname==='/'))return;
    u.searchParams.set('theme',theme);if(brown&&!u.searchParams.has('marron'))u.searchParams.set('marron',brown);a.setAttribute('href',u.pathname+u.search+u.hash);
   }catch(e){}
  });
 }
 // Les liens ajoutés plus tard (barre de contact, devis) gardent l'aperçu choisi.
 document.addEventListener('click',function(event){
  var a=event.target.closest&&event.target.closest('a[href]');if(!brown||!a)return;
  try{var u=new URL(a.href,location.href);if(u.origin===location.origin&&(u.pathname.endsWith('.html')||u.pathname==='/')&&!u.searchParams.has('marron')){u.searchParams.set('marron',brown);a.href=u.pathname+u.search+u.hash}}catch(e){}
 },true);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',links);else links();
})();


