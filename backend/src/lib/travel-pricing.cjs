/* Prix du trajet aller-retour. Les 20 km à l'aller sont gratuits ; au-delà,
   le trajet complet est facturé, sans retrancher les 20 premiers kilomètres. */
(function(root){
  'use strict';
  var RATE_PER_KM=0.25, RATE_PER_HOUR=14, FREE_OUTWARD_KM=20;
  function calculate(roundTripKm,roundTripMinutes,outwardKm){
    if(typeof roundTripKm!=='number'||!Number.isFinite(roundTripKm)||roundTripKm<0||
       typeof roundTripMinutes!=='number'||!Number.isFinite(roundTripMinutes)||roundTripMinutes<0){
      throw new TypeError('Un trajet aller-retour valide est nécessaire.');
    }
    // Les anciens liens de devis ne contiennent que la distance aller-retour.
    if(outwardKm===undefined||outwardKm===null)outwardKm=roundTripKm/2;
    if(typeof outwardKm!=='number'||!Number.isFinite(outwardKm)||outwardKm<0||outwardKm>roundTripKm){
      throw new TypeError('Une distance aller valide est nécessaire.');
    }
    var free=outwardKm<=FREE_OUTWARD_KM;
    var distanceCents=free?0:Math.round(roundTripKm*RATE_PER_KM*100);
    var drivingCents=free?0:Math.round(roundTripMinutes/60*RATE_PER_HOUR*100);
    return {roundTripKm:roundTripKm,roundTripMinutes:roundTripMinutes,outwardKm:outwardKm,
      free:free,distanceCost:distanceCents/100,drivingCost:drivingCents/100,total:(distanceCents+drivingCents)/100};
  }
  var pricing=Object.freeze({perKm:RATE_PER_KM,perHour:RATE_PER_HOUR,freeOutwardKm:FREE_OUTWARD_KM,calculate:calculate});
  if(typeof module!=='undefined'&&module.exports)module.exports=pricing;else root.EywaTravelPricing=pricing;
})(typeof window!=='undefined'?window:globalThis);
