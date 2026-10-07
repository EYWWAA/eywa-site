/* Recherche géocodée internationale, avec repli sur IGN pour les lieux français. */
(function(root){
 'use strict';
 function point(feature){var p=feature.geometry&&feature.geometry.coordinates;return feature.geometry&&feature.geometry.type==='Point'&&Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;}
 function normalize(feature){
  var p=feature.properties;
  if(!point(feature)||!p||['country','state','county','other'].includes(p.type))return null;
  var street=[p.housenumber,p.street].filter(Boolean).join(' ');
  var locality=[p.postcode,p.city||p.town||p.village].filter(Boolean).join(' ');
  var parts=[p.name,street,locality,p.country].filter(Boolean);
  parts=parts.filter(function(v,i){return parts.indexOf(v)===i;});
  if(!parts.length)return null;
  return {geometry:feature.geometry,properties:{label:parts.join(', '),type:p.housenumber?'housenumber':'place',countrycode:(p.countrycode||'').toUpperCase()}};
 }
 async function search(query,options){
  options=options||{};var fetcher=options.fetch||root.fetch.bind(root);
  var params=new URLSearchParams({q:query,lang:'fr',limit:'8',lat:'49.778496',lon:'4.740663'});
  try{
   var response=await fetcher('https://photon.komoot.io/api/?'+params,{signal:options.signal});
   if(!response.ok)throw new Error('Recherche indisponible.');
   var data=await response.json();var result=(data.features||[]).map(normalize).filter(Boolean);
   if(result.length)return result.slice(0,5);
  }catch(e){if(options.signal&&options.signal.aborted)throw e;}
  var fallback=await fetcher('https://data.geopf.fr/geocodage/search?limit=5&q='+encodeURIComponent(query),{signal:options.signal});
  if(!fallback.ok)throw new Error('Recherche indisponible.');
  var french=await fallback.json();
  return (french.features||[]).filter(function(f){return point(f)&&f.properties&&f.properties.label;}).map(function(f){return {geometry:f.geometry,properties:Object.assign({},f.properties,{countrycode:'FR'})};});
 }
 var api={search:search};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EywaTravelPlaces=api;
})(typeof window!=='undefined'?window:globalThis);
