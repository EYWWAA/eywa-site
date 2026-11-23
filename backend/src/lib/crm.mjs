import {randomUUID} from 'node:crypto';
import policy from './booking-policy.cjs';
import {escape,safeURL} from './mail-templates.mjs';
import {createOrders} from './crm-orders.mjs';
import {createProspects} from './crm-prospects.mjs';
import {createNotebook} from './crm-notebook.mjs';
import {createChecklists} from './crm-checklists.mjs';
import {createMailer} from './mail-delivery.mjs';
import {createCorrespondence} from './crm-correspondence.mjs';
import {createCalendar} from './crm-calendar.mjs';
export const defaultSettings={loadingMinutes:30,setupMinutes:60,cleanupMinutes:45,travelMinutes:30,reviewEnabled:true,reviewUrl:'https://search.google.com/local/writereview?placeid=ChIJzVp-mvUAbgUR1IO2D4738BY',reviewDelayDays:1,meetUrl:''};
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const parse=s=>{try{return JSON.parse(s||'{}');}catch{return {};}};
const text=(v,max=1000)=>String(v??'').trim().slice(0,max);
const day=ms=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date(ms));
const errorConflict=()=>fail('Ce créneau est déjà occupé. Vérifiez le calendrier et les affectations.',409);
export function parisTime(date,time){
 if(!policy.validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||''))fail('Date ou heure invalide.');
 const target=Date.parse(date+'T'+time+':00Z');let stamp=target;
 const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 for(let n=0;n<3;n++){const p=Object.fromEntries(fmt.formatToParts(new Date(stamp)).map(x=>[x.type,x.value]));const local=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':00Z');stamp+=target-local;}
 if(fmt.format(new Date(stamp)).replace(',','').replace(/\s+/g,' ')!==date+' '+time)fail('Cette heure n’existe pas au changement d’heure.');
 return stamp;
}
export function eventTimeline(q,settings=defaultSettings,overrides={}){
 const value=k=>{const n=Number(overrides[k]??settings[k]);if(!Number.isInteger(n)||n<0||n>2880)fail('Les durées de préparation et de trajet doivent être entre 0 et 2880 minutes.');return n;};
 const hours=Number(q.hours||1.5),days=Number(q.days||1);if(!Number.isFinite(hours)||hours<=0||hours>24||!Number.isInteger(days)||days<1||days>365)fail('Durée de service invalide.');
 const loadingMinutes=value('loadingMinutes'),setupMinutes=value('setupMinutes'),cleanupMinutes=value('cleanupMinutes'),travelMinutes=value('travelMinutes');
 const serviceStart=parisTime(q.date,q.time||'10:00'),serviceEnd=parisTime(policy.addDays(q.date,days-1),q.time||'10:00')+Math.round(hours*3600000);
 return {loadingMinutes,setupMinutes,cleanupMinutes,travelMinutes,serviceStart,serviceEnd,startsAt:serviceStart-(loadingMinutes+setupMinutes+travelMinutes)*60000,endsAt:serviceEnd+(cleanupMinutes+travelMinutes+loadingMinutes)*60000};
}
export function taskTemplates(q){
 // Les tâches de base viennent de la checklist admin par défaut ; ici, seulement celles liées aux options.
 const out=[];
 const options=Array.isArray(q.options)?q.options:[];
 if(options.includes('Gobelets sur mesure'))out.push(['cups','Commander les gobelets imprimés',-21]);
 if(options.includes('Gobelets avec stickers'))out.push(['stickers','Préparer les stickers des gobelets',-14]);
 if(options.includes('Habillage du bar'))out.push(['bar','Valider et commander l’habillage du bar',-21]);
 if(options.some(x=>/Gobelets|Habillage|Logo/.test(x)))out.push(['artwork','Récupérer et valider les fichiers de personnalisation',-22]);
 if(options.includes('Logo sur les boissons'))out.push(['printer','Préparer et tester l’imprimante',-1]);
 return out.map(([key,title,delta])=>({key,title,dueDate:policy.addDays(q.date,delta)}));
}
export async function occupiedTimelineDays(env,q,calculated){
 const settings={...defaultSettings,...parse((await env.DB.prepare('SELECT data_json FROM eywa_crm_settings WHERE id=1').bind().first())?.data_json)};
 const minutes=calculated.trip?.outwardMinutes;
 const t=eventTimeline({date:q.d,time:q.ti,hours:q.h,days:q.dy||1},settings,Number.isFinite(minutes)&&minutes>0?{travelMinutes:Math.ceil(minutes)}:{});
 const from=day(t.startsAt),to=day(t.endsAt-1),dates=[];
 for(let d=from;d<=to;d=policy.addDays(d,1))dates.push(d);
 return [...new Set([...dates,...calculated.dates])].sort();
}
export function createCRM(env){
 const checklists=createChecklists(env),notebook=createNotebook(env),prospecting=createProspects(env,{mailer:createMailer(env)}),procurement=createOrders(env),correspondence=createCorrespondence(env),calendar=createCalendar(env);
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 async function settings(){return {...defaultSettings,...parse((await sql('SELECT data_json FROM eywa_crm_settings WHERE id=1').first())?.data_json)};}
 async function event(id){const row=await sql('SELECT * FROM eywa_crm_events WHERE id=?',id).first();if(!row)fail('Événement introuvable.',404);return {...row,data:parse(row.data_json)};}
 async function tasks(id,q,now){await checklists.applyDefaults(id,q.date,now);const extra=taskTemplates(q);if(extra.length)await env.DB.batch(extra.map(t=>sql('INSERT INTO eywa_crm_tasks(id,event_id,title,due_date,created_at) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING',id+':'+t.key,id,t.title,t.dueDate,now)));}
 async function sync(now=Date.now()){
  const config=await settings();
  // Lecture des réservations réglées uniquement. Aucun paiement ni facture n’est créé ici.
  const rows=(await sql("SELECT b.*,q.data_json AS quote_json FROM eywa_bookings b LEFT JOIN eywa_quotes q ON q.id=json_extract(b.details_json,'$.quoteId') WHERE b.state='paid' AND NOT EXISTS(SELECT 1 FROM eywa_crm_events e WHERE e.booking_id=b.id) ORDER BY b.created_at DESC LIMIT 20").all()).results;
  for(const b of rows){
   const details=parse(b.details_json),q={...parse(b.quote_json),...details.eventSummary};
   const data={reference:q.reference||'EYWA-'+b.id.slice(0,8).toUpperCase(),name:q.name||details.contactName||'Client',email:q.email||'',phone:q.phone||details.phone||'',company:q.company||'',date:q.date||b.start_date,time:q.time||'10:00',hours:Number(q.hours)||1.5,days:Number(q.days)||1,guests:Number(q.guests)||0,eventType:q.eventType||'Événement',location:details.address||q.location||'',options:q.options||[],notes:'',bookingDetails:{contactName:details.contactName,setupLocation:details.setupLocation,unloadParking:details.unloadParking,eventParking:details.eventParking,outdoor:details.outdoor,dressCode:details.dressCode,dressDetails:details.dressDetails,power220:details.power220},timelineSource:'À vérifier : trajet estimé manuellement'};
   data.staff=Number(q.staff)||Math.max(1,Math.ceil(data.guests/(data.hours*50)));
   data.quoteUrl=q.quoteUrl;
   const estimated=Number(q.travelMinutes);
   let timeline;try{timeline=eventTimeline(data,config,Number.isFinite(estimated)&&estimated>=0?{travelMinutes:Math.ceil(estimated)}:{});}catch{continue;}
   const id='booking-'+b.id;
   await sql('INSERT INTO eywa_crm_events(id,quote_id,booking_id,data_json,starts_at,ends_at,created_at,review_eligible,review_state) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',id,details.quoteId||null,b.id,JSON.stringify({...data,timeline}),timeline.startsAt,timeline.endsAt,now,timeline.serviceEnd>now?1:0,timeline.serviceEnd>now?'ready':'off').run();
   await tasks(id,data,now);
   // Les dates de service sont déjà occupées par la réservation d’origine.
   // Les marges de trajet restent à valider avant d’étendre le blocage.
   await sql('INSERT INTO eywa_crm_blocks(id,from_date,to_date,label,event_id) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING','event:'+id,b.start_date,b.end_date,data.name,id).run();
  }
 }
 async function overview(){
  const [eventRows,quotes,taskRows,resources,assignments,blocks,errors,config,finances]=await Promise.all([
   sql('SELECT * FROM eywa_crm_events ORDER BY starts_at DESC LIMIT 1500').all(),
   sql('SELECT q.id,q.data_json,q.created_at,s.status AS state,t.stage,t.next_action_date FROM eywa_quotes q LEFT JOIN eywa_quote_state s ON s.quote_id=q.id LEFT JOIN eywa_crm_quote_tracking t ON t.quote_id=q.id ORDER BY q.created_at DESC LIMIT 1500').all(),
   sql('SELECT * FROM eywa_crm_tasks ORDER BY due_date,title LIMIT 5000').all(),
   sql('SELECT * FROM eywa_crm_resources ORDER BY kind,name').all(),sql('SELECT * FROM eywa_crm_assignments').all(),sql('SELECT * FROM eywa_crm_blocks ORDER BY from_date').all(),
   sql("SELECT id,kind,quote_id,attempts,last_error,next_attempt FROM eywa_email_outbox WHERE status='pending' AND attempts>0 ORDER BY created_at DESC LIMIT 20").all(),settings(),
   sql("SELECT i.quote_id,json_extract(i.data_json,'$.name') AS name,json_extract(i.data_json,'$.email') AS email,json_extract(i.data_json,'$.balanceCents') AS balance_cents,json_extract(i.data_json,'$.paidCents') AS paid_cents,EXISTS(SELECT 1 FROM eywa_invoices s JOIN eywa_balance_payments p ON p.token=s.token WHERE s.session_id='balance:'||i.session_id) AS settled FROM eywa_invoices i WHERE json_extract(i.data_json,'$.kind') IS NULL").all()
  ]);
  const events=eventRows.results.map(e=>({...e,data_json:undefined,data:parse(e.data_json)}));
  const dossiers=quotes.results.map(r=>{const q=parse(r.data_json);return {id:r.id,createdAt:r.created_at,state:r.state||'open',stage:r.stage||'new',nextActionDate:r.next_action_date,reference:q.reference,name:q.name,email:q.email,phone:q.phone,company:q.company,eventType:q.eventType,date:q.date,time:q.time,hours:q.hours,days:q.days,guests:q.guests,location:q.location,options:q.options,totalCents:q.totalCents,quoteUrl:q.quoteUrl};});
  return {calendar:await calendar.status(),externalEvents:await calendar.events(),events,quotes:dossiers,tasks:taskRows.results,resources:resources.results,assignments:assignments.results,blocks:blocks.results,errors:errors.results,settings:config,finances:finances.results,suppliers:await procurement.suppliers(),prospects:await prospecting.list(),notes:await notebook.list(),checklists:await checklists.library(),briefItems:(await sql('SELECT event_id,done FROM eywa_crm_brief_items').all()).results,now:Date.now(),limited:eventRows.results.length===1500||quotes.results.length===1500};
 }
 async function details(id){
  if(id.startsWith('calendar-'))return calendar.details(id);
  const saved=id.startsWith('quote-')?await sql('SELECT id,data_json FROM eywa_quotes WHERE id=?',id.slice(6)).first():null;
  if(id.startsWith('quote-')&&!saved)fail('Devis introuvable.',404);
  const e=saved?{id,quote_id:saved.id,data:parse(saved.data_json),quoteOnly:true}:await event(id),qid=e.quote_id;
  const [invoices,messages,received]=qid?await Promise.all([
   sql('SELECT seq,token,data_json,created_at FROM eywa_invoices WHERE quote_id=? ORDER BY seq',qid).all(),
   sql("SELECT id,payload_json,status,kind,created_at,sent_at,last_error FROM eywa_email_outbox WHERE quote_id=? ORDER BY created_at DESC LIMIT 100",qid).all(),
   sql('SELECT data_json,created_at FROM eywa_sync_events WHERE quote_id=? ORDER BY created_at DESC LIMIT 100',qid).all()
  ]):[{results:[]},{results:[]},{results:[]}];
  const source=qid?parse((await sql('SELECT data_json FROM eywa_quotes WHERE id=?',qid).first())?.data_json):{};
  const booking=e.booking_id?parse((await sql('SELECT details_json FROM eywa_bookings WHERE id=?',e.booking_id).first())?.details_json):{};
  return {...e,brief:e.quoteOnly?[]:await checklists.brief(e.id),originalQuote:source,correspondence:qid?await correspondence.details(qid):null,clientMessage:source.details||'',referencePhoto:booking.referencePhoto||'',procurement:e.quoteOnly?null:await procurement.details(e.id),invoices:invoices.results.map(i=>({seq:i.seq,token:i.token,createdAt:i.created_at,data:parse(i.data_json)})),messages:[...messages.results.map(m=>({id:m.id,status:m.status,kind:m.kind,at:m.sent_at||m.created_at,subject:parse(m.payload_json).subject,text:parse(m.payload_json).text,lastError:m.last_error})),...received.results.map(m=>{const data=parse(m.data_json);return {...data,at:m.created_at,status:!data.from?'archived':/(?:^|[<\s])contact\.eywa08@gmail\.com(?:$|[>\s])/i.test(data.from)?'sent':'received'};})].sort((a,b)=>b.at-a.at)};
 }
 async function audit(action,id){await sql('INSERT INTO eywa_crm_audit(action,entity,at) VALUES(?,?,?)',action,id,Date.now()).run();}
 async function mutate(action,b,now=Date.now()){
  if(action==='supplier'||action==='order')return procurement.mutate(action,b,now);
  if(String(action).startsWith('prospect'))return prospecting.mutate(action,b,now);
  if(String(action).startsWith('note'))return notebook.mutate(action,b,now);
  if(String(action).startsWith('checklist')||['brief-item','event-checklist-replace','task-delete'].includes(action))return checklists.mutate(action,b,now);
  if(action==='settings'){
   const current=await settings(),next={...current};
   for(const key of ['loadingMinutes','setupMinutes','cleanupMinutes','travelMinutes']){const n=Number(b[key]);if(!Number.isInteger(n)||n<0||n>2880)fail('Durée invalide.');next[key]=n;}
   next.reviewEnabled=b.reviewEnabled===true;next.reviewDelayDays=Number(b.reviewDelayDays);if(!Number.isInteger(next.reviewDelayDays)||next.reviewDelayDays<1||next.reviewDelayDays>30)fail('Délai d’avis invalide.');
   const u=new URL(String(b.reviewUrl||current.reviewUrl));if(u.protocol!=='https:'||!['search.google.com','g.page','www.google.com','maps.app.goo.gl'].includes(u.hostname))fail('Utilisez le lien officiel de votre fiche Google.');next.reviewUrl=u.href;
   const meet=String(b.meetUrl??current.meetUrl??'').trim();if(meet){let m;try{m=new URL(meet);}catch{fail('Lien Google Meet invalide.');}if(m.protocol!=='https:'||m.hostname!=='meet.google.com'||!/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(m.pathname))fail('Collez un lien Google Meet du type https://meet.google.com/abc-defg-hij.');next.meetUrl='https://meet.google.com'+m.pathname;}else next.meetUrl='';
   await sql('UPDATE eywa_crm_settings SET data_json=? WHERE id=1',JSON.stringify(next)).run();await audit(action,'settings');return {ok:true};
  }
  if(action==='task'){
   if(typeof b.done!=='boolean')fail('État de tâche invalide.');
   const row=await sql('UPDATE eywa_crm_tasks SET done=?,completed_at=? WHERE id=? RETURNING id',b.done?1:0,b.done?now:null,text(b.id,150)).first();if(!row)fail('Tâche introuvable.',404);await audit(action,row.id);return {ok:true};
  }
  if(action==='add-task'){
   await event(b.eventId);if(!text(b.title,250)||!policy.validDate(b.dueDate))fail('Complétez la tâche et son échéance.');
   await sql('INSERT INTO eywa_crm_tasks(id,event_id,title,due_date,created_at) VALUES(?,?,?,?,?)',randomUUID(),b.eventId,text(b.title,250),b.dueDate,now).run();await audit(action,b.eventId);return {ok:true};
  }
  if(action==='resource'){
   if(!['staff','equipment'].includes(b.kind)||!text(b.name,100)||!Number.isInteger(Number(b.quantity))||Number(b.quantity)<1||Number(b.quantity)>100)fail('Complétez le nom et la quantité.');
   const id=b.id?text(b.id,100):randomUUID(),quantity=Number(b.quantity),active=b.active===false?0:1;
   // Une réduction de capacité doit respecter le pic de réservations existantes, pas leur somme.
   const used=(await sql('SELECT starts_at,ends_at,quantity FROM eywa_crm_assignments WHERE resource_id=? AND ends_at>?',id,now).all()).results;
   for(const a of used){const peak=used.filter(x=>x.starts_at<=a.starts_at&&x.ends_at>a.starts_at).reduce((s,x)=>s+x.quantity,0);if(peak>quantity||!active)fail('Cette ressource est affectée à des événements à venir.',409);}
   await sql('INSERT INTO eywa_crm_resources(id,kind,name,quantity,notes,active) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,quantity=excluded.quantity,notes=excluded.notes,active=excluded.active',id,b.kind,text(b.name,100),quantity,text(b.notes,1000),active).run();await audit(action,id);return {ok:true};
  }
  if(action==='assign'){
   const e=await event(b.eventId);if(e.status==='cancelled')fail('Événement annulé.');const qty=Number(b.quantity);if(!Number.isInteger(qty)||qty<0||qty>100)fail('Quantité invalide.');
   if(qty===0){await sql('DELETE FROM eywa_crm_assignments WHERE event_id=? AND resource_id=?',e.id,b.resourceId).run();return {ok:true};}
   // Vérification atomique et conservatrice de toutes les affectations qui chevauchent ce créneau.
   const row=await sql('INSERT INTO eywa_crm_assignments(event_id,resource_id,quantity,starts_at,ends_at) SELECT ?,id,?,?,? FROM eywa_crm_resources r WHERE id=? AND active=1 AND quantity>=?+COALESCE((SELECT SUM(a.quantity) FROM eywa_crm_assignments a WHERE a.resource_id=r.id AND a.event_id<>? AND a.starts_at<? AND a.ends_at>?),0) ON CONFLICT(event_id,resource_id) DO UPDATE SET quantity=excluded.quantity,starts_at=excluded.starts_at,ends_at=excluded.ends_at RETURNING event_id',e.id,qty,e.starts_at,e.ends_at,b.resourceId,qty,e.id,e.ends_at,e.starts_at).first();if(!row)fail('Ressource indisponible sur ce créneau.',409);await audit(action,e.id);return {ok:true};
  }
  if(action==='block'){
   if(!policy.validDate(b.from)||!policy.validDate(b.to)||b.to<b.from||b.to>policy.addDays(b.from,365)||!text(b.label,150))fail('Période de blocage invalide.');
   const occupied=await sql("SELECT id FROM eywa_crm_events WHERE status<>'cancelled' AND starts_at<? AND ends_at>? LIMIT 1",parisTime(policy.addDays(b.to,1),'00:00'),parisTime(b.from,'00:00')).first();if(occupied)errorConflict();
   try{await sql('INSERT INTO eywa_crm_blocks(id,from_date,to_date,label) VALUES(?,?,?,?)',randomUUID(),b.from,b.to,text(b.label,150)).run();}catch{errorConflict();}await audit(action,b.from);return {ok:true};
  }
  if(action==='unblock'){await sql('DELETE FROM eywa_crm_blocks WHERE id=? AND event_id IS NULL',text(b.id,100)).run();await audit(action,b.id);return {ok:true};}
  if(action==='event'||action==='manual-event'){
   const old=action==='event'?await event(b.id):null,config=await settings();
   const data=old?{...old.data,notes:text(b.notes,10000)}:{name:text(b.name,150),email:text(b.email,254),phone:text(b.phone,60),company:text(b.company,200),date:b.date,time:b.time,hours:Number(b.hours),days:Number(b.days||1),guests:Number(b.guests||0),eventType:text(b.eventType,100)||'Événement externe',location:text(b.location,500),options:[],notes:text(b.notes,10000),reference:'EXTERNE-'+randomUUID().slice(0,8).toUpperCase()};
   if(!data.name||!Number.isInteger(data.guests)||data.guests<0||data.guests>100000)fail('Complétez les informations de l’événement.');
   if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))fail('Adresse e-mail invalide.');
   const status=old?(b.status||old.status):'confirmed';if(!['confirmed','completed','cancelled'].includes(status))fail('Statut invalide.');
   if(old?.booking_id&&status==='cancelled')fail('Cette réservation est liée à un paiement. Traitez d’abord l’annulation et le remboursement ; aucun paiement ne peut être annulé ici.',409);
   const timeline=eventTimeline(data,config,b.timeline||old?.data.timeline||{}),id=old?.id||'manual-'+randomUUID();data.timeline=timeline;
   // Le planning ne déplace jamais les dates d’un devis ou d’une facture déjà émis.
   if(status!=='cancelled'){
    const conflict=await sql("SELECT id FROM eywa_crm_events WHERE id<>? AND status<>'cancelled' AND starts_at<? AND ends_at>? LIMIT 1",id,timeline.endsAt,timeline.startsAt).first();if(conflict)errorConflict();
    const blocked=await sql('SELECT id FROM eywa_crm_blocks WHERE event_id IS NULL AND from_date<=? AND to_date>=? LIMIT 1',day(timeline.endsAt-1),day(timeline.startsAt)).first();if(blocked)errorConflict();
   }
   const bookingConflict=await sql('SELECT booking_id FROM eywa_booking_days WHERE day>=? AND day<=? AND booking_id<>? LIMIT 1',day(timeline.startsAt),day(timeline.endsAt-1),old?.booking_id||'').first();if(status!=='cancelled'&&bookingConflict)errorConflict();
   const assignments=(await sql('SELECT resource_id,quantity FROM eywa_crm_assignments WHERE event_id=?',id).all()).results;
   for(const a of assignments){const available=await sql('SELECT id FROM eywa_crm_resources r WHERE id=? AND quantity>=?+COALESCE((SELECT SUM(quantity) FROM eywa_crm_assignments WHERE resource_id=r.id AND event_id<>? AND starts_at<? AND ends_at>?),0)',a.resource_id,a.quantity,id,timeline.endsAt,timeline.startsAt).first();if(!available)errorConflict();}
   const statements=[sql('INSERT INTO eywa_crm_events(id,data_json,status,starts_at,ends_at,created_at,review_eligible,review_state) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,status=excluded.status,starts_at=excluded.starts_at,ends_at=excluded.ends_at',id,JSON.stringify(data),status,timeline.startsAt,timeline.endsAt,now,timeline.serviceEnd>now?1:0,timeline.serviceEnd>now?'ready':'off'),sql('DELETE FROM eywa_crm_blocks WHERE event_id=?',id)];
   if(status!=='cancelled')statements.push(sql('INSERT INTO eywa_crm_blocks(id,from_date,to_date,label,event_id) VALUES(?,?,?,?,?)','event:'+id,day(timeline.startsAt),day(timeline.endsAt-1),data.name,id),sql('UPDATE eywa_crm_assignments SET starts_at=?,ends_at=? WHERE event_id=?',timeline.startsAt,timeline.endsAt,id));else statements.push(sql('DELETE FROM eywa_crm_assignments WHERE event_id=?',id));
   try{await env.DB.batch(statements);}catch{errorConflict();}await tasks(id,data,now);await audit(action,id);return {ok:true,id};
  }
  if(action==='review'){
   const e=await event(b.id);if(e.status==='cancelled'||e.review_state==='sent')fail('Cette demande d’avis ne peut plus être modifiée.',409);
   if(b.enabled!==true)await sql("DELETE FROM eywa_email_outbox WHERE id=? AND status='pending'",'crm-review:'+e.id).run();
   await sql('UPDATE eywa_crm_events SET review_state=? WHERE id=?',b.enabled===true?'ready':'off',e.id).run();await audit(action,e.id);return {ok:true};
  }
  fail('Action inconnue.',404);
 }
 async function reviewQueue(mailer,now=Date.now()){
  const config=await settings();if(!config.reviewEnabled||!safeURL(config.reviewUrl))return;
  // L’événement terminé devient éligible. Les anciens événements importés et
  // les essais restent exclus ; Louis peut suspendre un envoi depuis sa fiche.
  await sql("UPDATE eywa_crm_events SET status='completed' WHERE status='confirmed' AND ends_at<?",now).run();
  const rows=(await sql("SELECT * FROM eywa_crm_events WHERE status='completed' AND review_eligible=1 AND review_state='ready' AND ends_at<? AND ends_at>? ORDER BY ends_at LIMIT 5",now-config.reviewDelayDays*86400000,now-30*86400000).all()).results;
  for(const e of rows){const q=parse(e.data_json);if(!q.email||/(?:test|démonstration|demonstration|essai|technique)/i.test(q.name+' '+q.eventType+' '+q.notes)||['contact.eywa08@gmail.com','louis.lepoulain08@gmail.com'].includes(q.email.toLowerCase()))continue;
   const link=safeURL(config.reviewUrl),subject='Merci pour ce moment partagé avec EYWA';
   await mailer.enqueue('crm-review:'+e.id,q.email,{subject,text:'Bonjour '+q.name+',\n\nMerci d’avoir fait confiance à EYWA pour votre événement. Nous espérons que vous et vos invités avez apprécié ce moment autour du coffee bar.\n\nSi vous souhaitez partager votre expérience, votre avis nous aiderait beaucoup : '+link+'\n\nMerci encore,\nLouis Le Poulain',html:'<div style="font:16px/1.6 Arial;color:#291817;max-width:600px;margin:auto"><h1 style="font:30px Georgia">Merci pour votre confiance.</h1><p>Bonjour '+escape(q.name)+',</p><p>Nous espérons que vous et vos invités avez apprécié ce moment autour du coffee bar.</p><p>Si vous souhaitez partager votre expérience, votre avis nous aiderait beaucoup.</p><p><a href="'+escape(link)+'" style="display:inline-block;padding:14px 24px;background:#be957a;color:#291817;border-radius:8px">Partager mon expérience sur Google</a></p><p>Merci encore,<br>Louis Le Poulain</p></div>'},e.quote_id,'crm-review');
   await sql("UPDATE eywa_crm_events SET review_state='queued' WHERE id=? AND review_state='ready'",e.id).run();
  }
  await sql("UPDATE eywa_crm_events SET review_state='sent' WHERE review_state='queued' AND EXISTS(SELECT 1 FROM eywa_email_outbox WHERE id='crm-review:'||eywa_crm_events.id AND status='sent')").run();
 }
 async function alerts(mailer,now=Date.now()){
  const mails=await sql("SELECT COUNT(*) n FROM eywa_email_outbox WHERE status='pending' AND attempts>=3 AND kind NOT IN ('crm-login','crm-alert')").first();
  const notion=await sql('SELECT COUNT(*) n FROM eywa_notion_jobs WHERE last_error IS NOT NULL AND next_attempt>?',now).first();
  if(!mails.n&&!notion.n)return;
  const id='crm-alert:'+day(now);
  await mailer.enqueue(id,'contact.eywa08@gmail.com',{subject:'EYWA : des automatisations sont à vérifier',text:'Certaines opérations EYWA sont en attente malgré plusieurs essais.\n\nMessages à vérifier : '+mails.n+'\nDossiers Notion à vérifier : '+notion.n+'\n\nOuvrez votre espace privé : https://eywa-booking.eywa-booking-cloudflare.workers.dev/espace/\n\nLes opérations continuent de réessayer automatiquement. Cette alerte est limitée à une par jour.',html:'<p>Certaines automatisations EYWA sont à vérifier.</p><p>Messages : '+mails.n+'<br>Dossiers Notion : '+notion.n+'</p><p><a href="https://eywa-booking.eywa-booking-cloudflare.workers.dev/espace/">Ouvrir mon espace EYWA</a></p><p>Le système continue de réessayer automatiquement. Une seule alerte est prévue par jour.</p>'},null,'crm-alert');
 }
 return {settings,sync,overview,details,mutate,reviewQueue,alerts};
}
