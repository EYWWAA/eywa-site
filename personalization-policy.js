/* Shared by the quote form, reservation and authoritative payment server. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.EywaPersonalizations=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var rates={'Habillage du bar':200,'Gobelets sur mesure':200,'Gobelets avec stickers':100,'Logo sur les boissons':150};
  var cupOptions=['Gobelets sur mesure','Gobelets avec stickers'];
  function isPrivate(type){
    var text=String(type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return /mariage|wedding|prive|private|anniversaire|birthday|bapteme|communion|famille|familial/.test(text);
  }
  function available(type,name){
    return Object.prototype.hasOwnProperty.call(rates,name)&&
      ((name!=='Gobelets avec stickers'&&name!=='Logo sur les boissons')||isPrivate(type));
  }
  function filter(type,names){return Array.isArray(names)?Array.from(new Set(names)).filter(function(name){return available(type,name);}):[];}
  function validate(type,names){
    if(!Array.isArray(names)||names.some(function(name){return !available(type,name);}))throw Error('Personnalisation indisponible pour ce type d’événement.');
    var selected=Array.from(new Set(names));
    if(cupOptions.every(function(name){return selected.includes(name);}))throw Error('Choisissez les gobelets imprimés ou les gobelets avec stickers.');
    return selected;
  }
  function toggle(type,names,name){
    var selected=filter(type,names);
    if(!available(type,name))return selected;
    if(selected.includes(name))return selected.filter(function(n){return n!==name;});
    if(cupOptions.includes(name))selected=selected.filter(function(n){return !cupOptions.includes(n);});
    return selected.concat(name);
  }
  return {rates:rates,cupOptions:cupOptions,isPrivate:isPrivate,available:available,filter:filter,validate:validate,toggle:toggle};
});
