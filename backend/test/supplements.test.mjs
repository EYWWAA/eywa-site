import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import pricing from '../src/lib/pricing.cjs';
import {paymentPlan} from '../src/lib/payment-plan.mjs';

const basic={g:50,h:1.5,dy:1,d:'2027-11-15',ti:'14:00',country:'FR',lat:49.778496,lng:4.740663,options:[]};
const cases=[
 [{},30000],
 [{g:51},30231],
 [{h:2},33462],
 [{h:2.5},36923],
 [{h:3},40385],
 [{g:60,h:2.5},39233],
 [{g:76},51006],
 [{g:75,h:3,dy:2,options:['Habillage du bar']},132320],
 [{g:100,h:3,options:['Habillage du bar']},71935],
 [{g:200,h:2},83112],
];
test('New service rates: cents, half-hour rounding, extra barista and daily personalization',async()=>{
 for(const [changes,expected] of cases){const result=await pricing.quote({...basic,...changes});assert.equal(result.normalCents,expected,JSON.stringify(changes));}
 const calculated=await pricing.quote({...basic,g:75,h:3,dy:2,options:['Habillage du bar']});
 assert.equal(calculated.personalizationCents,40000);assert.equal(calculated.discountedCents,58464);
 assert.equal(paymentPlan(calculated,{offer:false},{}).payableCents,66160);
 assert.equal(paymentPlan(calculated,{offer:true},{}).payableCents,58464);
 assert.equal(paymentPlan(calculated,{code:'fixture'},{EYWA_SPECIAL_PRICE_CODE:'fixture'}).payableCents,100);
});
test('Instant quote browser calculation matches authoritative server for each tariff scenario',async()=>{
 const html=await fs.readFile(new URL('../../devis-instantane.html',import.meta.url),'utf8');
 const functionSource=html.match(/function calcNormalPrice\(\) \{[\s\S]*?\n  \}/)[0];
 for(const [changes,expected] of cases){const q={...basic,...changes};const context={A:{guests:q.g,hrs:q.h,days:q.dy},window:{eywaTravel:{total:0}},supplementUrgence:()=>0,persoTotal:()=>q.options.includes('Habillage du bar')?200:0};vm.createContext(context);const actual=vm.runInContext(functionSource+';calcNormalPrice()',context);assert.equal(Math.round(actual*100),expected);}
});
test('Detailed quote service formula stays aligned with the server and preserves cents',async()=>{
 const script=await fs.readFile(new URL('../../quote-details.js',import.meta.url),'utf8');
 const formula=script.match(/const service = ([^;]+);/)[1];
 for(const [changes,expected] of cases){const q={...basic,...changes};const context={guests:q.g,hours:q.h,days:q.dy,staff:Math.max(1,Math.ceil(q.g/(q.h*50)))};vm.createContext(context);const actual=vm.runInContext(formula,context);const options=q.options.includes('Habillage du bar')?20000*q.dy:0;assert.equal(Math.round(actual*100)+options,expected);}
 assert(!script.includes('69,23 € par heure supplémentaire.'));assert(!script.includes('à 2,31 € par invité'));
});
