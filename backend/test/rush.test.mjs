import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import pricing from '../src/lib/pricing.cjs';
import policy from '../src/lib/booking-policy.cjs';
import personalizations from '../../personalization-policy.js';
import {paymentPlan} from '../src/lib/payment-plan.mjs';
import {createCheckout} from '../src/checkout.mjs';
import {database,quote,bookingDetails} from './booking.test.mjs';
import {createBookings} from '../src/lib/bookings.mjs';
import {createSlots} from '../src/lib/slots.mjs';

const now=new Date('2026-11-07T11:00:00Z');
const cases=[
 [5,[],1,30000,0,0],
 [5,['Gobelets sur mesure'],1,55000,25000,5000],
 [13,['Gobelets sur mesure'],1,55000,25000,5000],
 [14,['Gobelets sur mesure'],1,50000,20000,0],
 [60,['Gobelets sur mesure'],1,50000,20000,0],
 [5,['Habillage du bar'],1,50000,20000,0],
 [5,['Logo sur les boissons'],1,45000,15000,0],
 [5,['Habillage du bar','Gobelets sur mesure','Logo sur les boissons'],1,90000,60000,5000],
 [5,['Gobelets sur mesure'],2,105000,45000,5000],
 [5,['Gobelets sur mesure'],3,155000,65000,5000]
];
function fixedDate(instant){return class extends Date{constructor(...args){super(...(args.length?args:[instant]));}static now(){return new Date(instant).getTime();}};}
function helpers(source,end){return source.slice(source.indexOf('  function joursAvantEvenement('),source.indexOf(end,source.indexOf('  function joursAvantEvenement(')));}
test('Rush only for cups below 14 Paris calendar days, once per event, with updated service prices',async()=>{
 for(const [gap,options,dy,total,custom,rush] of cases){
  const calculated=await pricing.quote({...quote,d:policy.addDays(policy.today(now),gap),dy,options},undefined,now);
  assert.equal(calculated.normalCents,total);assert.equal(calculated.personalizationCents,custom);assert.equal(calculated.rushCupsCents,rush);
  assert.equal(paymentPlan(calculated,{code:'NATHALIE08'},{}).totalCents,100+custom);
  assert.equal(paymentPlan(calculated,{},{}).payableCents,Math.round(total/2));
 }
 const duplicate=await pricing.quote({...quote,d:'2026-11-12',options:['Gobelets sur mesure','Gobelets sur mesure']},undefined,now);assert.equal(duplicate.normalCents,55000);
});
test('Actual browser calculations agree with authoritative server across all urgency cases',async()=>{
 const html=await fs.readFile(new URL('../../devis-instantane.html',import.meta.url),'utf8');
 const detail=await fs.readFile(new URL('../../quote-details.js',import.meta.url),'utf8');
 const booking=await fs.readFile(new URL('../../reservation.html',import.meta.url),'utf8');
 const instantHelpers=helpers(html,'  function calcNormalPrice('),detailHelpers=helpers(detail,'  const km='),bookingHelpers=helpers(booking,'  function applyOfferPrice(');
 const calc=html.match(/function calcNormalPrice\(\) \{[\s\S]*?\n  \}/)[0];
 for(const [gap,names,days,total,custom,rush] of cases){
  const date=policy.addDays(policy.today(now),gap),DateClass=fixedDate(now);
  const ctx={Date:DateClass,Intl,A:{date,personalization:names,guests:50,hrs:1.5,days},window:{eywaTravel:{total:0}},persoTotal:()=>names.reduce((n,x)=>n+({'Habillage du bar':200,'Gobelets sur mesure':200,'Logo sur les boissons':150}[x]),0)};vm.createContext(ctx);
  assert.equal(vm.runInContext(instantHelpers+calc+';calcNormalPrice()',ctx)*100,total);
  const details={Date:DateClass,Intl,p:new URLSearchParams({d:date}),options:[{id:'cups',selected:names.includes('Gobelets sur mesure')}]};vm.createContext(details);assert.equal(vm.runInContext(detailHelpers+';rushCups()',details)*100,rush);
  const reservation={EywaPersonalizations:personalizations,Date:DateClass,Intl,P:{d:date,dy:days,options:JSON.stringify(names)}};vm.createContext(reservation);assert.equal(vm.runInContext(bookingHelpers+';personalizationCents()',reservation),custom);
 }
});
test('Paris midnight and DST use calendar days consistently in server and browser',async()=>{
 const html=await fs.readFile(new URL('../../devis-instantane.html',import.meta.url),'utf8');
 const helper=helpers(html,'  function supplementUrgence(');
 for(const [instant,date,expected] of [['2026-11-07T23:30:00Z','2026-11-21',13],['2026-11-07T22:30:00Z','2026-11-21',14],['2027-03-27T23:30:00Z','2027-04-10',13],['2027-03-27T22:30:00Z','2027-04-10',14]]){
  const ctx={Date:fixedDate(instant),Intl};vm.createContext(ctx);assert.equal(vm.runInContext(helper+`;joursAvantEvenement('${date}')`,ctx),expected);
  const calculated=await pricing.quote({...quote,d:date,options:['Gobelets sur mesure']},undefined,new Date(instant));assert.equal(calculated.rushCupsCents,expected<14?5000:0);
 }
});
test('Stripe request separates the one-time rush fee and preserves the full NATHALIE08 price',async()=>{
 const db=database(),bookings=createBookings(db),slots=createSlots(db);let params,posts=0;
 const calculated=await pricing.quote({...quote,d:'2026-11-12',dy:2,options:['Gobelets sur mesure']},undefined,now);
 const checkout=createCheckout({quote:async()=>calculated,getBookings:async()=>bookings,getSlots:async()=>slots,reconcile:async()=>{},json:(statusCode,data)=>({statusCode,body:JSON.stringify(data)}),settings:{EYWA_LAUNCH_ENABLED:'false'},request:async(path,method,values)=>{posts++;params=values;return {id:'cs_test_rush',url:'https://checkout.stripe.com/c/pay/test'};}});
 const event=expected=>({httpMethod:'POST',body:JSON.stringify({quote,bookingDetails,code:'NATHALIE08',expectedCents:expected})});
 try{
  assert.equal((await checkout(event(40100))).statusCode,409);assert.equal(posts,0);
  assert.equal((await checkout(event(45100))).statusCode,200);assert.equal(posts,1);
  assert.equal(params['line_items[0][price_data][unit_amount]'],'100');assert.equal(params['line_items[1][price_data][unit_amount]'],'40000');assert.equal(params['line_items[2][price_data][unit_amount]'],'5000');
  assert.equal(params['line_items[2][price_data][product_data][name]'],'Impression accélérée des gobelets');assert.equal(params['metadata[quote_total_cents]'],'45100');assert.equal(params['metadata[balance_cents]'],'0');
 }finally{db.raw.close();}
});
