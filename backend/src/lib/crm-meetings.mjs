// Visios avec les prospects : invitation par e-mail (lien Meet fixe), boutons d'agenda,
// demande de changement de créneau par la personne, acceptation ou refus par EYWA.
import {randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
import policy from './booking-policy.cjs';

export const PUBLIC_ORIGIN='https://eywa-booking.eywa-booking-cloudflare.workers.dev';
const OWNER_EMAIL='contact.eywa08@gmail.com';
const TITLE='Visio avec Louis Le Poulain · EYWA Coffee Catering';
const fail=(s,status=400)=>{throw Object.assign(Error(s),{status});};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function parisTime(date,time){for(const offset of [1,2]){const t=Date.parse(date+'T'+time+':00Z')-offset*3600000;const f=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t)).replace(' ','T');if(f===date+'T'+time)return t;}fail('Heure invalide.');}
export const parisLabel=t=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',weekday:'long',day:'numeric',month:'long'}).format(new Date(t))+' à '+new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(t)).replace(':','h');
const parisParts=t=>{const f=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t));return {date:f.slice(0,10),time:f.slice(11,16)};};
const z=t=>new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const icsText=s=>String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');

export function agendaLinks(e){const iso=t=>new Date(t).toISOString().replace(/\.\d{3}Z$/,'Z');
 return {google:'https://calendar.google.com/calendar/render?'+new URLSearchParams({action:'TEMPLATE',text:TITLE,dates:z(e.start)+'/'+z(e.end),details:e.details,location:e.url}),
  outlook:'https://outlook.live.com/calendar/0/deeplink/compose?'+new URLSearchParams({path:'/calendar/action/compose',rru:'addevent',subject:TITLE,startdt:iso(e.start),enddt:iso(e.end),body:e.details,location:e.url}),
  apple:e.ics,change:e.change};}
