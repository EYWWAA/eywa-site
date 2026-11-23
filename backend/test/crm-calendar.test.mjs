import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {database} from './booking.test.mjs';
import {readCalendar,calendarFeedURL,createCalendar,isEywaService} from '../src/lib/crm-calendar.mjs';
import {createBookings} from '../src/lib/bookings.mjs';
import {createCRM} from '../src/lib/crm.mjs';
const now=Date.parse('2026-11-20T12:00:00Z');
const feed=body=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:fixture\r\nX-WR-TIMEZONE:Europe/Paris\r\n'+body+'\r\nEND:VCALENDAR';
const event=(uid,title,start='20261201T120000',end='20261201T140000',extra='')=>'BEGIN:VEVENT\r\nUID:'+uid+'\r\nSUMMARY:'+title+'\r\nDTSTART;TZID=Europe/Paris:'+start+'\r\nDTEND;TZID=Europe/Paris:'+end+'\r\n'+extra+'\r\nEND:VEVENT';
const source=feed(event('fixture','EYWA - Déjeuner',undefined,undefined,'LOCATION:Lieu fictif\r\nDESCRIPTION:Horaire provisoire\\nÀ confirmer.'));
const privateURL='https://calendar.google.com/calendar/ical/fixture%40example.invalid/private-fixture0123456789/basic.ics';
test('Google calendar: service import excludes administrative EYWA reminders and prospecting',()=>{
 for(const name of ['EYWA – Prospection ULTRA','EYWA – Améliorer le pitch + entraînement d’appel','EYWA – Appels fêtes de fin d’année','EYWA – Services à Charleville (même gratuits) pour pratiquer'])assert.equal(isEywaService(name),false);
 assert.equal(isEywaService('EYWA – Déjeuner Nathalie Siméon (AXA) – 30 pers – OFFERT'),true);
});
function setup(){const DB=database();for(const f of ['0003_transactional_email.sql','0004_automation.sql','0016_quote_expiry.sql','0006_balance_invoices.sql'])DB.raw.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));return {DB};}
test('Google calendar: default import keeps EYWA only, preserving location and provisional notes',()=>{
 const items=readCalendar(feed(event('one','EYWA - Déjeuner')+'\r\n'+event('personal','Rendez-vous personnel')),{now});assert.equal(items.length,1);assert.equal(items[0].startsAt,Date.parse('2026-12-01T11:00:00Z'));assert.equal(items[0].data.date,'2026-12-01');assert.equal(items[0].data.time,'12:00');
 const [q]=readCalendar(source,{now});assert.equal(q.data.location,'Lieu fictif');assert(q.data.notes.includes('provisoire\n'));assert.equal(q.data.hours,2);assert.equal(q.block,true);
});
test('Google calendar: recurrence exceptions, exclusions and Paris daylight saving keep the real hours',()=>{
 const body=event('weekly','EYWA chaque dimanche','20261018T120000','20261018T130000','RRULE:FREQ=WEEKLY;COUNT=3\r\nEXDATE;TZID=Europe/Paris:20261025T120000');
 const items=readCalendar(feed(body),{now:Date.parse('2026-10-20T12:00:00Z')});assert.deepEqual(items.map(x=>new Date(x.startsAt).toISOString()),['2026-10-18T10:00:00.000Z','2026-11-01T11:00:00.000Z']);
 const moved=feed(event('weekly','EYWA Hebdo',undefined,undefined,'RRULE:FREQ=WEEKLY;COUNT=3')+'\r\n'+event('weekly','EYWA déplacé','20261208T150000','20261208T170000','RECURRENCE-ID;TZID=Europe/Paris:20261208T120000')+'\r\n'+event('weekly','EYWA annulé','20261215T120000','20261215T140000','RECURRENCE-ID;TZID=Europe/Paris:20261215T120000\r\nSTATUS:CANCELLED'));
 const values=readCalendar(moved,{now});assert.equal(values.length,2);assert.equal(values[1].data.time,'15:00');
});
test('Google calendar: EXDATE also excludes DTSTART and unrelated UID exceptions never replace an occurrence',()=>{
 const text=feed(event('first','EYWA Répété',undefined,undefined,'RRULE:FREQ=WEEKLY;COUNT=2\r\nEXDATE;TZID=Europe/Paris:20261201T120000')+'\r\n'+event('second','EYWA Autre',undefined,undefined,'RRULE:FREQ=WEEKLY;COUNT=2')+'\r\n'+event('second','EYWA Déplacé','20261208T160000','20261208T170000','RECURRENCE-ID;TZID=Europe/Paris:20261208T120000'));
 const items=readCalendar(text,{now});assert.equal(items.filter(x=>x.data.name==='EYWA Répété').length,1);assert.equal(items.find(x=>x.data.name==='EYWA Répété').data.time,'12:00');assert.equal(items.find(x=>x.data.name==='EYWA Déplacé').data.time,'16:00');
});
test('Google calendar: all-day exclusive end, midnight and free events do not block an extra day',()=>{
 const allDay=feed('BEGIN:VEVENT\r\nUID:all-day\r\nSUMMARY:EYWA journée\r\nDTSTART;VALUE=DATE:20261201\r\nDTEND;VALUE=DATE:20261202\r\nEND:VEVENT');const [a]=readCalendar(allDay,{now});assert.equal(a.data.date,'2026-12-01');assert.equal(a.data.lastDate,'2026-12-01');assert.equal(a.data.allDay,true);
 const [b]=readCalendar(feed(event('night','EYWA soir','20261201T220000','20261202T000000')),{now});assert.equal(b.data.lastDate,'2026-12-01');
 const transparent=feed(event('free','EYWA disponible',undefined,undefined,'TRANSP:TRANSPARENT'));assert.equal(readCalendar(transparent,{now})[0].block,false);assert.equal(readCalendar(transparent,{now,mode:'busy'}).length,0);
 assert.equal(readCalendar(feed(event('cancel','EYWA annulé',undefined,undefined,'STATUS:CANCELLED')),{now}).length,0);
});
test('Google calendar: declined invitations are excluded without changing the calendar',()=>{
 const source=feed(event('declined','EYWA Invitation',undefined,undefined,'ATTENDEE;PARTSTAT=DECLINED:mailto:fixture@example.invalid'));
 assert.equal(readCalendar(source,{now,ownerEmail:'fixture@example.invalid'}).length,0);
});
test('Google calendar: only Google iCal URLs are accepted and no secret appears in the CRM status',async()=>{
 assert.equal(calendarFeedURL(privateURL),privateURL);
 for(const u of ['https://example.com/feed.ics','http://calendar.google.com/calendar/ical/x/private-abc/basic.ics','https://calendar.google.com/calendar/ical/x/private-abc/basic.ics?token=x','https://user:secret@calendar.google.com/calendar/ical/x/private-abc/basic.ics','https://169.254.169.254/latest/meta-data'])assert.throws(()=>calendarFeedURL(u));
 const env=setup();try{env.EYWA_CALENDAR_ICS_URL=privateURL;const state=await createCalendar(env).status();assert(state.configured);assert(!JSON.stringify(state).includes('private-fixture'));}finally{env.DB.raw.close();}
});
test('Google calendar: synchronized days block public and manual bookings without financial side effects',async()=>{
 const env=setup(),calendar=createCalendar(env),bookings=createBookings(env.DB);try{
  await calendar.replace(readCalendar(source,{now}));assert.deepEqual(await bookings.busy('2026-12-01','2026-12-02'),['2026-12-01']);assert.equal(await bookings.claim(['2026-12-01'],30000,15000,'deposit',{}),null);
  await assert.rejects(()=>createCRM(env).mutate('manual-event',{name:'Fixture',date:'2026-12-01',time:'10:00',hours:2,days:1,guests:20}),e=>e.status===409);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_bookings').get().n,0);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_invoices').get().n,0);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_email_outbox').get().n,0);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_crm_events').get().n,0);
  const overview=await createCRM(env).overview();assert.equal(overview.externalEvents.length,1);const d=await createCRM(env).details(overview.externalEvents[0].id);assert(d.calendarOnly);assert.equal(d.data.name,'EYWA - Déjeuner');
 }finally{env.DB.raw.close();}
});
test('Google calendar: idempotent updates, cancellations and failed transactions preserve the right busy days',async()=>{
 const env=setup(),c=createCalendar(env),b=createBookings(env.DB);try{
  const items=readCalendar(source,{now});await c.replace(items);await c.replace(items);assert.equal((await c.events()).length,1);
  await assert.rejects(()=>c.replace([...items,{...items[0],id:'invalid',endsAt:0}]));assert.deepEqual(await b.busy('2026-12-01','2026-12-02'),['2026-12-01']);
  await c.replace(readCalendar(feed(event('fixture','EYWA - Déjeuner','20261202T120000','20261202T140000')),{now}));assert.deepEqual(await b.busy('2026-12-01','2026-12-03'),['2026-12-02']);
  await c.replace([]);assert.deepEqual(await b.busy('2026-12-01','2026-12-03'),[]);assert.equal((await c.events()).length,0);assert.equal(env.DB.raw.prepare('SELECT status FROM eywa_crm_calendar_events LIMIT 1').get().status,'cancelled');
 }finally{env.DB.raw.close();}
});
test('Google calendar: failed download keeps busy dates and stale connection fails closed',async()=>{
 const env=setup();try{
  env.EYWA_CALENDAR_ICS_URL=privateURL;const c=createCalendar(env,async()=>new Response('Unavailable',{status:503}));await c.replace(readCalendar(source,{now}));await assert.rejects(()=>c.sync(true),e=>e.status===503);assert.equal((await c.events()).length,1);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_crm_calendar_days').get().n,1);assert(!JSON.stringify(await c.status()).includes(privateURL));
  env.DB.raw.prepare('UPDATE eywa_crm_calendar_state SET last_success=?').run(Date.now()-7*3600000);await assert.rejects(()=>createBookings(env.DB).busy('2026-12-01','2026-12-02'),/refresh/);
 }finally{env.DB.raw.close();}
});
test('Google calendar: successful sync is read only, rate limited and restores freshness after an outage',async()=>{
 const env=setup();try{env.EYWA_CALENDAR_ICS_URL=privateURL;let calls=0;const c=createCalendar(env,async(url,opts)=>{calls++;assert.equal(url,privateURL);assert.equal(opts.redirect,'manual');assert(!opts.method||opts.method==='GET');return new Response(source,{headers:{'Content-Type':'text/calendar'}});});assert.equal((await c.sync(true,now)).count,1);await c.sync(false,now+1000);assert.equal(calls,1);assert.equal((await c.status()).last_error,null);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_email_outbox').get().n,0);}finally{env.DB.raw.close();}
});

test('Google calendar: redirects remain restricted to the same Google calendar export',async()=>{
 const env=setup();try{
  env.EYWA_CALENDAR_ICS_URL=privateURL;let calls=0;
  const c=createCalendar(env,async(url)=>{calls++;return calls===1?new Response(null,{status:302,headers:{Location:privateURL.replace('calendar.google.com','www.google.com')}}):new Response(source);});
  assert.equal((await c.sync(true,now)).count,1);assert.equal(calls,2);
  for(const location of ['https://example.invalid/private-feed','https://www.google.com/other-path',privateURL+'?token=bad']){
   let rejectedCalls=0;const bad=createCalendar(env,async()=>{rejectedCalls++;return new Response(null,{status:302,headers:{Location:location}});});
   await assert.rejects(()=>bad.sync(true,now+1000),e=>e.status===503);assert.equal(rejectedCalls,1);assert.equal((await bad.status()).last_error.endsWith('[redirect]'),true);
  }
 }finally{env.DB.raw.close();}
});
