import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {database} from './booking.test.mjs';
import {createCorrespondence,personalMail} from '../src/lib/crm-correspondence.mjs';
import {createCRM} from '../src/lib/crm.mjs';
import {registerQuote} from '../src/lib/followups.mjs';
import {crmHTTP} from '../src/lib/crm-http.mjs';
const q={id:'10000000-0000-4000-8000-000000000099',reference:'EYWA-FIXTURE',name:'Client fictif',email:'fixture@example.invalid',phone:'+33612345678',date:'2027-12-02',time:'10:00',hours:3,days:1,guests:100,eventType:'Entreprise',location:'Lieu fictif',options:['Habillage du bar','Gobelets sur mesure'],totalCents:70000,quoteUrl:'https://eywacoffeecatering.com/devis.html?id=fixture',details:'Message client enregistré'};
async function setup(){const DB=database();for(const f of ['0003_transactional_email.sql','0004_automation.sql','0006_balance_invoices.sql'])DB.raw.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));const env={DB,EYWA_AUTOMATION_ENABLED:'true'};DB.raw.prepare('INSERT INTO eywa_quotes VALUES(?,?,?,?)').run(q.id,'fixture',JSON.stringify(q),Date.now());await registerQuote(env,q);return env;}
test('correspondence: original quote and full contact remain available, no new financial record',async()=>{
 const env=await setup();try{const crm=createCRM(env),d=await crm.details('quote-'+q.id);assert.equal(d.data.name,q.name);assert.equal(d.originalQuote.phone,q.phone);assert.equal(d.clientMessage,q.details);assert.equal(d.correspondence.reminders.length,3);assert.equal((await crm.overview()).quotes[0].stage,'new');assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM eywa_bookings').get().n,0);assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM eywa_invoices').get().n,0);}finally{env.DB.raw.close();}
});
test('correspondence: notes and next action persist with stale edit protection and stop on lost',async()=>{
 const env=await setup(),c=createCorrespondence(env);try{
  await c.saveTracking({quoteId:q.id,stage:'contacted',notes:'Adapter les options, aucun prix modifié',nextActionDate:'2027-11-15',version:0});let d=await c.details(q.id);assert.equal(d.tracking.version,1);assert(d.tracking.notes.includes('options'));await assert.rejects(()=>c.saveTracking({quoteId:q.id,stage:'new',version:0}),e=>e.status===409);
  await c.saveTracking({quoteId:q.id,stage:'lost',version:1});assert.equal((await c.details(q.id)).quoteState,'closed');assert(env.DB.raw.prepare('SELECT state FROM eywa_reminders').all().every(x=>x.state==='cancelled'));assert.equal(JSON.parse(env.DB.raw.prepare('SELECT data_json FROM eywa_quotes').get().data_json).totalCents,70000);
 }finally{env.DB.raw.close();}
});
test('correspondence: drafts and previews never queue mail and escape all supplied HTML',async()=>{
 const env=await setup(),c=createCorrespondence(env);try{
  const r=await c.saveDraft({quoteId:q.id,subject:'Bonjour\r\nCamille',body:'Bonjour <script>alert(1)</script>\n\nUn conseil personnalisé.'});const preview=await c.preview(r.id);assert(!preview.html.includes('<script>'));assert(preview.html.includes('&lt;script&gt;'));assert(preview.html.includes('#fffdf9'));assert(preview.html.includes('eywa-wordmark-email-hd'));assert(!preview.subject.includes('\n'));assert(preview.html.includes('Voir le devis'));assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM eywa_email_outbox').get().n,0);
  await assert.rejects(()=>c.saveDraft({quoteId:q.id,subject:'Duplicate',body:'text'}),e=>e.status===409);
  await c.saveDraft({quoteId:q.id,id:r.id,version:1,subject:'Objet modifié',body:'Bonjour.'});await assert.rejects(()=>c.saveDraft({quoteId:q.id,id:r.id,version:1,subject:'stale'}),e=>e.status===409);
 }finally{env.DB.raw.close();}
});
test('correspondence: explicit sending uses saved client recipient and one immutable outbox message',async()=>{
 const env=await setup(),c=createCorrespondence(env);try{
  const {id}=await c.saveDraft({quoteId:q.id,subject:'Votre événement',body:'Bonjour, parlons des options.'});let deliveries=0;const mailer={deliver:async outId=>{deliveries++;env.DB.raw.prepare("UPDATE eywa_email_outbox SET status='sent',sent_at=? WHERE id=?").run(Date.now(),outId);}};
  await assert.rejects(()=>c.send({id,version:0},mailer),e=>e.status===409);
  await c.send({id,version:1,to:'attacker@example.invalid'},mailer);await c.send({id,version:1},mailer);assert.equal(deliveries,1);
  const rows=env.DB.raw.prepare('SELECT * FROM eywa_email_outbox').all();assert.equal(rows.length,1);assert.equal(rows[0].recipient,q.email);assert.equal(rows[0].kind,'crm-personal');assert(JSON.parse(rows[0].payload_json).text.includes('options'));await assert.rejects(()=>c.saveDraft({quoteId:q.id,id,version:1,subject:'Rewrite after send'}),e=>e.status===409);
 }finally{env.DB.raw.close();}
});
test('correspondence: local preview cannot send and blank messages cannot be queued',async()=>{
 const env=await setup(),c=createCorrespondence(env);try{const {id}=await c.saveDraft({quoteId:q.id,subject:'Empty',body:''});await assert.rejects(()=>c.send({id,version:1},{deliver:()=>assert.fail()}),/vide/);await c.saveDraft({quoteId:q.id,id,version:1,subject:'Local',body:'Text'});env.EYWA_AUTOMATION_ENABLED='false';await assert.rejects(()=>c.send({id,version:2},{deliver:()=>assert.fail()}),/désactivé/);assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM eywa_email_outbox').get().n,0);}finally{env.DB.raw.close();}
});
test('correspondence: preview requires login; writes require owner session and CSRF',async()=>{
 const env=await setup(),c=createCorrespondence(env);try{
  const {id}=await c.saveDraft({quoteId:q.id,subject:'Private',body:'Only owner sees this'}),url='https://test.example/espace/api/draft-preview?id='+id;
  assert.equal((await crmHTTP(new Request(url),env,{})).status,401);
  const token='a'.repeat(64),csrf='fixture-csrf';env.DB.raw.prepare('INSERT INTO eywa_crm_sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),csrf,Date.now()+60000);const cookie='__Host-eywa_session='+token;
  const res=await crmHTTP(new Request(url,{headers:{Cookie:cookie}}),env,{});assert.equal(res.status,200);assert((await res.text()).includes('Only owner sees this'));assert(res.headers.get('Cache-Control').includes('no-store'));assert(res.headers.get('Content-Security-Policy').includes("default-src 'none'"));
  const post=new Request('https://test.example/espace/api/action',{method:'POST',headers:{Cookie:cookie,Origin:'https://test.example','Content-Type':'application/json'},body:JSON.stringify({action:'mail-send',id,version:1})});assert.equal((await crmHTTP(post,env,{})).status,403);assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM eywa_email_outbox').get().n,0);
 }finally{env.DB.raw.close();}
});
test('correspondence: template rejects executable links and includes safe quoted URL',()=>{const p=personalMail({...q,quoteUrl:'javascript:alert(1)'},{subject:'Test',body_text:'Bonjour'});assert(!p.html.includes('href="javascript:'));assert(!p.html.includes('Voir le devis</a>'));});

test('correspondence: Gmail history distinguishes owner sends, customer replies and archived documents',async()=>{
 const env=await setup();try{for(const [id,from]of [['out','Louis <contact.eywa08@gmail.com>'],['in','Client <fixture@example.invalid>'],['doc',null]])env.DB.raw.prepare('INSERT INTO eywa_sync_events(event_id,quote_id,data_json,created_at) VALUES(?,?,?,?)').run(id,q.id,JSON.stringify({id,from,title:id}),Date.now());const messages=(await createCRM(env).details('quote-'+q.id)).messages;assert.equal(messages.find(m=>m.id==='out').status,'sent');assert.equal(messages.find(m=>m.id==='in').status,'received');assert.equal(messages.find(m=>m.id==='doc').status,'archived');}finally{env.DB.raw.close();}
});
