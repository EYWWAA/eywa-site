// Aperçu local isolé. Aucune connexion aux services de production, aucun e-mail.
import http from 'node:http';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash} from 'node:crypto';
import {crmHTTP} from '../src/lib/crm-http.mjs';
import {createCRM} from '../src/lib/crm.mjs';
import {registerQuote} from '../src/lib/followups.mjs';
import {createCalendar,readCalendar} from '../src/lib/crm-calendar.mjs';
const raw=new DatabaseSync(':memory:');
for(const f of ['0001_launch_slots.sql','0002_booking_calendar.sql','0003_transactional_email.sql','0004_automation.sql','0006_balance_invoices.sql','0007_crm.sql','0008_suppliers.sql','0009_quote_tracking.sql','0010_external_calendar.sql'])raw.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
const DB={prepare(s){return{bind(...args){const q=raw.prepare(s);return{first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),run:async()=>q.run(...args),_run:()=>q.run(...args)}}}},async batch(rows){raw.exec('BEGIN IMMEDIATE');try{const result=rows.map(r=>({meta:r._run()}));raw.exec('COMMIT');return result;}catch(e){raw.exec('ROLLBACK');throw e;}}};
const env={DB,EYWA_AUTOMATION_ENABLED:'false'},crm=createCRM(env);
const now=new Date(),date=(n)=>new Date(now.getFullYear(),now.getMonth(),now.getDate()+n,12).toLocaleDateString('sv-SE');
const sampleQuote={id:'10000000-0000-4000-8000-000000000099',reference:'EYWA-APERÇU',name:'Camille Martin · Aperçu',firstName:'Camille',email:'demo@example.invalid',phone:'+33612345678',company:'Maison Atelier',date:date(20),time:'10:00',hours:3,days:1,guests:100,eventType:'Événement d’entreprise',location:'Lieu fictif à Charleville-Mézières',options:['Gobelets sur mesure','Habillage du bar'],totalCents:70000,quoteUrl:'https://eywacoffeecatering.com/devis.html',details:'Exemple fictif : accueil de nos partenaires autour d’un café.'};
raw.prepare('INSERT INTO eywa_quotes VALUES(?,?,?,?)').run(sampleQuote.id,'local-preview',JSON.stringify(sampleQuote),Date.now());
await registerQuote(env,sampleQuote);
for(const [n,name,type,guests,hours]of [[5,'Maison Atelier · Démonstration','Événement d’entreprise',80,3],[12,'Alice et Thomas · Démonstration','Mariage',100,4],[19,'Anniversaire · Démonstration','Événement privé',50,2]]){
 const {id}=await crm.mutate('manual-event',{name,email:'demo@example.invalid',date:date(n),time:'10:00',hours,days:1,guests,eventType:type,location:'Lieu fictif à Charleville-Mézières'});
 const task=raw.prepare('SELECT id FROM eywa_crm_tasks WHERE event_id=? LIMIT 1').get(id);await crm.mutate('task',{id:task.id,done:true});
 if(n===5)raw.prepare("UPDATE eywa_crm_events SET data_json=json_set(data_json,'$.options',json(?)) WHERE id=?").run('["Gobelets sur mesure","Habillage du bar"]',id);
}
await createCalendar(env).replace(readCalendar('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:calendar-fixture\r\nSUMMARY:EYWA - Déjeuner partenaire · Aperçu\r\nDTSTART;TZID=Europe/Paris:'+date(10).replaceAll('-','')+'T120000\r\nDTEND;TZID=Europe/Paris:'+date(10).replaceAll('-','')+'T140000\r\nLOCATION:Lieu fictif\r\nDESCRIPTION:Horaire provisoire. À confirmer avec le client.\r\nEND:VEVENT\r\nEND:VCALENDAR'));
const server=http.createServer(async(req,res)=>{
 try{
  const url='http://127.0.0.1:8157'+req.url;
  if(req.url==='/preview-login'){
   const token=randomBytes(32).toString('hex');raw.prepare('INSERT INTO eywa_crm_sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),'local-preview-csrf',Date.now()+3600000);
   res.writeHead(302,{'Location':'/espace/','Set-Cookie':'__Host-eywa_session='+token+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600'});res.end();return;
  }
  const chunks=[];for await(const c of req)chunks.push(c);
  const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
  const out=await crmHTTP(request,env,{waitUntil:()=>{}});
  res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));
 }catch(e){res.writeHead(500);res.end('Erreur dans l’aperçu local : '+e.message);}
});
server.listen(8157,'127.0.0.1',()=>console.log('Aperçu local : http://127.0.0.1:8157/preview-login (données fictives uniquement)'));
