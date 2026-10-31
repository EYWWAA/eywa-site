const assert=require('node:assert/strict');
const test=require('node:test');
const pricing=require('../travel-pricing.js');
const route=require('../travel-route.js');
const fs=require('node:fs'),vm=require('node:vm');
test('round-trip price includes km and driving, rounded to cents',()=>{
 assert.equal(pricing.calculate(200,180).total,92);
 assert.equal(pricing.calculate(0,0).total,0);
 assert.throws(()=>pricing.calculate(-1,0));assert.throws(()=>pricing.calculate(1,NaN));
});
test('route uses both directions and lodging strictly above four hours outbound',async()=>{
 for(const outbound of [239,240,241]){
  const calls=[];const trip=await route.roundTrip([4.74,49.77],[4.03,49.25],async url=>{
   calls.push(new URL(url));return {ok:true,json:async()=>({distance:calls.length===1?300:310,duration:calls.length===1?outbound:260,distanceUnit:'kilometer',timeUnit:'minute'})};
  });
  assert.equal(trip.roundTripKm,610);assert.equal(trip.roundTripMinutes,outbound+260);
  assert.equal(trip.lodgingRequired,outbound>240);
  assert.equal(calls[0].searchParams.get('start'),calls[1].searchParams.get('end'));
 }
});
test('API failure or wrong units never become free travel',async()=>{
 await assert.rejects(route.roundTrip([4,49],[3,48],async()=>({ok:false})));
 await assert.rejects(route.roundTrip([4,49],[3,48],async()=>({ok:true,json:async()=>({distance:10,duration:20,distanceUnit:'meter',timeUnit:'second'})})));
});
test('quote counts travel once across several days, retaining cents',()=>{
 const html=fs.readFileSync('devis-instantane.html','utf8');
 const fn=html.match(/function calcNormalPrice\(\) \{[\s\S]*?\n  \}/)[0];
 const ctx={A:{guests:50,hrs:1.5,days:3},window:{eywaTravel:{total:92.57}},persoTotal:()=>100};
 vm.createContext(ctx);vm.runInContext(fn+';result=calcNormalPrice()',ctx);
 assert.equal(ctx.result,1442.57);
});

test('20 km gratuits ; au-delà, trajet complet, y compris les 20 premiers km',()=>{assert.equal(pricing.calculate(40,60,20).total,0);assert.equal(pricing.calculate(50,60,25).total,26.5);assert.equal(pricing.calculate(45,60,25).total,25.25);assert.equal(pricing.calculate(41,60,20.01).total,24.25);assert.throws(()=>pricing.calculate(50,60,NaN));});

test('Place de la Gare à Charleville : lieu conservé, gratuit sans aucune requête routière',async()=>{
 let calls=0;const destination=[4.72503,49.76786];
 const trip=await route.eventTrip([4.740663,49.778496],destination,'FR',async()=>{calls++;throw Error('Routing unavailable')});
 assert.equal(calls,0);assert.equal(trip.localFree,true);
 assert(trip.localDistanceKm>1&&trip.localDistanceKm<2);
 assert.equal(pricing.calculate(trip.roundTripKm,trip.roundTripMinutes,trip.outwardKm).total,0);
 assert.deepEqual(destination,[4.72503,49.76786]);
});
test('rayon gratuit de 20 km inclus ; juste au-delà, calcul complet et erreur sans gratuité de repli',async()=>{
 const origin=[4.740663,49.778496],point=km=>[origin[0],origin[1]+km/6371.0088*180/Math.PI];
 let calls=0;const fetcher=async()=>{calls++;return {ok:true,json:async()=>({distance:25,duration:30,distanceUnit:'kilometer',timeUnit:'minute'})}};
 assert.equal((await route.eventTrip(origin,point(20),'FR',fetcher)).localFree,true);assert.equal(calls,0);
 const outside=await route.eventTrip(origin,point(20.001),'FR',fetcher);assert.equal(calls,2);
 assert.equal(pricing.calculate(outside.roundTripKm,outside.roundTripMinutes,outside.outwardKm).total,26.5);
 await assert.rejects(route.eventTrip(origin,point(25),'FR',async()=>{throw Error('Routing unavailable')}));
 await assert.rejects(route.eventTrip(origin,[NaN,49.77],'FR',fetcher));
});