export function meetingIcs(m,meetUrl){return ['BEGIN:VCALENDAR','PRODID:-//EYWA//Visio//FR','VERSION:2.0','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+m.id+'@eywacoffeecatering.com','DTSTAMP:'+z(Date.now()),'DTSTART:'+z(m.start_at),'DTEND:'+z(m.start_at+m.minutes*60000),'SUMMARY:'+icsText(TITLE),'DESCRIPTION:'+icsText('Lien Google Meet : '+meetUrl),'LOCATION:'+icsText(meetUrl),'URL:'+meetUrl,'BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:Visio EYWA dans 15 minutes','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n')+'\r\n';}

const button=(href,label,dark)=>'<a href="'+esc(href)+'" style="display:inline-block;margin:0 8px 10px 0;padding:12px 18px;border-radius:6px;'+(dark?'background:#243d32;color:#fffdf8;':'background:#fffdf8;color:#243d32;border:1.5px solid #243d32;')+'text-decoration:none;font-weight:bold;font-size:14px">'+esc(label)+'</a>';
const shell=inner=>'<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#291817"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="560" style="width:100%;max-width:560px;background:#fffdf8;border-radius:10px"><tr><td style="padding:30px 26px;font-size:15px;line-height:1.65">'+inner+'<p style="margin-top:28px">Louis Le Poulain<br>EYWA Coffee Catering<br>07 49 90 21 56</p></td></tr></table></td></tr></table></body></html>';
export function inviteHtml(v){return shell((v.copy?'<p style="color:#72766c;font-size:13px">Copie de l’invitation envoyée à '+esc(v.name)+' ('+esc(v.email)+').</p>':'')+'<p>Bonjour '+esc(v.first)+',</p><p>'+(v.moved?'Le rendez-vous est déplacé. Notre échange en visio aura lieu le ':'Je vous envoie l’invitation pour notre échange en visio le ')+'<b>'+esc(v.label)+'</b> ('+v.minutes+' min).</p><p style="margin:24px 0">'+button(v.meetUrl,'Rejoindre la visio Google Meet',true)+'</p><p style="margin:0 0 8px;font-weight:bold">Ajouter le rendez-vous à mon agenda</p><p style="margin:0 0 18px">'+button(v.links.google,'Google Agenda')+button(v.links.apple,'Apple Calendrier')+button(v.links.outlook,'Outlook')+'</p><p style="margin:0;font-size:14px;color:#72766c">Ce créneau ne vous convient pas ? <a href="'+esc(v.links.change)+'" style="color:#243d32;font-weight:bold">Proposer un autre créneau</a></p>');}

export function createMeetings(env,deps={}){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 const sign=s=>createHmac('sha256',env.EYWA_MAIL_RELAY_SECRET||'local').update('eywa-meet-v1:'+s).digest('base64url').slice(0,32);
 const check=(s,t)=>{const a=Buffer.from(sign(s)),b=Buffer.from(String(t||''));return a.length===b.length&&timingSafeEqual(a,b);};
 const urls=m=>({ics:PUBLIC_ORIGIN+'/visio.ics?'+new URLSearchParams({m:m.id,t:sign('ics:'+m.id)}),change:PUBLIC_ORIGIN+'/visio?'+new URLSearchParams({m:m.id,t:sign('change:'+m.id)})});
 async function meetUrl(){const u=JSON.parse((await sql('SELECT data_json FROM eywa_crm_settings WHERE id=1').first())?.data_json||'{}').meetUrl||'';if(!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(u))fail('Ajoutez d’abord votre lien Google Meet dans Réglages.');return u;}
 // Envoie l'invitation (et la copie EYWA) pour un créneau, enregistre le rendez-vous et l'historique.
 async function schedule(p,startAt,minutes,{replaces=null,now=Date.now()}={}){
  if(!deps.mailer)fail('L’envoi est indisponible.',503);
  const url=await meetUrl(),id='meet-'+p.id+'-'+startAt,m={id,start_at:startAt,minutes};
  const u=urls(m),label=parisLabel(startAt),first=p.name.split(/\s+/)[0];
  const links=agendaLinks({start:startAt,end:startAt+minutes*60000,url,details:'Visio avec Louis Le Poulain (EYWA Coffee Catering).\nLien Google Meet : '+url,ics:u.ics,change:u.change});
  const mail=copy=>({subject:(copy?'Copie : ':'')+(replaces?'Nouveau créneau · ':'')+TITLE+' · '+label,text:(copy?'Copie de l’invitation envoyée à '+p.name+' ('+p.email+').\n\n':'')+'Bonjour '+first+',\n\n'+(replaces?'Le rendez-vous est déplacé. Notre échange en visio aura lieu le ':'Je vous envoie l’invitation pour notre échange en visio le ')+label+' ('+minutes+' min).\n\nRejoindre la visio Google Meet : '+url+'\n\nAjouter à mon agenda :\nGoogle Agenda : '+links.google+'\nApple Calendrier : '+links.apple+'\nOutlook : '+links.outlook+'\n\nProposer un autre créneau : '+links.change+'\n\nLouis Le Poulain\nEYWA Coffee Catering\n07 49 90 21 56',html:inviteHtml({copy,moved:!!replaces,name:p.name,email:p.email,first,label,minutes,meetUrl:url,links})});
  const statements=[sql("INSERT INTO eywa_crm_meetings(id,prospect_id,start_at,minutes,status,created_at) VALUES(?,?,?,?,'scheduled',?) ON CONFLICT(id) DO UPDATE SET status='scheduled'",id,p.id,startAt,minutes,now),
   sql('INSERT INTO eywa_crm_prospect_events(id,prospect_id,kind,at,summary,body,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING','meet:'+id,p.id,'meeting',now,(replaces?'Créneau déplacé : visio le ':'Invitation Google Meet envoyée pour le ')+label+' ('+minutes+' min)','Lien : '+url,now),
   sql("UPDATE eywa_crm_prospects SET status=CASE WHEN status IN ('a-contacter','contacte','repondu') THEN 'rdv' ELSE status END,next_action_date=?,updated_at=? WHERE id=?",parisParts(startAt).date,now,p.id)];
  if(replaces)statements.push(sql("UPDATE eywa_crm_meetings SET status='replaced' WHERE id=? AND id<>?",replaces,id));
  await deps.mailer.enqueue('invite:'+id,p.email,mail(false),null,'prospect-invite');
  await deps.mailer.enqueue('invite:'+id+':copie',OWNER_EMAIL,mail(true),null,'prospect-invite');
  await env.DB.batch(statements);
  await deps.mailer.deliver('invite:'+id);await deps.mailer.deliver('invite:'+id+':copie');
  const sent=await sql('SELECT status FROM eywa_email_outbox WHERE id=?','invite:'+id).first();
  return {ok:true,id:p.id,meetingId:id,meetUrl:url,sent:sent?.status==='sent'};
 }
 const meeting=id=>sql('SELECT m.*,p.name,p.email FROM eywa_crm_meetings m JOIN eywa_crm_prospects p ON p.id=m.prospect_id WHERE m.id=?',String(id||'').slice(0,200)).first();
 const page=(title,inner,status=200)=>new Response('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>'+esc(title)+'</title><style>body{margin:0;background:#f6f3ec;color:#291817;font:16px/1.6 Arial,Helvetica,sans-serif}main{max-width:520px;margin:40px auto;background:#fffdf8;border-radius:12px;padding:30px 24px}h1{font:500 26px Georgia,serif;margin:0 0 12px}label{display:block;font-size:14px;color:#72766c;margin:16px 0 4px}input,select,textarea{width:100%;box-sizing:border-box;font:inherit;padding:11px;border:1px solid #d8d6cc;border-radius:6px;background:#fff}button{margin-top:20px;font:inherit;font-weight:bold;padding:13px 20px;border:0;border-radius:6px;background:#243d32;color:#fffdf8;cursor:pointer}.second{background:#fffdf8;color:#243d32;border:1.5px solid #243d32;margin-left:8px}.muted{color:#72766c;font-size:14px}</style></head><body><main>'+inner+'</main></body></html>',{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'}});
 const invalid=()=>page('Lien invalide','<h1>Lien invalide</h1><p>Ce lien n’est plus valable. Répondez simplement au mail d’invitation ou appelez Louis au 07 49 90 21 56.</p>',404);
 async function publicRoute(request,url,now=Date.now()){
  const path=url.pathname;
  if(path==='/visio.ics'&&request.method==='GET'){
   const m=await meeting(url.searchParams.get('m'));if(!m||!check('ics:'+m.id,url.searchParams.get('t')))return new Response('Lien invalide',{status:404});
   return new Response(meetingIcs(m,await meetUrl()),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="visio-eywa.ics"','Cache-Control':'no-store'}});
  }
  if(path==='/visio'){
   const id=request.method==='POST'?null:url.searchParams.get('m');let form=null;
   if(request.method==='POST'){form=new URLSearchParams(await request.text());}
   const mid=id||form?.get('m'),tok=request.method==='POST'?form.get('t'):url.searchParams.get('t');
   const m=await meeting(mid);if(!m||!check('change:'+m.id,tok))return invalid();
   if(m.status!=='scheduled')return page('Rendez-vous déplacé','<h1>Ce rendez-vous a déjà été déplacé</h1><p>Utilisez le lien du dernier mail d’invitation reçu.</p>');
   const cur=parisLabel(m.start_at);
   if(request.method==='GET'){const min=policy.today(new Date(now));return page('Proposer un autre créneau','<h1>Proposer un autre créneau</h1><p>Rendez-vous prévu : <b>'+esc(cur)+'</b> ('+m.minutes+' min).</p><form method="post" action="/visio"><input type="hidden" name="m" value="'+esc(m.id)+'"><input type="hidden" name="t" value="'+esc(tok)+'"><label for="d">Nouvelle date</label><input id="d" name="d" type="date" min="'+min+'" required><label for="h">Nouvelle heure</label><input id="h" name="h" type="time" step="900" required><label for="msg">Un mot pour Louis (facultatif)</label><textarea id="msg" name="msg" maxlength="1000" rows="3"></textarea><button>Envoyer ma proposition</button></form><p class="muted">Louis confirme par e-mail. D’ici là, le rendez-vous prévu reste valable.</p>');}
   if(request.method!=='POST')return new Response('Méthode non autorisée',{status:405});
   const d=String(form.get('d')||''),h=String(form.get('h')||'');
   if(!policy.validDate(d)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h))return page('Créneau invalide','<h1>Créneau invalide</h1><p>Choisissez une date et une heure valides.</p><p><a href="javascript:history.back()">Revenir</a></p>',400);
   let at;try{at=parisTime(d,h);}catch{return page('Créneau invalide','<h1>Heure invalide</h1><p><a href="javascript:history.back()">Revenir</a></p>',400);}
   if(at<now+3600000)return page('Créneau trop proche','<h1>Ce créneau est trop proche</h1><p>Proposez un créneau au moins une heure à l’avance.</p><p><a href="javascript:history.back()">Revenir</a></p>',400);
   const open=await sql("SELECT COUNT(*) AS n FROM eywa_crm_meeting_requests WHERE meeting_id=? AND status='pending'",m.id).first();
   if(open.n>=3)return page('Demande déjà envoyée','<h1>Demande déjà envoyée</h1><p>Louis a bien reçu vos propositions et vous répond rapidement.</p>');
   const rid=randomUUID(),msg=String(form.get('msg')||'').trim().slice(0,1000),newLabel=parisLabel(at);
   await sql("INSERT INTO eywa_crm_meeting_requests(id,meeting_id,proposed_at,message,status,created_at) VALUES(?,?,?,?,'pending',?)",rid,m.id,at,msg,now).run();
   await sql('INSERT INTO eywa_crm_prospect_events(id,prospect_id,kind,at,summary,body,created_at) VALUES(?,?,?,?,?,?,?)','req:'+rid,m.prospect_id,'note',now,'Demande de changement de créneau : '+cur+' → '+newLabel,msg,now).run();
   const decide=a=>PUBLIC_ORIGIN+'/visio-decision?'+new URLSearchParams({r:rid,a,t:sign('decide:'+rid+':'+a)});
   if(deps.mailer){await deps.mailer.enqueue('reschedule:'+rid,OWNER_EMAIL,{subject:m.name+' propose de déplacer la visio',text:m.name+' propose de déplacer la visio.\n\nPrévu : '+cur+'\nProposé : '+newLabel+'\n'+(msg?'\nSon message : '+msg+'\n':'')+'\nAccepter : '+decide('accept')+'\nRefuser : '+decide('decline'),html:shell('<p><b>'+esc(m.name)+'</b> propose de déplacer la visio.</p><p>Prévu : '+esc(cur)+'<br>Proposé : <b>'+esc(newLabel)+'</b> ('+m.minutes+' min)</p>'+(msg?'<p style="white-space:pre-wrap;background:#f6f3ec;padding:12px;border-radius:6px">'+esc(msg)+'</p>':'')+'<p style="margin:24px 0">'+button(decide('accept'),'Accepter ce créneau',true)+button(decide('decline'),'Refuser')+'</p><p style="font-size:13px;color:#72766c">Si tu acceptes, '+esc(m.name)+' reçoit automatiquement la nouvelle invitation.</p>')},null,'meeting-request');await deps.mailer.deliver('reschedule:'+rid);}
   return page('Proposition envoyée','<h1>Merci, c’est envoyé</h1><p>Vous avez proposé le <b>'+esc(newLabel)+'</b>. Louis vous confirme par e-mail. D’ici là, le rendez-vous du '+esc(cur)+' reste valable.</p>');
  }
  if(path==='/visio-decision'){
   const q=request.method==='POST'?new URLSearchParams(await request.text()):url.searchParams,rid=q.get('r'),a=q.get('a'),tok=q.get('t');
   if(!['accept','decline'].includes(a)||!check('decide:'+rid+':'+a,tok))return invalid();
   const r=await sql('SELECT r.*,m.prospect_id,m.minutes,m.start_at FROM eywa_crm_meeting_requests r JOIN eywa_crm_meetings m ON m.id=r.meeting_id WHERE r.id=?',String(rid).slice(0,100)).first();if(!r)return invalid();
   const p=await sql('SELECT id,name,email FROM eywa_crm_prospects WHERE id=?',r.prospect_id).first();
   if(r.status!=='pending')return page('Déjà traité','<h1>Déjà traité</h1><p>Cette demande a déjà été '+(r.status==='accepted'?'acceptée':'refusée')+'.</p>');
   // Un GET n'agit jamais (les antivirus de messagerie ouvrent les liens) : il affiche un bouton de confirmation.
   if(request.method==='GET')return page('Confirmer','<h1>'+(a==='accept'?'Accepter':'Refuser')+' ce créneau ?</h1><p>'+esc(p.name)+' propose le <b>'+esc(parisLabel(r.proposed_at))+'</b> au lieu du '+esc(parisLabel(r.start_at))+'.</p><form method="post" action="/visio-decision"><input type="hidden" name="r" value="'+esc(rid)+'"><input type="hidden" name="a" value="'+esc(a)+'"><input type="hidden" name="t" value="'+esc(tok)+'"><button>'+(a==='accept'?'Oui, accepter et envoyer la nouvelle invitation':'Oui, refuser')+'</button></form>');
   if(request.method!=='POST')return new Response('Méthode non autorisée',{status:405});
   const claimed=await sql("UPDATE eywa_crm_meeting_requests SET status=?,decided_at=? WHERE id=? AND status='pending' RETURNING id",a==='accept'?'accepted':'declined',now,r.id).first();if(!claimed)return page('Déjà traité','<h1>Déjà traité</h1>');
   if(a==='accept'){await schedule(p,r.proposed_at,r.minutes,{replaces:r.meeting_id,now});await sql("UPDATE eywa_crm_meeting_requests SET status='declined',decided_at=? WHERE meeting_id=? AND status='pending'",now,r.meeting_id).run();return page('Créneau accepté','<h1>C’est fait</h1><p>'+esc(p.name)+' a reçu la nouvelle invitation pour le <b>'+esc(parisLabel(r.proposed_at))+'</b>. La fiche est à jour dans ton espace.</p>');}
   const m=await meeting(r.meeting_id),u=urls(m);
   if(deps.mailer){await deps.mailer.enqueue('declined:'+r.id,p.email,{subject:'Votre proposition de créneau · EYWA Coffee Catering',text:'Bonjour '+p.name.split(/\s+/)[0]+',\n\nLe créneau du '+parisLabel(r.proposed_at)+' n’est malheureusement pas possible de mon côté.\n\nLe rendez-vous du '+parisLabel(m.start_at)+' reste valable. Vous pouvez aussi proposer un autre créneau : '+u.change+'\n\nLouis Le Poulain\nEYWA Coffee Catering\n07 49 90 21 56',html:shell('<p>Bonjour '+esc(p.name.split(/\s+/)[0])+',</p><p>Le créneau du <b>'+esc(parisLabel(r.proposed_at))+'</b> n’est malheureusement pas possible de mon côté.</p><p>Le rendez-vous du <b>'+esc(parisLabel(m.start_at))+'</b> reste valable.</p><p style="margin:22px 0">'+button(u.change,'Proposer un autre créneau',true)+'</p>')},null,'meeting-request');await deps.mailer.deliver('declined:'+r.id);}
   await sql('INSERT INTO eywa_crm_prospect_events(id,prospect_id,kind,at,summary,created_at) VALUES(?,?,?,?,?,?)','dec:'+r.id,p.id,'note',now,'Créneau du '+parisLabel(r.proposed_at)+' refusé, rendez-vous initial maintenu',now).run();
   return page('Créneau refusé','<h1>C’est noté</h1><p>'+esc(p.name)+' a été prévenu(e) que ce créneau n’est pas possible. Le rendez-vous initial est maintenu.</p>');
  }
  return null;
 }
 return {schedule,publicRoute,urls,sign};
}
