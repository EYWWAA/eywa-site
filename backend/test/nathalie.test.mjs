import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paymentPlan} from '../src/lib/payment-plan.mjs';
import pricing from '../src/lib/pricing.cjs';
import {createCheckout} from '../src/checkout.mjs';
import {database,quote,bookingDetails} from './booking.test.mjs';
import {createBookings} from '../src/lib/bookings.mjs';
import {createSlots} from '../src/lib/slots.mjs';

test('NATHALIE08: service reduced to one euro, selected personalizations kept for every day',async()=>{
 for(const [options,days,total] of [[[],1,100],[['Habillage du bar'],1,20100],[['Gobelets sur mesure'],1,20100],[['Logo sur les boissons'],1,15100],[['Habillage du bar','Gobelets sur mesure','Logo sur les boissons'],1,55100],[['Habillage du bar'],2,40100]]){
  const calculated=await pricing.quote({...quote,options,dy:days});
  for(const code of ['NATHALIE08','Nathalie08',' nathalie08 ']){
   const plan=paymentPlan(calculated,{code,offer:true},{});
   assert.equal(plan.totalCents,total);assert.equal(plan.payableCents,total);assert.equal(plan.launch,false);assert.equal(plan.kind,'full_special');assert(plan.serviceSpecial);
  }
 }
 const large=await pricing.quote({...quote,g:200,h:4,options:['Gobelets sur mesure']});
 assert.equal(paymentPlan(large,{code:'NATHALIE08'},{}).totalCents,20100);
});
test('Travel included, wrong code rejected, old and normal flows preserved',()=>{
 const calculated={normalCents:55000,discountedCents:19000,personalizationCents:10000,travel:{total:150}};
 assert.equal(paymentPlan(calculated,{code:'NATHALIE08'},{}).totalCents,10100);
 assert.throws(()=>paymentPlan(calculated,{code:'NATHALIE09'},{}),{code:'CODE_INVALID'});
 assert.equal(paymentPlan(calculated,{code:'1€'},{EYWA_SPECIAL_PRICE_CODE:'1€'}).totalCents,100);
 const normal=paymentPlan(calculated,{},{});assert.equal(normal.payableCents,27500);assert.equal(normal.kind,'deposit');
});
test('Checkout charges exactly service and travel plus options, refuses stale one-euro expectation and protects booked date',async()=>{
 const db=database(),bookings=createBookings(db),slots=createSlots(db);
 const calculated={normalCents:85000,discountedCents:49000,personalizationCents:40000,travel:{total:150},dates:['2027-11-15']};
 let posts=0,params;
 const checkout=createCheckout({quote:async()=>calculated,getBookings:async()=>bookings,getSlots:async()=>slots,reconcile:async()=>{},json:(statusCode,data)=>({statusCode,body:JSON.stringify(data)}),settings:{EYWA_LAUNCH_ENABLED:'false'},request:async(path,method,values)=>{assert.equal(method,'POST');posts++;params=values;return {id:'cs_test_nathalie',url:'https://checkout.stripe.com/c/pay/test'};}});
 const event=expected=>({httpMethod:'POST',body:JSON.stringify({quote,bookingDetails,code:'NATHALIE08',offer:true,expectedCents:expected})});
 try{
  assert.equal((await checkout(event(100))).statusCode,409);assert.equal(posts,0);
  assert.equal((await checkout(event(40100))).statusCode,200);assert.equal(posts,1);
  assert.equal(params['line_items[0][price_data][unit_amount]'],'100');assert.equal(params['line_items[1][price_data][unit_amount]'],'40000');assert.equal(params['line_items[2][price_data][unit_amount]'],undefined);
  assert.equal(params['metadata[quote_total_cents]'],'40100');assert.equal(params['metadata[balance_cents]'],'0');assert.equal(params['metadata[payment_kind]'],'full_special');
  assert.equal(params['metadata[eywa_claim]'],undefined);assert.equal((await slots.status()).available,1);
  assert.equal((await checkout(event(40100))).statusCode,409);assert.equal(posts,1);
 }finally{db.raw.close();}
});
