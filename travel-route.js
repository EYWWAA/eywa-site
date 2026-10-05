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
  var api={roundTrip:roundTrip};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.EywaTravelRoute=api;
})(typeof window !== 'undefined' ? window : globalThis);
