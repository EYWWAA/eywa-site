/* Itinéraires routiers IGN : aller et retour calculés séparément. */
(function(root) {
  'use strict';
  function coordinates(point) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) ||
        Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new TypeError('Coordonnées invalides.');
    return point.join(',');
  }
  async function leg(start, end, fetcher) {
    var params = new URLSearchParams({resource:'bdtopo-osrm',start:coordinates(start),end:coordinates(end),
      profile:'car',optimization:'fastest',distanceUnit:'kilometer',timeUnit:'minute',getGeometry:'false'});
    var controller = new AbortController();
    var timeout = setTimeout(function(){controller.abort();},15000);
    try {
      var response = await fetcher('https://data.geopf.fr/navigation/itineraire?' + params, {signal:controller.signal});
      if (!response.ok) throw new Error('Le calcul routier est temporairement indisponible.');
      var data = await response.json();
      if (!Number.isFinite(data.distance) || !Number.isFinite(data.duration) || data.distance < 0 || data.duration < 0 ||
          data.distanceUnit !== 'kilometer' || data.timeUnit !== 'minute') throw new Error('Itinéraire non calculable pour cette adresse.');
      return {km:data.distance,minutes:data.duration};
    } finally { clearTimeout(timeout); }
  }
  async function roundTrip(origin, destination, fetcher) {
    fetcher = fetcher || root.fetch.bind(root);
    var outward = await leg(origin,destination,fetcher);
    var inward = await leg(destination,origin,fetcher);
    return {roundTripKm:outward.km+inward.km,roundTripMinutes:outward.minutes+inward.minutes,outwardKm:outward.km,returnKm:inward.km,outwardMinutes:outward.minutes,returnMinutes:inward.minutes,lodgingRequired:outward.minutes>240};
  }
  async function osmLeg(start,end,fetcher){
    var controller=new AbortController();
    var timeout=setTimeout(function(){controller.abort();},15000);
    try{
      var response=await fetcher('https://router.project-osrm.org/route/v1/driving/'+coordinates(start)+';'+coordinates(end)+'?overview=false&steps=false',{signal:controller.signal});
      if(!response.ok)throw new Error('Trajet indisponible.');
      var data=await response.json(),route=data.routes&&data.routes[0];
      if(data.code!=='Ok'||!route||!Number.isFinite(route.distance)||!Number.isFinite(route.duration)||route.distance<0||route.duration<0||!data.waypoints||data.waypoints.length!==2||data.waypoints.some(function(w){return !Number.isFinite(w.distance)||w.distance>2000;}))throw new Error('Ce lieu ne correspond pas à un accès routier vérifiable.');
      return {km:route.distance/1000,minutes:route.duration/60};
    }finally{clearTimeout(timeout);}
  }
  async function internationalRoundTrip(origin,destination,fetcher){
    fetcher=fetcher||root.fetch.bind(root);
    var outward=await osmLeg(origin,destination,fetcher);
    var inward=await osmLeg(destination,origin,fetcher);
    return {roundTripKm:outward.km+inward.km,roundTripMinutes:outward.minutes+inward.minutes,outwardKm:outward.km,returnKm:inward.km,outwardMinutes:outward.minutes,returnMinutes:inward.minutes,lodgingRequired:outward.minutes>240};
  }
  // The free service zone is geographic. A verified point inside it needs no
  // external directions request: a routing outage must not block a local quote.
  function localDistanceKm(origin,destination){
    coordinates(origin);coordinates(destination);
    var rad=Math.PI/180,lat1=origin[1]*rad,lat2=destination[1]*rad;
    var a=Math.sin((lat2-lat1)/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin((destination[0]-origin[0])*rad/2)**2;
    return 6371.0088*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,a))));
  }
  async function eventTrip(origin,destination,country,fetcher){
    var distance=localDistanceKm(origin,destination);
    if(distance<=20+1e-8)return {localFree:true,localDistanceKm:distance,roundTripKm:0,roundTripMinutes:0,outwardKm:0,returnKm:0,outwardMinutes:0,returnMinutes:0,lodgingRequired:false};
    return (String(country).toUpperCase()==='FR'?roundTrip:internationalRoundTrip)(origin,destination,fetcher);
  }
  var api={roundTrip:roundTrip,internationalRoundTrip:internationalRoundTrip,eventTrip:eventTrip};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.EywaTravelRoute=api;
})(typeof window !== 'undefined' ? window : globalThis);
