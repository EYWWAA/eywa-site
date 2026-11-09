'use strict';
const travelPricing=require('./travel-pricing.cjs'),route=require('./travel-route.cjs');
const policy=require('./booking-policy.cjs');
const origin=[4.740663,49.778496],optionRates={'Habillage du bar':200,'Gobelets sur mesure':200,'Logo sur les boissons':150};
function numeric(value,min,max,label){const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' invalide');return n;}
async function quote(q,fetcher,now=new Date()){
  const guests=numeric(q.g,1,2000,'Nombre d’invités'),hours=numeric(q.h,0.5,24,'Durée'),days=numeric(q.dy||1,1,365,'Nombre de jours');
  if(!Number.isInteger(guests)||!Number.isInteger(days))throw Error('Quantité invalide');
  const date=String(q.d||'');const dates=policy.occupiedDays({...q,d:date,dy:days},now);
  const lat=numeric(q.lat,-90,90,'Latitude'),lng=numeric(q.lng,-180,180,'Longitude');
  const rad=n=>n*Math.PI/180,a=Math.sin(rad(lat-origin[1])/2)**2+Math.cos(rad(origin[1]))*Math.cos(rad(lat))*Math.sin(rad(lng-origin[0])/2)**2;
  if(6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))>300)throw Error('Un devis spécifique est nécessaire au-delà de 300 km');
  const trip=await route.eventTrip(origin,[lng,lat],q.country,fetcher);
  if(trip.lodgingRequired)throw Error('L’hébergement doit être validé avec EYWA avant le paiement');
  const travel=travelPricing.calculate(trip.roundTripKm,trip.roundTripMinutes,trip.outwardKm);
  let selected=[];try{selected=typeof q.options==='string'?JSON.parse(q.options):q.options||[];}catch(_){throw Error('Options invalides');}
  if(!Array.isArray(selected)||selected.some(name=>!Object.hasOwn(optionRates,name)))throw Error('Options invalides');
  selected=[...new Set(selected)];
  const staff=Math.max(1,Math.ceil(guests/(hours*50)));
  const dailyCents=25000+Math.max(0,guests-50)*190+Math.round(Math.max(0,hours-1.5)*5500)+(staff-1)*15000+selected.reduce((n,name)=>n+optionRates[name]*100,0);
  const daysUntil=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(policy.today(now)+'T12:00:00Z'))/86400000);
  const rushCupsCents=selected.includes('Gobelets sur mesure')&&daysUntil>=0&&daysUntil<14?5000:0;
  const normalCents=dailyCents*days+rushCupsCents+Math.round(travel.total*100);
  const personalizationCents=Math.round(selected.reduce((n,name)=>n+optionRates[name],0)*days*100)+rushCupsCents;
  if(!Number.isSafeInteger(normalCents)||normalCents<100||normalCents>1000000)throw Error('Contactez EYWA pour ce devis');
  return {normalCents,discountedCents:Math.round((normalCents-personalizationCents)/5)+personalizationCents,personalizationCents,rushCupsCents,dates,trip,travel};
}
module.exports={quote};
