import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import {database,context,request,quote,bookingDetails} from './booking.test.mjs';
import {createCRM,eventTimeline,parisTime,taskTemplates,defaultSettings,occupiedTimelineDays} from '../src/lib/crm.mjs';
import {requestCode,verifyCode,crmSession,logout} from '../src/lib/crm-auth.mjs';
import {crmHTTP} from '../src/lib/crm-http.mjs';
import {createBookings} from '../src/lib/bookings.mjs';
import {queueFollowups} from '../src/lib/followups.mjs';

export function crmDatabase(){const DB=database();for(const f of ['0003_transactional_email.sql','0004_automation.sql','0006_balance_invoices.sql','0016_quote_expiry.sql'])DB.raw.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));return DB;}
const envFor=DB=>({DB,EYWA_AUTOMATION_ENABLED:'true',EYWA_MAIL_RELAY_SECRET:'local-test-only'});
const manual={name:'Client fictif',email:'fixture@example.com',date:'2027-06-01',time:'10:00',hours:2,days:1,guests:70,eventType:'Mariage',location:'Lieu fictif'};
function signedChallenge(env,id='10000000-0000-4000-8000-000000000001',code='12345678'){
 const h=createHmac('sha256',env.EYWA_MAIL_RELAY_SECRET).update('eywa-crm-v1:'+id+':'+code).digest('hex');env.DB.raw.prepare('INSERT INTO eywa_crm_auth(id,code_hash,expires_at) VALUES(?,?,?)').run(id,h,Date.now()+600000);return {id,code};
}
test('CRM: Paris timeline handles winter, summer, midnight and invalid DST hours',()=>{
 assert.equal(parisTime('2027-01-15','10:00'),Date.parse('2027-01-15T09:00:00Z'));
 assert.equal(parisTime('2027-06-01','10:00'),Date.parse('2027-06-01T08:00:00Z'));
 assert.throws(()=>parisTime('2027-03-28','02:30'));
 const t=eventTimeline({...manual,time:'00:30'},defaultSettings,{travelMinutes:180});assert(t.startsAt<parisTime(manual.date,'00:00'));assert.equal((t.serviceEnd-t.serviceStart)/3600000,2);
 assert.throws(()=>eventTimeline(manual,defaultSettings,{travelMinutes:-1}));
});
test('CRM: booking holds include preparation before midnight and return after midnight without changing amounts',async()=>{
 const DB=crmDatabase();try{
  const calculated={dates:['2027-06-01'],normalCents:30000,trip:{outwardMinutes:180}};
  assert.deepEqual(await occupiedTimelineDays({DB},{d:'2027-06-01',ti:'02:00',h:2,dy:1},calculated),['2027-05-31','2027-06-01']);
  assert.deepEqual(await occupiedTimelineDays({DB},{d:'2027-06-01',ti:'22:00',h:2,dy:1},calculated),['2027-06-01','2027-06-02']);assert.equal(calculated.normalCents,30000);
 }finally{DB.raw.close();}
});
test('CRM: option-specific preparation is dated relative to the event and preserves completed tasks',async()=>{
 const DB=crmDatabase(),crm=createCRM(envFor(DB));try{
  assert(taskTemplates({...manual,options:['Gobelets sur mesure']}).some(t=>t.dueDate==='2027-05-11'&&t.key==='cups'));
  assert(!taskTemplates({...manual,options:['Gobelets avec stickers']}).some(t=>t.key==='cups'));
  const {id}=await crm.mutate('manual-event',manual);let tasks=DB.raw.prepare('SELECT * FROM eywa_crm_tasks WHERE event_id=?').all(id);assert.equal(tasks.length,5);assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM eywa_crm_brief_items WHERE event_id=?').get(id).n,30);
  await crm.mutate('task',{id:tasks[0].id,done:true});await crm.mutate('event',{id,notes:'Préparation validée'});
  tasks=DB.raw.prepare('SELECT * FROM eywa_crm_tasks WHERE event_id=?').all(id);assert.equal(tasks.length,5);assert.equal(tasks.filter(t=>t.done).length,1);assert(tasks.find(t=>t.done).completed_at);
 }finally{DB.raw.close();}
});
test('CRM: owner-only login, one-use codes, hashed sessions and expiry',async()=>{
 const DB=crmDatabase(),env=envFor(DB);try{
  let to,payload;const mailer={enqueue:async(id,recipient,p)=>{to=recipient;payload=p;},deliver:async()=>{}};
  const issued=await requestCode(new Request('https://test.example/espace/api/login'),env,mailer);
  assert.equal(to,'contact.eywa08@gmail.com');assert(!JSON.stringify(issued).includes('Votre code de connexion EYWA :'));
  const code=payload.text.match(/EYWA : (\d{8})/)[1];assert(!DB.raw.prepare('SELECT code_hash FROM eywa_crm_auth').get().code_hash.includes(code));
  const verified=await verifyCode(env,issued.challenge,code),token=verified.header.split(';')[0],req=new Request('https://test.example/espace/api/session',{headers:{Cookie:token}});
  assert(verified.header.includes('Secure; HttpOnly; SameSite=Strict'));assert((await crmSession(req,env)).csrf);
  assert(!DB.raw.prepare('SELECT token_hash FROM eywa_crm_sessions').get().token_hash.includes(token.split('=')[1]));
  await assert.rejects(()=>verifyCode(env,issued.challenge,code));await logout(req,env);assert.equal(await crmSession(req,env),null);
  const x=signedChallenge(env);await assert.rejects(()=>verifyCode(env,x.id,x.code,Date.now()+700000));
 }finally{DB.raw.close();}
});
test('CRM: brute-force and repeated login attempts are bounded',async()=>{
 const DB=crmDatabase(),env=envFor(DB);try{
  const x=signedChallenge(env);for(let i=0;i<6;i++)await assert.rejects(()=>verifyCode(env,x.id,'00000000'));
  await assert.rejects(()=>verifyCode(env,x.id,x.code));
  const req=new Request('https://test.example/espace/api/login'),mail={enqueue:async()=>{},deliver:async()=>{}};
  for(let i=0;i<3;i++)await requestCode(req,env,mail);await assert.rejects(()=>requestCode(req,env,mail),e=>e.status===429);
 }finally{DB.raw.close();}
});
test('CRM: public assets contain no private data; all data and writes require a session and CSRF',async()=>{
 const DB=crmDatabase(),env=envFor(DB);try{
  let r=await crmHTTP(new Request('https://test.example/espace'),env,context());assert.equal(r.status,200);assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow');assert(r.headers.get('Content-Security-Policy').includes("script-src 'self'"));
  r=await crmHTTP(new Request('https://test.example/espace/api/overview'),env,context());assert.equal(r.status,401);
  const x=signedChallenge(env),v=await verifyCode(env,x.id,x.code);const req=(origin,csrf)=>new Request('https://test.example/espace/api/action',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:v.header.split(';')[0],'X-EYWA-CSRF':csrf},body:JSON.stringify({action:'manual-event',...manual})});
  assert.equal((await crmHTTP(req('https://attacker.example',v.csrf),env,context())).status,403);assert.equal((await crmHTTP(req('https://test.example','wrong'),env,context())).status,403);
  assert.equal((await crmHTTP(req('https://test.example',v.csrf),env,context())).status,200);
 }finally{DB.raw.close();}
});
test('CRM: block dates and public claims cannot race past each other',async()=>{
 const DB=crmDatabase(),crm=createCRM(envFor(DB)),bookings=createBookings(DB);try{
  await crm.mutate('block',{from:'2027-07-01',to:'2027-07-03',label:'Indisponible'});
  assert.deepEqual(await bookings.busy('2027-07-01','2027-07-04'),['2027-07-01','2027-07-02','2027-07-03']);
  assert.equal(await bookings.claim(['2027-07-01'],30000,15000,'deposit',{}),null);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM eywa_bookings').get().n,0);
  assert(await bookings.claim(['2027-07-04'],30000,15000,'deposit',{}));
  await assert.rejects(()=>crm.mutate('block',{from:'2027-07-04',to:'2027-07-04',label:'Conflict'}),e=>e.status===409);
  const {id}=await crm.mutate('manual-event',manual);assert.equal(await bookings.claim(['2027-06-01'],30000,15000,'deposit',{}),null);
  await crm.mutate('event',{id,status:'cancelled'});assert(await bookings.claim(['2027-06-01'],30000,15000,'deposit',{}));
 }finally{DB.raw.close();}
});
test('CRM: resource capacity, quantities, overlap and deactivation are enforced',async()=>{
 const DB=crmDatabase(),crm=createCRM(envFor(DB));try{
  const a=await crm.mutate('manual-event',manual),b=await crm.mutate('manual-event',{...manual,date:'2027-06-02'});
  await crm.mutate('assign',{eventId:a.id,resourceId:'louis',quantity:1});
  DB.raw.prepare('UPDATE eywa_crm_events SET starts_at=?,ends_at=? WHERE id=?').run(parisTime(manual.date,'11:00'),parisTime(manual.date,'12:00'),b.id);
  await assert.rejects(()=>crm.mutate('assign',{eventId:b.id,resourceId:'louis',quantity:1}),e=>e.status===409);
  await assert.rejects(()=>crm.mutate('assign',{eventId:a.id,resourceId:'bar-eywa',quantity:2}));
  await assert.rejects(()=>crm.mutate('resource',{id:'louis',kind:'staff',name:'Louis',quantity:1,active:false}),e=>e.status===409);
  await crm.mutate('assign',{eventId:a.id,resourceId:'louis',quantity:0});assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM eywa_crm_assignments').get().n,0);
 }finally{DB.raw.close();}
});
test('CRM: paid reservations sync once, do not mutate financial snapshots or restart follow-ups',async()=>{
 const DB=crmDatabase(),env=envFor(DB),crm=createCRM(env),bookings=createBookings(DB);try{
  const q={id:'20000000-0000-4000-8000-000000000001',...manual,reference:'EYWA-FIXTURE',options:['Gobelets sur mesure']};
  DB.raw.prepare('INSERT INTO eywa_quotes VALUES(?,?,?,?)').run(q.id,'fixture',JSON.stringify(q),Date.now());
  DB.raw.prepare("INSERT INTO eywa_quote_state(quote_id,status,event_at,created_at) VALUES(?,'paid',?,?)").run(q.id,parisTime(manual.date,'10:00'),Date.now());
  const b=await bookings.claim([manual.date],50000,25000,'deposit',{...bookingDetails,quoteId:q.id,eventSummary:{date:q.date,hours:2,time:'10:00',days:1,guests:70,options:q.options}});await bookings.attach(b.id,'cs_test_crm');await bookings.paid({id:'cs_test_crm',payment_status:'paid',currency:'eur',amount_total:25000,metadata:{eywa_booking:b.id}});
  const before=DB.raw.prepare('SELECT details_json FROM eywa_bookings').get().details_json;await crm.sync();await crm.sync();
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM eywa_crm_events').get().n,1);assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM eywa_crm_tasks').get().n,7);assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM eywa_email_outbox').get().n,0);
  await crm.mutate('event',{id:'booking-'+b.id,notes:'À préparer'});assert.equal(DB.raw.prepare('SELECT details_json FROM eywa_bookings').get().details_json,before);
  await assert.rejects(()=>crm.mutate('event',{id:'booking-'+b.id,status:'cancelled'}));
  const data=await crm.overview();assert.equal(data.events.length,1);assert.equal((await crm.details('booking-'+b.id)).data.notes,'À préparer');
 }finally{DB.raw.close();}
});
test('CRM: review requires enabled setting, completed real event, consent, delay; idempotent and no old/test send',async()=>{
 const DB=crmDatabase(),env=envFor(DB),crm=createCRM(env),sent=new Map(),mailer={enqueue:async(id,to,p)=>{sent.set(id,{to,...p});}};try{
  await crm.mutate('settings',{...defaultSettings,reviewEnabled:false});
  const created=await crm.mutate('manual-event',manual),id=created.id,finish=parisTime(manual.date,'15:00');
  await crm.mutate('event',{id,status:'completed'});await crm.mutate('review',{id,enabled:true});
  await crm.reviewQueue(mailer,finish+3*86400000);assert.equal(sent.size,0);
  await crm.mutate('settings',{...defaultSettings,reviewEnabled:true});await crm.reviewQueue(mailer,finish+3*86400000);await crm.reviewQueue(mailer,finish+3*86400000);assert.equal(sent.size,1);assert.equal([...sent.values()][0].to,'fixture@example.com');
  const second=await crm.mutate('manual-event',{...manual,name:'Client TEST',date:'2027-06-02'});await crm.mutate('event',{id:second.id,status:'completed'});await crm.mutate('review',{id:second.id,enabled:true});await crm.reviewQueue(mailer,finish+4*86400000);assert.equal(sent.size,1);
 }finally{DB.raw.close();}
});

test('CRM: notes de contact, ajout, épinglage et suppression',async()=>{
 const DB=crmDatabase();try{const crm=createCRM(envFor(DB));
  await assert.rejects(()=>crm.mutate('contact-note',{contactKey:'@a@b.fr',body:'  '}));
  await crm.mutate('contact-note',{contactKey:'@a@b.fr',body:'Préfère les mails le matin'},1000);await crm.mutate('contact-note',{contactKey:'@a@b.fr',body:'Rappeler en janvier'},2000);
  let notes=(await crm.overview()).contactNotes;assert.equal(notes.length,2);assert.equal(notes[0].body,'Rappeler en janvier');
  await crm.mutate('contact-note-pin',{id:notes[1].id,pinned:true});notes=(await crm.overview()).contactNotes;assert.equal(notes[0].body,'Préfère les mails le matin');assert.equal(notes[0].pinned,1);
  await crm.mutate('contact-note-delete',{id:notes[0].id});assert.equal((await crm.overview()).contactNotes.length,1);
  await assert.rejects(()=>crm.mutate('contact-note-delete',{id:'inconnu'}));
 }finally{DB.raw.close();}
});
