import ICAL from 'ical.js';
import {createHash,randomUUID} from 'node:crypto';
import policy from './booking-policy.cjs';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const day=ms=>policy.today(new Date(ms));
const hash=s=>createHash('sha256').update(s).digest('hex');
const short=(s,n=4000)=>String(s||'').trim().slice(0,n);
// Repli explicite pour les exports Google qui omettent VTIMEZONE (règles UE modernes).
const parisZone='BEGIN:VTIMEZONE\r\nTZID:Europe/Paris\r\nBEGIN:STANDARD\r\nDTSTART:19961027T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nEND:STANDARD\r\nBEGIN:DAYLIGHT\r\nDTSTART:19960331T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nEND:DAYLIGHT\r\nEND:VTIMEZONE';
export function calendarFeedURL(value){
 let u;try{u=new URL(value);}catch{fail('La connexion Google Agenda doit être configurée.');}
 if(u.protocol!=='https:'||u.hostname!=='calendar.google.com'||u.port||u.username||u.password||u.search||u.hash||!/^\/calendar\/ical\/[^/]+\/(private-[a-zA-Z0-9]+|public)\/basic\.ics$/.test(u.pathname))fail('Utilisez uniquement une adresse iCal Google Agenda valide.');
 return u.href;
}
export function readCalendar(ics,{mode='eywa',now=Date.now(),ownerEmail=''}={}){
 if(!['eywa','busy'].includes(mode)||typeof ics!=='string'||ics.length>2000000||!ics.trimStart().startsWith('BEGIN:VCALENDAR'))fail('Format d’agenda non pris en charge.');
 const root=new ICAL.Component(ICAL.parse(ics));
 ICAL.TimezoneService.register(new ICAL.Component(ICAL.parse(parisZone)));
 for(const zone of root.getAllSubcomponents('vtimezone'))ICAL.TimezoneService.register(zone);
 const defaultZone=root.getFirstPropertyValue('x-wr-timezone')||'Europe/Paris';
 const components=root.getAllSubcomponents('vevent');if(components.length>10000)fail('Agenda trop volumineux.');
 const groups=new Map();
 const declined=c=>!!ownerEmail&&c.getAllProperties('attendee').some(p=>String(p.getFirstValue()).toLowerCase()==='mailto:'+ownerEmail.toLowerCase()&&String(p.getParameter('partstat')).toUpperCase()==='DECLINED');
 for(const c of components){
  const uid=c.getFirstPropertyValue('uid');if(!uid)fail('Événement sans identifiant.');
  if(!groups.has(uid))groups.set(uid,[]);groups.get(uid).push(c);
 }
 const from=now-31*86400000,to=now+366*86400000,items=[];
 for(const [uid,list]of groups){
  const main=list.find(c=>!c.hasProperty('recurrence-id'));
  if(!main)continue;
  const title=String(main.getFirstPropertyValue('summary')||'');
  if(mode==='eywa'&&!/\beywa\b/i.test(title))continue;
  if(String(main.getFirstPropertyValue('status')).toUpperCase()==='CANCELLED'||declined(main))continue;
  for(const c of list)for(const name of ['dtstart','dtend','recurrence-id','rdate','exdate'])for(const prop of c.getAllProperties(name))for(const value of prop.getValues()){
   if(!(value instanceof ICAL.Time))continue;
   const tzid=prop.getParameter('tzid')||defaultZone;
   if(value.zone===ICAL.Timezone.localTimezone){const zone=ICAL.TimezoneService.get(tzid);if(!zone)fail('Fuseau horaire absent de l’export Google.');value.zone=zone;}
  }
  const event=new ICAL.Event(main,{exceptions:list.filter(c=>c.hasProperty('recurrence-id')),strictExceptions:true});
  if(!event.startDate)fail('Événement sans date.');
  const iterator=event.isRecurring()?event.iterator():null;let step=0,next=iterator?iterator.next():event.startDate;
  while(next){
   if(++step>20000||items.length>1500)fail('Récurrences trop nombreuses.');
   const current=iterator?event.getOccurrenceDetails(next):{startDate:event.startDate,endDate:event.endDate,item:event},c=current.item.component;
   const startsAt=current.startDate.toUnixTime()*1000,endsAt=current.endDate.toUnixTime()*1000;
   if(!Number.isFinite(startsAt)||!Number.isFinite(endsAt)||endsAt<=startsAt||endsAt-startsAt>366*86400000)fail('Durée d’événement invalide.');
   const cancelled=String(c.getFirstPropertyValue('status')).toUpperCase()==='CANCELLED',transparent=String(c.getFirstPropertyValue('transp')).toUpperCase()==='TRANSPARENT';
   const summary=short(c.getFirstPropertyValue('summary')||title,300),isEywa=/\beywa\b/i.test(summary);
   if(endsAt>from&&startsAt<to&&!cancelled&&!declined(c)&&(mode==='eywa'?isEywa:!transparent)){
    const d=day(startsAt),time=new Date(startsAt).toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}),last=day(endsAt-1);
    items.push({id:'calendar-'+hash(uid+'|'+(iterator?next.toString():'single')),startsAt,endsAt,block:!transparent,data:{name:summary||'Indisponibilité',date:d,lastDate:last,time,hours:(endsAt-startsAt)/3600000,days:Math.round((Date.parse(last+'T12:00:00Z')-Date.parse(d+'T12:00:00Z'))/86400000)+1,eventType:isEywa?'Événement EYWA dans Google Agenda':'Rendez-vous dans Google Agenda',location:short(c.getFirstPropertyValue('location'),500),notes:isEywa?short(c.getFirstPropertyValue('description'),6000):'',allDay:current.startDate.isDate,isEywa,transparent,guests:0,options:[],calendarSource:'Google Agenda'}});
   }
   if(!iterator||next.toUnixTime()*1000>=to)break;
   next=iterator.next();
  }
 }
 // Un événement non récurrent et le premier résultat de l’itérateur ne sont jamais ajoutés deux fois.
 return [...new Map(items.map(i=>[i.id,i])).values()];
}
export function createCalendar(env,fetcher=fetch){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 async function status(){const row=await sql('SELECT * FROM eywa_crm_calendar_state WHERE id=1').first();return {...row,configured:!!env.EYWA_CALENDAR_ICS_URL};}
 async function events(){return (await sql("SELECT * FROM eywa_crm_calendar_events WHERE status='active' ORDER BY starts_at LIMIT 1500").all()).results.map(r=>({id:r.id,data:JSON.parse(r.data_json),starts_at:r.starts_at,ends_at:r.ends_at,status:'calendar',calendarOnly:true}));}
 async function details(id){const r=await sql('SELECT * FROM eywa_crm_calendar_events WHERE id=?',id).first();if(!r)fail('Événement de l’agenda introuvable.',404);return {id:r.id,data:JSON.parse(r.data_json),starts_at:r.starts_at,ends_at:r.ends_at,status:r.status==='active'?'calendar':'cancelled',calendarOnly:true};}
 async function replace(items,now=Date.now(),activate=true){
  const run=randomUUID(),payload=JSON.stringify(items);if(payload.length>1800000)fail('Agenda trop volumineux.');
  // Une seule transaction : un téléchargement interrompu ne libère jamais une date.
  await env.DB.batch([
   sql("INSERT INTO eywa_crm_calendar_events(id,data_json,starts_at,ends_at,last_seen) SELECT json_extract(value,'$.id'),json_extract(value,'$.data'),json_extract(value,'$.startsAt'),json_extract(value,'$.endsAt'),? FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status='active',last_seen=excluded.last_seen",run,payload),
   sql("UPDATE eywa_crm_calendar_events SET status='cancelled' WHERE last_seen<>?",run),
   sql('DELETE FROM eywa_crm_calendar_days'),
   sql("WITH RECURSIVE dates(event_id,day,until_date) AS (SELECT id,json_extract(data_json,'$.date'),json_extract(data_json,'$.lastDate') FROM eywa_crm_calendar_events WHERE status='active' AND json_extract(data_json,'$.transparent')=0 UNION ALL SELECT event_id,date(day,'+1 day'),until_date FROM dates WHERE day<until_date) INSERT INTO eywa_crm_calendar_days(event_id,day) SELECT event_id,day FROM dates"),
   sql('UPDATE eywa_crm_calendar_state SET enabled=?,last_success=?,last_error=NULL WHERE id=1',activate?1:0,now)
  ]);
 }
 async function sync(force=false,now=Date.now()){
  if(!env.EYWA_CALENDAR_ICS_URL){if(force)fail('La connexion automatique Google Agenda reste à autoriser.',409);return;}
  const state=await status();if(!force&&state.last_attempt&&now-state.last_attempt<900000)return;
  const lock=await sql("INSERT INTO eywa_job_locks(name,until_at) VALUES('calendar-sync',?) ON CONFLICT(name) DO UPDATE SET until_at=excluded.until_at WHERE until_at<? RETURNING name",now+120000,now).first();if(!lock){if(force)fail('Une synchronisation est déjà en cours.',409);return;}
  try{
   await sql('UPDATE eywa_crm_calendar_state SET last_attempt=? WHERE id=1',now).run();
   const url=calendarFeedURL(env.EYWA_CALENDAR_ICS_URL),response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'text/calendar'}});
   if(!response.ok)throw Error('CALENDAR_DOWNLOAD_FAILED');
   if(Number(response.headers.get('Content-Length'))>2000000)throw Error('CALENDAR_TOO_LARGE');
   const reader=response.body.getReader(),decoder=new TextDecoder();let content='',size=0;
   for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2000000){await reader.cancel();throw Error('CALENDAR_TOO_LARGE');}content+=decoder.decode(part.value,{stream:true});}content+=decoder.decode();
   const ownerEmail=decodeURIComponent(new URL(url).pathname.split('/')[3]);
   const items=readCalendar(content,{mode:state.mode,now,ownerEmail});await replace(items,now);return {ok:true,count:items.length};
  }catch{
   await sql("UPDATE eywa_crm_calendar_state SET last_error='Google Agenda n’a pas pu être actualisé. Les anciens créneaux restent conservés.' WHERE id=1").run();
   if(force)fail('Google Agenda n’a pas pu être actualisé. Les anciens créneaux restent conservés.',503);
  }finally{await sql("DELETE FROM eywa_job_locks WHERE name='calendar-sync'").run();}
 }
 return {status,events,details,replace,sync};
}
