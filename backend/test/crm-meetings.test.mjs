import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crmDatabase} from './crm.test.mjs';
import {createProspects} from '../src/lib/crm-prospects.mjs';
import {createMeetings} from '../src/lib/crm-meetings.mjs';
const env=DB=>({DB,EYWA_MAIL_RELAY_SECRET:'local-test-only'});
function mailerFor(DB,log){return {enqueue:async(id,to,payload,q,kind)=>{log.push({id,to,payload});DB.raw.prepare("INSERT OR IGNORE INTO eywa_email_outbox(id,recipient,payload_json,created_at,kind) VALUES(?,?,?,?,?)").run(id,to,JSON.stringify(payload),Date.now(),kind);},deliver:async id=>{DB.raw.prepare("UPDATE eywa_email_outbox SET status='sent' WHERE id=?").run(id);}};}
const link=(html,label)=>{const m=html.match(new RegExp('href="([^"]+)"[^>]*>'+label));return m&&m[1].replace(/&amp;/g,'&');};
test('Meetings: invitee proposes a new slot, EYWA accepts, a new invitation goes out',async()=>{
 const DB=crmDatabase(),log=[],mailer=mailerFor(DB,log),e=env(DB);try{
  DB.raw.prepare("INSERT OR REPLACE INTO eywa_crm_settings(id,data_json) VALUES(1,?)").run(JSON.stringify({meetUrl:'https://meet.google.com/abc-defg-hij'}));
  const pr=createProspects(e,{mailer}),mt=createMeetings(e,{mailer});
  const {id}=await pr.mutate('prospect',{name:'Personne Fictive',email:'prospect@example.com',source:'linkedin',status:'repondu'});
  await pr.mutate('prospect-meeting',{prospectId:id,date:'2099-01-05',time:'14:30',minutes:30});
  const inv=log[0].payload.html,change=new URL(link(inv,'Proposer un autre créneau')),ics=new URL(link(inv,'Apple Calendrier'));
  let r=await mt.publicRoute(new Request(ics),ics);assert.equal(r.status,200);const body=await r.text();assert.match(body,/DTSTART:20990105T133000Z/);assert.match(body,/meet\.google\.com/);
  const bad=new URL(ics);bad.searchParams.set('t','x'.repeat(32));assert.equal((await mt.publicRoute(new Request(bad),bad)).status,404);
  r=await mt.publicRoute(new Request(change),change);assert.equal(r.status,200);assert.match(await r.text(),/Proposer un autre créneau/);
  const post=async(path,data)=>{const u=new URL('https://w.example'+path);return mt.publicRoute(new Request(u,{method:'POST',body:new URLSearchParams(data)}),u);};
  r=await post('/visio',{m:change.searchParams.get('m'),t:change.searchParams.get('t'),d:'2099-01-06',h:'10:00',msg:'Plutôt le matin'});assert.match(await r.text(),/Merci/);
  const req=log.find(x=>x.id.startsWith('reschedule:'));assert.equal(req.to,'contact.eywa08@gmail.com');assert.match(req.payload.html,/Plutôt le matin/);
  const accept=new URL(link(req.payload.html,'Accepter ce créneau'));
  r=await mt.publicRoute(new Request(accept),accept);assert.match(await r.text(),/Accepter ce créneau \?/);
  assert.equal(log.filter(x=>x.id.startsWith('invite:')).length,2);
  r=await post('/visio-decision',Object.fromEntries(accept.searchParams));assert.match(await r.text(),/C’est fait/);
  const invites=log.filter(x=>x.id.startsWith('invite:')&&!x.id.endsWith(':copie'));assert.equal(invites.length,2);assert.match(invites[1].payload.subject,/^Nouveau créneau/);assert.match(invites[1].payload.html,/déplacé/);
  r=await post('/visio-decision',Object.fromEntries(accept.searchParams));assert.match(await r.text(),/Déjà traité/);
  r=await mt.publicRoute(new Request(change),change);assert.match(await r.text(),/déjà été déplacé/);
  const rows=DB.raw.prepare('SELECT status FROM eywa_crm_meetings ORDER BY start_at').all().map(x=>x.status);assert.deepEqual(rows,['replaced','scheduled']);
  const d=await pr.details(id);assert.equal(d.next_action_date,'2099-01-06');assert(d.events.some(x=>/déplacé/.test(x.summary)));
 }finally{DB.raw.close();}
});
test('Meetings: EYWA declines, the invitee is told and the original slot stays',async()=>{
 const DB=crmDatabase(),log=[],mailer=mailerFor(DB,log),e=env(DB);try{
  DB.raw.prepare("INSERT OR REPLACE INTO eywa_crm_settings(id,data_json) VALUES(1,?)").run(JSON.stringify({meetUrl:'https://meet.google.com/abc-defg-hij'}));
  const pr=createProspects(e,{mailer}),mt=createMeetings(e,{mailer});
  const {id}=await pr.mutate('prospect',{name:'Autre Fictive',email:'autre@example.com',source:'mail',status:'contacte'});
  await pr.mutate('prospect-meeting',{prospectId:id,date:'2099-02-05',time:'09:00',minutes:45});
  const change=new URL(link(log[0].payload.html,'Proposer un autre créneau'));
  const post=async(path,data)=>{const u=new URL('https://w.example'+path);return mt.publicRoute(new Request(u,{method:'POST',body:new URLSearchParams(data)}),u);};
  assert.match(await (await post('/visio',{m:change.searchParams.get('m'),t:change.searchParams.get('t'),d:'2020-01-01',h:'10:00'})).text(),/trop proche/);
  assert.match(await (await post('/visio',{m:change.searchParams.get('m'),t:'faux',d:'2099-02-06',h:'10:00'})).text(),/invalide/);
  await post('/visio',{m:change.searchParams.get('m'),t:change.searchParams.get('t'),d:'2099-02-06',h:'11:00'});
  const decline=new URL(link(log.find(x=>x.id.startsWith('reschedule:')).payload.html,'Refuser'));
  const forged=Object.fromEntries(decline.searchParams);forged.a='accept';assert.match(await (await post('/visio-decision',forged)).text(),/invalide/);
  assert.match(await (await post('/visio-decision',Object.fromEntries(decline.searchParams))).text(),/C’est noté/);
  const told=log.find(x=>x.id.startsWith('declined:'));assert.equal(told.to,'autre@example.com');assert.match(told.payload.html,/reste valable/);
  assert.deepEqual(DB.raw.prepare('SELECT status FROM eywa_crm_meetings').all().map(x=>x.status),['scheduled']);
 }finally{DB.raw.close();}
});
