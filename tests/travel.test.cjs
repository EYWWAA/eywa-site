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
 const fn=html.match(/function calcPrice\(\) \{[\s\S]*?\n  \}/)[0];
 const ctx={A:{guests:50,hrs:1.5,days:3},window:{eywaTravel:{total:92.57}},persoTotal:()=>100};
 vm.createContext(ctx);vm.runInContext(fn+';result=calcPrice()',ctx);
 assert.equal(ctx.result,2342.57);
});
