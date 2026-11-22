import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crmDatabase} from './crm.test.mjs';
import {createProspects} from '../src/lib/crm-prospects.mjs';
const env=DB=>({DB,EYWA_AUTOMATION_ENABLED:'true',EYWA_GMAIL_ARCHIVE_ENABLED:'true',EYWA_MAIL_RELAY_URL:'https://relay.example/exec',EYWA_MAIL_RELAY_SECRET:'local-test-only'});
const base={name:'Personne fictive',company:'Société fictive',role:'Marketing',email:'prospect@example.com',phone:'06 12 34 56 78',linkedinUrl:'https://www.linkedin.com/in/fictif/',source:'linkedin',status:'a-contacter',nextActionDate:'2027-01-05',notes:''};

test('Prospects: create, edit, validate and log LinkedIn exchanges',async()=>{
 const DB=crmDatabase(),p=createProspects(env(DB));try{
  const {id}=await p.mutate('prospect',base);
  await assert.rejects(()=>p.mutate('prospect',{...base}),/déjà/);
  await assert.rejects(()=>p.mutate('prospect',{...base,email:'x@y.z',linkedinUrl:'https://evil.example/in/x'}),/LinkedIn/);
  await assert.rejects(()=>p.mutate('prospect',{...base,email:'nope'}),/invalide/);
  await assert.rejects(()=>p.mutate('prospect',{...base,email:'',status:'bidon'}),/Statut/);
  await p.mutate('prospect-log',{prospectId:id,kind:'linkedin',date:'2026-11-20',summary:'Message envoyé après l’ajout',nextActionDate:'2026-11-24'});
  await assert.rejects(()=>p.mutate('prospect-log',{prospectId:id,kind:'mail_in',summary:'x'}),/invalide/);
  let d=await p.details(id);assert.equal(d.status,'contacte');assert.equal(d.next_action_date,'2026-11-24');assert.equal(d.events.length,1);
  await p.mutate('prospect',{...base,id,status:'rdv',company:'Autre'});d=await p.details(id);assert.equal(d.status,'rdv');assert.equal(d.company,'Autre');
  const list=await p.list();assert.equal(list.length,1);assert.equal(list[0].exchanges,1);assert(list[0].last_contact_at);
  await p.mutate('prospect-log-delete',{id:d.events[0].id});assert.equal((await p.details(id)).events.length,0);
 }finally{DB.raw.close();}
});

test('Prospects: Gmail exchanges are imported once, inbound mail marks a reply',async()=>{
 const DB=crmDatabase(),p=createProspects(env(DB));try{
  const {id}=await p.mutate('prospect',{...base,status:'contacte'});
  let calls=0;const fetcher=async(url,o)=>{calls++;const b=JSON.parse(o.body);assert.equal(b.email,'prospect@example.com');assert.equal(b.action,'messages');return new Response(JSON.stringify({ok:true,messages:[{id:'aa11',at:Date.now()-86400000,from:'EYWA <contacteywa08@gmail.com>',subject:'Bar à café',text:'Bonjour'},{id:'bb22',at:Date.now()-3600000,from:'Personne <prospect@example.com>',subject:'Re: Bar à café',text:'Avec plaisir'},{id:'not-hex!',at:Date.now(),from:'x'}]}));};
  assert.equal(await p.syncMail(fetcher),2);
  let d=await p.details(id);assert.deepEqual(d.events.map(e=>e.kind).sort(),['mail_in','mail_out']);assert.equal(d.status,'repondu');
  DB.raw.prepare('UPDATE eywa_crm_prospects SET mail_scanned_at=0').run();
  await p.syncMail(fetcher);assert.equal((await p.details(id)).events.length,2);
  await assert.rejects(()=>p.mutate('prospect-log-delete',{id:d.events[0].id}),/introuvable/);
  assert.equal(await createProspects({...env(DB),EYWA_GMAIL_ARCHIVE_ENABLED:'false'}).syncMail(fetcher),0);
 }finally{DB.raw.close();}
});

test('Prospects: Google Meet invitation goes through the relay once and books a meeting',async()=>{
 const DB=crmDatabase();let sent=[];
 const fetcher=async(url,o)=>{const b=JSON.parse(o.body);sent.push(b);return new Response(JSON.stringify(b.action==='meeting'?{ok:true,meetUrl:'https://meet.google.com/abc-defg-hij'}:{ok:false}));};
 const p=createProspects(env(DB),{fetcher});try{
  const {id}=await p.mutate('prospect',{...base,email:'',status:'repondu'});
  await assert.rejects(()=>p.mutate('prospect-meeting',{prospectId:id,date:'2099-01-05',time:'14:30',minutes:30}),/e-mail/);
  await p.mutate('prospect',{...base,id,status:'repondu'});
  await assert.rejects(()=>p.mutate('prospect-meeting',{prospectId:id,date:'2020-01-05',time:'14:30',minutes:30}),/passée/);
  await assert.rejects(()=>p.mutate('prospect-meeting',{prospectId:id,date:'2099-01-05',time:'25:00',minutes:30}),/heure/);
  await assert.rejects(()=>p.mutate('prospect-meeting',{prospectId:id,date:'2099-01-05',time:'14:30',minutes:7}),/Durée/);
  const r=await p.mutate('prospect-meeting',{prospectId:id,date:'2099-01-05',time:'14:30',minutes:30,title:'Bar à café pour vos portes ouvertes',message:'À très vite'});
  assert.equal(r.meetUrl,'https://meet.google.com/abc-defg-hij');
  assert.equal(sent.at(-1).to,'prospect@example.com');assert.equal(sent.at(-1).start,'2099-01-05T14:30');assert.equal(sent.at(-1).action,'meeting');
  const d=await p.details(id);assert.equal(d.status,'rdv');assert.equal(d.next_action_date,'2099-01-05');assert.equal(d.events[0].kind,'meeting');assert(d.events[0].body.includes('meet.google.com'));
  await p.mutate('prospect-meeting',{prospectId:id,date:'2099-01-05',time:'14:30',minutes:30});assert.equal((await p.details(id)).events.length,1);
  const down=createProspects(env(DB),{fetcher:async()=>new Response(JSON.stringify({ok:false}))});
  await assert.rejects(()=>down.mutate('prospect-meeting',{prospectId:id,date:'2099-02-05',time:'10:00',minutes:30}),/agenda Google/);
 }finally{DB.raw.close();}
});
