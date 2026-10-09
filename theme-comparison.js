/* La palette suit la navigation, sans changer le contenu des pages. */
(function(){
 var choice=new URLSearchParams(location.search).get('theme'),theme=choice;
 try{if(!['actuel','creme'].includes(theme))theme=sessionStorage.getItem('eywa-comparison-theme');else sessionStorage.setItem('eywa-comparison-theme',theme)}catch(e){}
 if(!['actuel','creme'].includes(theme))theme='actuel';
 document.documentElement.dataset.eywaTheme=theme;
 function links(){
  document.querySelectorAll('a[href]').forEach(function(a){
   var raw=a.getAttribute('href');if(!raw||raw.charAt(0)==='#')return;
   try{var u=new URL(raw,location.href);if(u.origin!==location.origin||!(u.pathname.endsWith('.html')||u.pathname==='/'))return;
    u.searchParams.set('theme',theme);a.setAttribute('href',u.pathname+u.search+u.hash);
   }catch(e){}
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',links);else links();
})();

