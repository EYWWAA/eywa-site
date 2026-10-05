/* EYWA — déplacement. Distance et durée doivent provenir d'un itinéraire
   routier aller-retour vérifié, jamais d'une distance à vol d'oiseau. */
(function(root) {
  'use strict';
  // Forfait kilométrique incluant les péages : ne pas les ajouter séparément.
  var RATE_PER_KM = 0.25;
  var RATE_PER_HOUR = 14;
  function calculate(roundTripKm, roundTripMinutes) {
    if (typeof roundTripKm !== 'number' || !Number.isFinite(roundTripKm) || roundTripKm < 0 ||
        typeof roundTripMinutes !== 'number' || !Number.isFinite(roundTripMinutes) || roundTripMinutes < 0) {
      throw new TypeError('Un trajet aller-retour valide est nécessaire.');
    }
    var distanceCents = Math.round(roundTripKm * RATE_PER_KM * 100);
    var drivingCents = Math.round(roundTripMinutes / 60 * RATE_PER_HOUR * 100);
    return {roundTripKm: roundTripKm, roundTripMinutes: roundTripMinutes,
      distanceCost: distanceCents / 100, drivingCost: drivingCents / 100,
      total: (distanceCents + drivingCents) / 100};
  }
  var pricing = Object.freeze({perKm: RATE_PER_KM, perHour: RATE_PER_HOUR, calculate: calculate});
  if (typeof module !== 'undefined' && module.exports) module.exports = pricing;
  else root.EywaTravelPricing = pricing;
})(typeof window !== 'undefined' ? window : globalThis);
