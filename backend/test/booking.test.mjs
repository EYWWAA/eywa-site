import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createSlots} from '../src/lib/slots.mjs';
import {handle} from '../src/worker.mjs';
import {verify} from '../src/webhook.mjs';
import {createHmac} from 'node:crypto';
export function database(seed=true){
 const raw=new DatabaseSync(':memory:');
 for(const name of ['0001_launch_slots.sql','0002_booking_calendar.sql'])raw.exec(fs.readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 if(seed)raw.exec("INSERT INTO eywa_launch_slots(slot,state) VALUES(1,'available'),(2,'available');INSERT INTO eywa_migration VALUES(1,'test-only','fixture');INSERT INTO eywa_booking_import VALUES(1,'test-only','fixture');");
 return {raw,prepare(sql){return {bind(...args){const statement=raw.prepare(sql);return {first:async()=>statement.get(...args)||null,all:async()=>({results:statement.all(...args)}),run:async()=>statement.run(...args),_run:()=>statement.run(...args)}}}},async batch(statements){raw.exec('BEGIN IMMEDIATE');try{const out=statements.map(s=>({success:true,meta:s._run()}));raw.exec('COMMIT');return out;}catch(e){raw.exec('ROLLBACK');throw e;}}};
}
export const bookingDetails={address:'Place de la Gare, Charleville-Mézières',contactName:'Contact de contrôle',phone:'+33612345678',phoneCountry:'FR',setupLocation:'Hall',outdoor:'Non',unloadParking:'Cour',eventParking:'Parking',dressCode:'Tenue barista (tablier)',dressDetails:'',access60:true,space:true,power220:true,cgv:true,billingName:'Fixture de contrôle'};
export const quote={g:50,h:1.5,dy:1,ti:'14:00',d:'2027-11-15',country:'FR',lat:49.8,lng:4.8,options:[]};
export const request=(route,method='GET',body)=>new Request('https://test.example/'+route,{method,headers:{Origin:'https://eywacoffeecatering.com','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
export function context(){const tasks=[];return {waitUntil:p=>tasks.push(p),done:()=>Promise.all(tasks)}}
test('D1 SQL: one concurrent claim, verified payment, no reset after payment',async()=>{
 const db=database(),slots=createSlots(db);assert.equal((await slots.status()).available,1);
 const attempts=await Promise.all(Array.from({length:12},()=>slots.claim(65000,13000)));const won=attempts.filter(Boolean);assert.equal(won.length,1);
 const row=won[0];await slots.attach(row.claim_id,'cs_test_first');
 const paid={id:'cs_test_first',metadata:{eywa_claim:row.claim_id},payment_status:'paid',currency:'eur',amount_total:13000};
 assert.equal(await slots.paid({...paid,amount_total:100}),false);assert.equal(await slots.paid({...paid,payment_status:'unpaid'}),false);
 assert.equal(await slots.paid(paid),true);assert.equal(await slots.paid(paid),true);await slots.release(row.claim_id,paid.id);
 assert.equal((await slots.status()).remaining,0);assert.equal(await slots.claim(65000,13000),null);db.raw.close();
});
test('Historical second slot holds and paid records still prevent a new discount',async()=>{
 const db=database(),slots=createSlots(db);db.raw.exec("UPDATE eywa_launch_slots SET state='held',claim_id='legacy',normal_cents=65000,payable_cents=13000,session_id='cs_test_old' WHERE slot=2");
 assert.equal((await slots.status()).active,false);assert.equal(await slots.claim(65000,13000),null);
 assert(await slots.paid({id:'cs_test_old',metadata:{eywa_claim:'legacy'},payment_status:'paid',currency:'eur',amount_total:13000}));
 assert.equal((await slots.status()).remaining,0);db.raw.close();
});
test('Unknown old state fails closed and creates no available promotion',async()=>{
 const DB=database(false),ctx=context(),env={DB,EYWA_LAUNCH_ENABLED:'true'};
 assert.equal((await handle(request('launch-offer'),env,ctx)).status,503);
 assert.equal((await handle(request('launch-checkout','POST',{quote,bookingDetails,offer:true,expectedCents:6000}),env,ctx)).status,503);
 assert.equal(DB.raw.prepare('SELECT COUNT(*) AS c FROM eywa_launch_slots').get().c,0);DB.raw.close();
});
test('Display responses share a cache, fresh pre-payment verification bypasses it',async()=>{
 const DB=database(),ctx=context(),env={DB,EYWA_LAUNCH_ENABLED:'true'},map=new Map();let writes=0;
 const cache={match:async k=>map.get(k.url)?.clone(),put:async(k,v)=>{writes++;map.set(k.url,v.clone())}};
 const first=await handle(request('launch-offer'),env,ctx,cache);assert((await first.json()).active);await ctx.done();assert.equal(writes,1);
 DB.raw.exec("UPDATE eywa_launch_slots SET state='paid',claim_id='old',session_id='cs_test_old',normal_cents=65000,payable_cents=13000,paid_at='2026-10-20' WHERE slot=1");
 assert((await (await handle(request('launch-offer'),env,ctx,cache)).json()).active);
 const fresh=await handle(request('launch-offer?fresh=1'),env,ctx,cache);assert.equal((await fresh.json()).active,false);assert.equal(fresh.headers.get('Cache-Control'),'no-store');assert.equal(writes,1);DB.raw.close();
});
test('Full discounted Stripe checkout; changed or unavailable offers never charge normal price silently',async()=>{
 const DB=database(),ctx=context(),env={DB,EYWA_LAUNCH_ENABLED:'true',STRIPE_SECRET_KEY:'test-only'},original=globalThis.fetch;let posts=0,parameters;
 globalThis.fetch=async(url,options={})=>{
  if(url.includes('/coupons/'))return Response.json({percent_off:80});
  if(options.method==='POST'){posts++;parameters=new URLSearchParams(options.body);return Response.json({id:'cs_test_created',url:'https://checkout.stripe.com/c/pay/test'});}
  if(url.includes('/checkout/sessions/'))return Response.json({status:'open',payment_status:'unpaid'});
  throw Error('Unexpected external request');
 };
 try{
  let res=await handle(request('launch-checkout','POST',{quote,offer:true,expectedCents:100}),env,ctx);assert.equal(res.status,409);assert.equal(posts,0);
  res=await handle(request('launch-checkout','POST',{quote,bookingDetails,offer:true,expectedCents:6000}),env,ctx);assert.equal(res.status,200);assert.equal(posts,1);assert.equal(parameters.get('line_items[0][price_data][unit_amount]'),'6000');assert.equal(parameters.has('discounts[0][coupon]'),false);assert.equal(parameters.get('metadata[balance_cents]'),'0');
  res=await handle(request('launch-checkout','POST',{quote,bookingDetails,offer:true,expectedCents:6000}),env,ctx);assert.equal(res.status,409);assert.equal((await res.json()).code,'DATE_UNAVAILABLE');assert.equal(posts,1);
 }finally{globalThis.fetch=original;DB.raw.close();}
});
test('Signature verification rejects altered and expired events',()=>{
 const now=Date.now(),timestamp=Math.floor(now/1000),raw='{"type":"checkout.session.completed"}',secret='test-only';
 const signature='t='+timestamp+',v1='+createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex');
 assert(verify(raw,signature,secret,now));assert(!verify(raw+' ',signature,secret,now));assert(!verify(raw,signature,secret,now+400000));
});
test('Normal checkout keeps the 50% deposit and rejects foreign origins',async()=>{
 const DB=database(),ctx=context(),env={DB,EYWA_LAUNCH_ENABLED:'false',STRIPE_SECRET_KEY:'test-only'},original=globalThis.fetch;let params;
 globalThis.fetch=async(url,options)=>{params=new URLSearchParams(options.body);return Response.json({id:'cs_test_deposit',url:'https://checkout.stripe.com/c/pay/test'})};
 try{
  const res=await handle(request('launch-checkout','POST',{quote,bookingDetails,offer:false,expectedCents:15000}),env,ctx);assert.equal(res.status,200);assert.equal(params.get('line_items[0][price_data][unit_amount]'),'15000');assert.equal(params.get('metadata[balance_cents]'),'15000');assert.equal(params.has('discounts[0][coupon]'),false);
  const foreign=new Request('https://test.example/launch-checkout',{method:'POST',headers:{Origin:'https://other.example'},body:'{}'});assert.equal((await handle(foreign,env,ctx)).status,403);
 }finally{globalThis.fetch=original;DB.raw.close();}
});
test('Signed Stripe webhook consumes the original claim exactly once',async()=>{
 const DB=database(),slots=createSlots(DB),ctx=context(),secret='test-only',env={DB,STRIPE_WEBHOOK_SECRET:secret};const claim=await slots.claim(65000,13000);await slots.attach(claim.claim_id,'cs_test_signed');
 const raw=JSON.stringify({type:'checkout.session.completed',data:{object:{id:'cs_test_signed',payment_status:'paid',currency:'eur',amount_total:13000,metadata:{eywa_claim:claim.claim_id}}}}),t=Math.floor(Date.now()/1000);
 const signature='t='+t+',v1='+createHmac('sha256',secret).update(t+'.'+raw).digest('hex');
 const req=()=>new Request('https://test.example/launch-webhook',{method:'POST',headers:{'stripe-signature':signature},body:raw});
 assert.equal((await handle(req(),env,ctx)).status,200);assert.equal((await handle(req(),env,ctx)).status,200);assert.equal((await slots.status()).remaining,0);
 const bad=new Request('https://test.example/launch-webhook',{method:'POST',headers:{'stripe-signature':signature},body:raw+' '});assert.equal((await handle(bad,env,ctx)).status,400);DB.raw.close();
});
test('Webhook signature does not depend on a global Node Buffer in Workers',()=>{
 const previous=globalThis.Buffer;
 const now=Date.now(),t=Math.floor(now/1000),raw='{"type":"eywa.migration_check","data":{"object":{}}}',secret='test-only';
 const signature='t='+t+',v1='+createHmac('sha256',secret).update(t+'.'+raw).digest('hex');
 try{globalThis.Buffer=undefined;assert(verify(raw,signature,secret,now));}finally{globalThis.Buffer=previous;}
});
