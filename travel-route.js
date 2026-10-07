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
    return {roundTripKm:outward.km+inward.km,roundTripMinutes:outward.minutes+inward.minutes,outwardMinutes:outward.minutes,returnMinutes:inward.minutes,lodgingRequired:outward.minutes>240};
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
    return {roundTripKm:outward.km+inward.km,roundTripMinutes:outward.minutes+inward.minutes,outwardMinutes:outward.minutes,returnMinutes:inward.minutes,lodgingRequired:outward.minutes>240};
  }
  var api={roundTrip:roundTrip,internationalRoundTrip:internationalRoundTrip};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.EywaTravelRoute=api;
})(typeof window !== 'undefined' ? window : globalThis);
