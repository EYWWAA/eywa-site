// Prospection : fiches des personnes contactées et historique (saisi à la main ou retrouvé dans Gmail).
import {randomUUID} from 'node:crypto';
import policy from './booking-policy.cjs';

// Heure de Paris → horodatage UTC (gère heure d'été et d'hiver).
export function parisTime(date,time){for(const offset of [1,2]){const t=Date.parse(date+'T'+time+':00Z')-offset*3600000;const f=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t)).replace(' ','T');if(f===date+'T'+time)return t;}fail('Heure invalide.');}
const icsDate=t=>new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const icsText=s=>String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
export function calendarInvite(e){return ['BEGIN:VCALENDAR','PRODID:-//EYWA//Espace//FR','VERSION:2.0','METHOD:REQUEST','BEGIN:VEVENT','UID:'+e.uid+'@eywacoffeecatering.com','DTSTAMP:'+icsDate(e.stamp),'DTSTART:'+icsDate(e.start),'DTEND:'+icsDate(e.end),'SUMMARY:'+icsText(e.title),'DESCRIPTION:'+icsText(e.description),'LOCATION:'+icsText(e.location),'URL:'+e.location,'ORGANIZER;CN=EYWA Coffee Catering:mailto:contact.eywa08@gmail.com','ATTENDEE;CN='+icsText(e.attendeeName)+';ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:'+e.attendee,'STATUS:CONFIRMED','SEQUENCE:0','BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:Rappel','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n')+'\r\n';}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function inviteHtml(v){return '<!doctype html><html lang="fr"><body style="margin:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#291817"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="560" style="width:100%;max-width:560px;background:#fffdf8;border-radius:10px"><tr><td style="padding:30px 26px;font-size:15px;line-height:1.65">'+(v.copy?'<p style="color:#72766c;font-size:13px">Copie de l’invitation envoyée à '+esc(v.name)+' ('+esc(v.email)+').</p>':'')+'<p>Bonjour '+esc(v.first)+',</p><p>Je vous envoie l’invitation pour notre échange en visio le <b>'+esc(v.label)+'</b> ('+v.minutes+' min).</p><p style="margin:24px 0"><a href="'+esc(v.meetUrl)+'" style="display:inline-block;padding:13px 20px;border-radius:6px;background:#243d32;color:#fffdf8;text-decoration:none;font-weight:bold">Rejoindre la visio Google Meet</a></p>'+(v.message?'<p style="white-space:pre-wrap">'+esc(v.message)+'</p>':'')+'<p style="color:#72766c;font-size:13px">Le rendez-vous est en pièce jointe : vous pouvez l’ajouter à votre agenda en un clic.</p><p>Louis<br>EYWA Coffee Catering<br>07 49 90 21 56</p></td></tr></table></td></tr></table></body></html>';}

export const statuses={'a-contacter':'À contacter',contacte:'Contacté',repondu:'A répondu',rdv:'Rendez-vous',devis:'Devis envoyé',gagne:'Client',perdu:'Sans suite'};
export const sources={linkedin:'LinkedIn',mail:'E-mail',telephone:'Téléphone',salon:'Salon ou événement',recommandation:'Recommandation',autre:'Autre'};
export const kinds={linkedin:'Message LinkedIn',mail_out:'E-mail envoyé',mail_in:'E-mail reçu',call:'Appel',meeting:'Rendez-vous',note:'Note'};
const OWNER=/(?:^|[<\s])contact\.?eywa08@gmail\.com(?:$|[>\s])/i;
const fail=(s,status=400)=>{throw Object.assign(Error(s),{status});};
const text=(s,n)=>String(s??'').trim().slice(0,n);
function email(v){const s=text(v,254).toLowerCase();if(s&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s))fail('Adresse e-mail invalide.');return s;}
function linkedin(v){const s=text(v,500);if(!s)return '';let u;try{u=new URL(s);}catch{fail('Lien LinkedIn invalide.');}if(u.protocol!=='https:'||!/(^|\.)linkedin\.com$/.test(u.hostname))fail('Indiquez un lien de profil LinkedIn.');return u.href;}
function phone(v){const s=text(v,40);if(s&&!/^[+\d][\d\s.()-]{5,}$/.test(s))fail('Numéro de téléphone invalide.');return s;}
function day(v){const s=text(v,10);if(!s)return null;if(!policy.validDate(s))fail('Date invalide.');return s;}

