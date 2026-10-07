/* Rayon géographique EYWA. Les frais restent calculés sur le trajet routier. */
(function(root){
  'use strict';
  var origin=Object.freeze([4.740663,49.778496]);
  var radiusKm=300;
  function distanceKm(point){
    if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)throw new TypeError('Coordonnées invalides.');
    var rad=Math.PI/180,lat1=origin[1]*rad,lat2=point[1]*rad;
    var a=Math.sin((lat2-lat1)/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin((point[0]-origin[0])*rad/2)**2;
    return 6371.0088*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,a))));
  }
  var api={origin:origin,radiusKm:radiusKm,distanceKm:distanceKm,contains:function(point){return distanceKm(point)<=radiusKm+1e-8;}};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.EywaServiceArea=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
