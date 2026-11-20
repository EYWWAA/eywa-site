// Aperçu local isolé. Aucune connexion aux services de production, aucun e-mail.
import http from 'node:http';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash} from 'node:crypto';
import {crmHTTP} from '../src/lib/crm-http.mjs';
import {createCRM} from '../src/lib/crm.mjs';
const raw=new DatabaseSync(':memory:');
for(const f of ['0001_launch_slots.sql','0002_booking_calendar.sql','0003_transactional_email.sql','0004_automation.sql','0006_balance_invoices.sql','0007_crm.sql'])raw.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
const DB={prepare(s){return{bind(...args){const q=raw.prepare(s);return{first:async()=>q.get(...args)||null,all:async()=>({results:q.all(...args)}),run:async()=>q.run(...args),_run:()=>q.run(...args)}}}},async batch(rows){raw.exec('BEGIN IMMEDIATE');try{const result=rows.map(r=>({meta:r._run()}));raw.exec('COMMIT');return result;}catch(e){raw.exec('ROLLBACK');throw e;}}};
const env={DB,EYWA_AUTOMATION_ENABLED:'false'},crm=createCRM(env);
const now=new Date(),date=(n)=>new Date(now.getFullYear(),now.getMonth(),now.getDate()+n,12).toLocaleDateString('sv-SE');
for(const [n,name,type,guests,hours]of [[5,'Maison Atelier · Démonstration','Événement d’entreprise',80,3],[12,'Alice et Thomas · Démonstration','Mariage',100,4],[19,'Anniversaire · Démonstration','Événement privé',50,2]]){
 const {id}=await crm.mutate('manual-event',{name,email:'demo@example.invalid',date:date(n),time:'10:00',hours,days:1,guests,eventType:type,location:'Lieu fictif à Charleville-Mézières'});
 const task=raw.prepare('SELECT id FROM eywa_crm_tasks WHERE event_id=? LIMIT 1').get(id);await crm.mutate('task',{id:task.id,done:true});
}
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
