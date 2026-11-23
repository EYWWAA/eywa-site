import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {database,quote,bookingDetails} from './booking.test.mjs';
import {createCheckout} from '../src/checkout.mjs';
import {createBookings} from '../src/lib/bookings.mjs';
import {createSlots} from '../src/lib/slots.mjs';
import {registerQuote,quoteExpiry,expireOverlapping,queueFollowups,eventStart} from '../src/lib/followups.mjs';
import {createMailer} from '../src/lib/mail-delivery.mjs';
import {quoteMail} from '../src/lib/mail-templates.mjs';
import {dateTakenMail} from '../src/lib/payment-automation.mjs';
const day=86400000;
function setup(){const DB=database();for(const f of ['0003_transactional_email.sql','0004_automation.sql','0016_quote_expiry.sql'])DB.raw.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));return {DB,EYWA_AUTOMATION_ENABLED:'true',EYWA_MAIL_RELAY_URL:'https://script.google.com/macros/s/fixture/exec',EYWA_MAIL_RELAY_SECRET:'test-only'};}
async function save(env,{now=Date.now(),date='2027-11-15',days=1,name='Client Test'}={}){const id=randomUUID(),q={id,createdAt:now,reference:'EYWA-'+id.slice(0,8),email:'client@example.com',name,firstName:'Client',eventType:'Salon',date,time:'14:00',hours:1.5,days,guests:50,options:[],totalCents:25000,normalCents:25000,lineItems:[]};env.DB.raw.prepare('INSERT INTO eywa_quotes(id,request_key,data_json,created_at) VALUES(?,?,?,?)').run(id,randomUUID(),JSON.stringify(q),now);await registerQuote(env,q,now);return q;}
const state=(env,id)=>env.DB.raw.prepare('SELECT * FROM eywa_quote_state WHERE quote_id=?').get(id);

test('expiry: 14 days after sending, never later than midnight the day before the event',()=>{
 const now=Date.parse('2026-11-23T10:00:00Z');
 assert.equal(quoteExpiry(now,'2027-03-01'),now+14*day);
 assert.equal(quoteExpiry(now,'2026-11-30'),eventStart('2026-11-30')-day);
});
test('expiry: a new quote stores its expiry and the document shows it',async()=>{
 const env=setup();try{const now=Date.now(),q=await save(env,{now});assert.equal(state(env,q.id).expires_at,quoteExpiry(now,q.date));
  assert.match(quoteMail({...q,expiresAt:now+14*day},false,{document:true}).html,/Valable jusqu’au/);
  assert.match(quoteMail({...q,expiresAt:now-1},false,{document:true}).html,/Expiré depuis le/);
 }finally{env.DB.raw.close();}
});
test('expiry: the migration gives open quotes an expiry and leaves paid ones alone',()=>{
 const DB=database();try{for(const f of ['0003_transactional_email.sql','0004_automation.sql'])DB.raw.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
  const created=Date.parse('2026-11-22T10:00:00Z'),event=Date.parse('2027-05-01T00:00:00+02:00');
  for(const id of ['open1','paid1','soon1'])DB.raw.prepare("INSERT INTO eywa_quotes(id,request_key,data_json,created_at) VALUES(?,?,'{}',?)").run(id,id,created);
  DB.raw.prepare("INSERT INTO eywa_quote_state(quote_id,event_at,created_at,status) VALUES('open1',?,?,'open'),('paid1',?,?,'paid'),('soon1',?,?,'open')").run(event,created,event,created,created+3*day,created);
  DB.raw.exec(fs.readFileSync(new URL('../migrations/0016_quote_expiry.sql',import.meta.url),'utf8'));
  const get=id=>DB.raw.prepare('SELECT expires_at FROM eywa_quote_state WHERE quote_id=?').get(id).expires_at;
  assert.equal(get('open1'),created+14*day);assert.equal(get('paid1'),null);assert.equal(get('soon1'),created+2*day);
 }finally{DB.raw.close();}
});
test('expiry: an expired quote cannot be paid, a valid one still can',async()=>{
 const env=setup(),bookings=createBookings(env.DB),slots=createSlots(env.DB);try{
  const q=await save(env),calculated={normalCents:25000,discountedCents:25000,personalizationCents:0,travel:{total:0},dates:['2027-11-15']};let posts=0;
  const checkout=createCheckout({quote:async()=>calculated,getBookings:async()=>bookings,getSlots:async()=>slots,reconcile:async()=>{},json:(statusCode,data)=>({statusCode,body:JSON.stringify(data)}),settings:{EYWA_LAUNCH_ENABLED:'false'},findQuote:async id=>id===q.id?q:null,quoteState:async id=>env.DB.prepare('SELECT status,expires_at FROM eywa_quote_state WHERE quote_id=?').bind(id).first(),request:async()=>{posts++;return {id:'cs_test_exp',url:'https://checkout.stripe.com/c/pay/test'};}});
  const event={httpMethod:'POST',body:JSON.stringify({quote:{...quote,qid:q.id},bookingDetails,expectedCents:12500})};
  env.DB.raw.prepare('UPDATE eywa_quote_state SET expires_at=? WHERE quote_id=?').run(Date.now()-1,q.id);
  const refused=await checkout(event);assert.equal(refused.statusCode,410);assert.equal(JSON.parse(refused.body).code,'QUOTE_EXPIRED');assert.equal(posts,0);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_bookings').get().n,0);
  env.DB.raw.prepare('UPDATE eywa_quote_state SET expires_at=NULL WHERE quote_id=?').run(q.id);
  assert.equal((await checkout(event)).statusCode,200);assert.equal(posts,1);
 }finally{env.DB.raw.close();}
});
test('expiry: no follow-up is sent once a quote has expired',async()=>{
 const env=setup();try{const now=Date.now(),q=await save(env,{now}),mailer=createMailer(env,async()=>Response.json({ok:true}));
  await mailer.enqueue('quote:'+q.id+':client',q.email,{subject:'Devis',text:'x',html:'x'},q.id,'quote');await mailer.flush();
  env.DB.raw.prepare('UPDATE eywa_quote_state SET expires_at=? WHERE quote_id=?').run(now+day/2,q.id);
  await queueFollowups(env,mailer,now+day+1);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM eywa_email_outbox WHERE kind='reminder'").get().n,0);
 }finally{env.DB.raw.close();}
});
test('expiry: a taken date expires only the other open quotes that overlap it',async()=>{
 const env=setup();try{const paid=await save(env,{date:'2027-11-15'}),same=await save(env,{date:'2027-11-15',name:'Même jour'}),spans=await save(env,{date:'2027-11-14',days:2,name:'Deux jours'}),other=await save(env,{date:'2027-11-20',name:'Autre jour'});
  const hit=await expireOverlapping(env,'2027-11-15','2027-11-15',paid.id);
  assert.deepEqual(hit.map(q=>q.name).sort(),['Deux jours','Même jour']);
  assert(state(env,same.id).expires_at<=Date.now());assert(state(env,spans.id).expires_at<=Date.now());assert(state(env,other.id).expires_at>Date.now());assert(state(env,paid.id).expires_at>Date.now());
  assert.equal((await expireOverlapping(env,'2027-11-15','2027-11-15',paid.id)).length,0);
  const mail=dateTakenMail([{name:'<b>X</b>',email:'x@example.com'}],'2027-11-15');assert.match(mail.subject,/15 novembre 2027/);assert.doesNotMatch(mail.html,/<b>X<\/b>/);
 }finally{env.DB.raw.close();}
});