export function createProspects(env,deps={}){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 async function list(){
  return (await sql(`SELECT p.id,p.name,p.company,p.role,p.email,p.phone,p.linkedin_url,p.source,p.status,p.next_action_date,p.updated_at,
   (SELECT MAX(at) FROM eywa_crm_prospect_events e WHERE e.prospect_id=p.id) AS last_contact_at,
   (SELECT COUNT(*) FROM eywa_crm_prospect_events e WHERE e.prospect_id=p.id) AS exchanges
   FROM eywa_crm_prospects p ORDER BY COALESCE(p.next_action_date,'9999-12-31'),p.updated_at DESC LIMIT 2000`).all()).results;
 }
 async function details(id){
  const p=await sql('SELECT * FROM eywa_crm_prospects WHERE id=?',text(id,100)).first();if(!p)fail('Prospect introuvable.',404);
  const events=(await sql('SELECT id,kind,at,summary,body FROM eywa_crm_prospect_events WHERE prospect_id=? ORDER BY at DESC LIMIT 300',p.id).all()).results;
  delete p.mail_page_token;return {...p,events};
 }
 async function mutate(action,b,now=Date.now()){
  if(action==='prospect'){
   const name=text(b.name,150);if(!name)fail('Indiquez le nom de la personne.');
   const source=b.source in sources?b.source:fail('Canal invalide.'),status=b.status in statuses?b.status:fail('Statut invalide.');
   const row={name,company:text(b.company,150),role:text(b.role,150),email:email(b.email),phone:phone(b.phone),linkedin:linkedin(b.linkedinUrl),source,status,next:day(b.nextActionDate),notes:text(b.notes,4000)};
   if(row.email){const twin=await sql('SELECT id FROM eywa_crm_prospects WHERE email=? AND id<>?',row.email,text(b.id,100)).first();if(twin)fail('Cette adresse e-mail est déjà dans une autre fiche.',409);}
   if(b.id){
    const current=await sql('SELECT email FROM eywa_crm_prospects WHERE id=?',text(b.id,100)).first();if(!current)fail('Prospect introuvable.',404);
    const reset=current.email!==row.email;
    await sql('UPDATE eywa_crm_prospects SET name=?,company=?,role=?,email=?,phone=?,linkedin_url=?,source=?,status=?,next_action_date=?,notes=?,updated_at=?'+(reset?',mail_scanned_at=0,mail_page_token=NULL,mail_range_end=NULL':'')+' WHERE id=?',row.name,row.company,row.role,row.email,row.phone,row.linkedin,row.source,row.status,row.next,row.notes,now,text(b.id,100)).run();
    return {ok:true,id:b.id};
   }
   const id=randomUUID();
   await sql('INSERT INTO eywa_crm_prospects(id,name,company,role,email,phone,linkedin_url,source,status,next_action_date,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',id,row.name,row.company,row.role,row.email,row.phone,row.linkedin,row.source,row.status,row.next,row.notes,now,now).run();
   return {ok:true,id};
  }
  if(action==='prospect-log'){
   const p=await sql('SELECT id,status FROM eywa_crm_prospects WHERE id=?',text(b.prospectId,100)).first();if(!p)fail('Prospect introuvable.',404);
   if(!(b.kind in kinds)||b.kind==='mail_in')fail('Type d’échange invalide.');
   const when=day(b.date)||policy.today(new Date(now)),at=Date.parse(when+'T12:00:00Z'),summary=text(b.summary,2000);
   if(!summary)fail('Résumez l’échange en une phrase.');
   await env.DB.batch([sql('INSERT INTO eywa_crm_prospect_events(id,prospect_id,kind,at,summary,created_at) VALUES(?,?,?,?,?,?)',randomUUID(),p.id,b.kind,at,summary,now),
    sql("UPDATE eywa_crm_prospects SET status=CASE WHEN status='a-contacter' THEN 'contacte' ELSE status END,next_action_date=COALESCE(?,next_action_date),updated_at=? WHERE id=?",day(b.nextActionDate),now,p.id)]);
   return {ok:true,id:p.id};
  }
  if(action==='prospect-meeting'){
   const p=await sql('SELECT id,name,email FROM eywa_crm_prospects WHERE id=?',text(b.prospectId,100)).first();if(!p)fail('Prospect introuvable.',404);
   if(!p.email)fail('Ajoutez l’e-mail de la personne dans sa fiche avant de l’inviter.');
   const config=JSON.parse((await sql('SELECT data_json FROM eywa_crm_settings WHERE id=1').first())?.data_json||'{}'),meetUrl=config.meetUrl||'';
   if(!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(meetUrl))fail('Ajoutez d’abord votre lien Google Meet dans Réglages.');
   const when=day(b.date),time=text(b.time,5),minutes=Number(b.minutes);
   if(!when||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail('Choisissez la date et l’heure.');
   if(![15,30,45,60,90].includes(minutes))fail('Durée invalide.');
   const startMs=parisTime(when,time);if(startMs<now)fail('Cette heure est déjà passée.');
   const title=text(b.title,200)||'Échange avec EYWA',message=text(b.message,3000),uid='meet-'+p.id+'-'+when+'T'+time.replace(':','');
   const label=new Date(Date.parse(when+'T12:00:00Z')).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'})+' à '+time.replace(':','h');
   const ics=calendarInvite({uid,start:startMs,end:startMs+minutes*60000,title,description:(message?message+'\n\n':'')+'Lien de la visio : '+meetUrl,location:meetUrl,attendee:p.email,attendeeName:p.name,stamp:now});
   const first=p.name.split(/\s+/)[0];
   const mail=copy=>({subject:(copy?'Copie : ':'')+title+' · '+label,text:(copy?'Copie de l’invitation envoyée à '+p.name+' ('+p.email+').\n\n':'')+'Bonjour '+first+',\n\nJe vous envoie l’invitation pour notre échange en visio le '+label+' ('+minutes+' min).\n\nLien Google Meet : '+meetUrl+'\n\n'+(message?message+'\n\n':'')+'Le rendez-vous est en pièce jointe, vous pouvez l’ajouter à votre agenda en un clic.\n\nLouis\nEYWA Coffee Catering\n07 49 90 21 56',html:inviteHtml({copy,name:p.name,email:p.email,first,label,minutes,meetUrl,message}),ics});
   if(!deps.mailer)fail('L’envoi est indisponible.',503);
   await deps.mailer.enqueue('invite:'+uid,p.email,mail(false),null,'prospect-invite');
   await deps.mailer.enqueue('invite:'+uid+':copie','contact.eywa08@gmail.com',mail(true),null,'prospect-invite');
   await env.DB.batch([sql('INSERT INTO eywa_crm_prospect_events(id,prospect_id,kind,at,summary,body,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING','meet:'+uid,p.id,'meeting',now,'Invitation Google Meet envoyée pour le '+label+' ('+minutes+' min)','Lien : '+meetUrl+(message?'\n\n'+message:''),now),
    sql("UPDATE eywa_crm_prospects SET status=CASE WHEN status IN ('a-contacter','contacte','repondu') THEN 'rdv' ELSE status END,next_action_date=?,updated_at=? WHERE id=?",when,now,p.id)]);
   await deps.mailer.deliver('invite:'+uid);await deps.mailer.deliver('invite:'+uid+':copie');
   const sent=await sql("SELECT status FROM eywa_email_outbox WHERE id=?",'invite:'+uid).first();
   return {ok:true,id:p.id,meetUrl,sent:sent?.status==='sent'};
  }
  if(action==='prospect-log-delete'){
   const r=await sql("DELETE FROM eywa_crm_prospect_events WHERE id=? AND id NOT LIKE 'gmail:%' RETURNING prospect_id",text(b.id,100)).first();if(!r)fail('Échange introuvable.',404);return {ok:true,id:r.prospect_id};
  }
  fail('Action inconnue.',404);
 }
 // Retrouve dans la boîte EYWA les e-mails échangés avec chaque prospect (3 fiches par passage, reprise par curseur).
 async function syncMail(fetcher=fetch,now=Date.now()){
  if(env.EYWA_AUTOMATION_ENABLED!=='true'||env.EYWA_GMAIL_ARCHIVE_ENABLED!=='true'||!env.EYWA_MAIL_RELAY_URL)return 0;
  const rows=(await sql("SELECT id,email,mail_scanned_at,mail_page_token,mail_range_end FROM eywa_crm_prospects WHERE email<>'' AND status<>'perdu' AND mail_scanned_at<? ORDER BY mail_scanned_at LIMIT 3",now-30*60000).all()).results;
  let added=0;
  for(const p of rows){
   const end=p.mail_range_end||now;let data;
   try{const r=await fetcher(env.EYWA_MAIL_RELAY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.EYWA_MAIL_RELAY_SECRET,action:'messages',email:p.email,after:Math.max(0,p.mail_scanned_at-120000),before:end,pageToken:p.mail_page_token||''}),redirect:'follow',signal:AbortSignal.timeout(25000)});data=await r.json();if(!r.ok||data.ok!==true)continue;}catch{continue;}
   const statements=[];
   for(const m of data.messages||[]){
    if(!/^[a-fA-F0-9]+$/.test(m.id||'')||!Number.isFinite(m.at)||m.at>end)continue;
    const out=OWNER.test(m.from||''),body=text(m.text,20000);
    statements.push(sql('INSERT INTO eywa_crm_prospect_events(id,prospect_id,kind,at,summary,body,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING','gmail:'+m.id+':'+p.id,p.id,out?'mail_out':'mail_in',m.at,text(m.subject||'(Sans objet)',250),body,now));
    if(!out)statements.push(sql("UPDATE eywa_crm_prospects SET status=CASE WHEN status IN ('a-contacter','contacte') THEN 'repondu' ELSE status END WHERE id=?",p.id));
    added++;
   }
   statements.push(sql('UPDATE eywa_crm_prospects SET mail_scanned_at=?,mail_page_token=?,mail_range_end=? WHERE id=?',data.nextPageToken?p.mail_scanned_at:end,data.nextPageToken||null,data.nextPageToken?end:null,p.id));
   for(let i=0;i<statements.length;i+=60)await env.DB.batch(statements.slice(i,i+60));
  }
  return added;
 }
 return {list,details,mutate,syncMail};
}
