import {createMailer} from './lib/mail-delivery.mjs';
import {quoteEmails} from './lib/quote-emails.mjs';
import {quoteLines} from './lib/quote-lines.mjs';
import {paymentAutomation} from './lib/payment-automation.mjs';
import {queueFollowups,stopQuote} from './lib/followups.mjs';
import {invoiceResponse} from './lib/invoices.mjs';
import {createNotionSync} from './lib/notion-sync.mjs';
import {syncGmail} from './lib/gmail-sync.mjs';
import {createBookings,reconcileBookings} from './lib/bookings.mjs';
import {paymentPlan} from './lib/payment-plan.mjs';
import policy from './lib/booking-policy.cjs';
import pricing from './lib/pricing.cjs';
import {createSlots} from './lib/slots.mjs';
import {createStripe} from './lib/stripe.mjs';
import {createCheckout} from './checkout.mjs';
import {createPaymentStatus} from './paymentStatus.mjs';
import {createWebhook} from './webhook.mjs';
const origin='https://eywacoffeecatering.com';
export async function handle(request,env,ctx,displayCache){
 const url=new URL(request.url),route=url.pathname.replace(/^\/\.netlify\/functions\//,'/');
 const stripe=createStripe(env),slots=createSlots(env.DB),bookings=createBookings(env.DB),deps={...stripe,quote:async(q)=>{const c=await pricing.quote(q);return {...c,...quoteLines(q,c)};},getSlots:async()=>slots,getBookings:async()=>bookings,settings:env};
 const mailer=createMailer(env),quotes=quoteEmails(env,deps,mailer);deps.findQuote=quotes.find;deps.notifyPayment=paymentAutomation(env,stripe,mailer);
 const send=result=>new Response(result.statusCode===204?null:result.body,{status:result.statusCode,headers:result.headers});
 if(request.method==='OPTIONS')return send(stripe.json(204,{}));
 if(route==='/launch-offer'){
  if(request.method!=='GET')return send(stripe.json(405,{error:'Méthode non autorisée'}));
  const fresh=url.searchParams.get('fresh')==='1';
  const key=new Request(url.origin+'/launch-offer?version='+encodeURIComponent(env.EYWA_CACHE_VERSION||'v1'));
  if(!fresh&&displayCache){const saved=await displayCache.match(key);if(saved)return saved;}
  try{
   const status=await slots.status();
   if(env.EYWA_LAUNCH_ENABLED!=='true'){status.active=false;status.remaining=0;status.available=0;}
   else{await stripe.reconcile(slots);Object.assign(status,await slots.status());}
   const response=send(stripe.json(200,status));
   if(!fresh&&displayCache){const shared=response.clone();shared.headers.set('Cache-Control','public, max-age=60');ctx.waitUntil(displayCache.put(key,shared));}
   return response;
  }catch{return send(stripe.json(503,{error:'La disponibilité de l’offre n’a pas pu être vérifiée.'}));}
 }
 if(route==='/availability'){
  if(request.method!=='GET')return send(stripe.json(405,{error:'Méthode non autorisée'}));
  let from,to,dates;
  try{if(url.searchParams.has('date')){dates=url.searchParams.has('h')?policy.occupiedDays({d:url.searchParams.get('date'),dy:Number(url.searchParams.get('days')||1),h:url.searchParams.get('h'),ti:url.searchParams.get('ti')}):policy.eventDays(url.searchParams.get('date'),Number(url.searchParams.get('days')||1));from=dates[0];to=dates.at(-1);}else{from=url.searchParams.get('from');to=url.searchParams.get('to');if(!policy.validDate(from)||!policy.validDate(to)||to<from||to>policy.addDays(from,62))throw Error();}}
  catch(e){return send(stripe.json(400,{code:e.code||'INVALID_DATES',minDate:policy.minimumDate(),error:'Réservez au moins 3 jours à l’avance et choisissez des dates valides.'}));}
  try{await bookings.ready();await reconcileBookings(bookings,stripe.request);const blocked=await bookings.busy(from,to);return send(stripe.json(200,{minDate:policy.minimumDate(),blocked,available:blocked.length===0}));}catch{return send(stripe.json(503,{error:'Le calendrier est temporairement indisponible. Réessayez avant de réserver.'}));}
 }
 const event={httpMethod:request.method,headers:Object.fromEntries(request.headers),queryStringParameters:Object.fromEntries(url.searchParams),body:request.method==='GET'||request.method==='HEAD'?null:await request.text(),isBase64Encoded:false};
 if(route==='/quote-view'&&request.method==='GET')return quotes.view(url.searchParams.get('id'));
 if(route==='/quote-pdf'&&request.method==='GET'){
  const id=url.searchParams.get('id');if(!/^[a-f0-9-]{36}$/.test(id||''))return new Response('Devis introuvable',{status:404});
  const row=await env.DB.prepare('SELECT pdf_base64 FROM eywa_quote_pdfs WHERE quote_id=?').bind(id).first();
  if(!row)return new Response('Document en cours de préparation.',{status:503,headers:{'Cache-Control':'no-store'}});
  return new Response(Uint8Array.from(atob(row.pdf_base64),c=>c.charCodeAt(0)),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Devis-EYWA.pdf"','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}});
 }
 if(route==='/invoice'&&request.method==='GET')return invoiceResponse(env,url.searchParams.get('token'),url.searchParams.get('format')==='pdf');
 if(route==='/message-view'&&request.method==='GET'){
  const qid=url.searchParams.get('qid'),id=url.searchParams.get('message');if(!/^[a-f0-9-]{36}$/.test(qid||'')||String(id||'').length>250)return new Response('Message introuvable',{status:404});
  const a=await env.DB.prepare('SELECT payload_json FROM eywa_email_outbox WHERE id=? AND quote_id=?').bind(id,qid).first(),b=a?null:await env.DB.prepare('SELECT data_json FROM eywa_sync_events WHERE event_id=? AND quote_id=?').bind(id,qid).first();
  if(!a&&!b)return new Response('Message introuvable',{status:404});const m=JSON.parse(a?.payload_json||b.data_json);
  return new Response((m.subject||m.title||'Message EYWA')+'\n\n'+(m.text||''),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}});
 }
 if(route==='/followup-stop'){
  const id=url.searchParams.get('id');if(!await quotes.find(id))return new Response('Devis introuvable',{status:404});
  if(request.method==='POST'){await stopQuote(env,id);return new Response(null,{status:303,headers:{Location:'/followup-stop?id='+id+'&done=1','Cache-Control':'no-store'}});}
  if(request.method!=='GET')return new Response('Méthode non autorisée',{status:405});
  const state=await env.DB.prepare('SELECT status FROM eywa_quote_state WHERE quote_id=?').bind(id).first(),stopped=state?.status!=='open';
  return new Response('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Relances EYWA</title><body style="font:18px/1.6 Arial;background:#fffbef;color:#291817;max-width:640px;margin:60px auto;padding:24px"><h1>Vos relances EYWA</h1>'+(stopped?'<p>Les relances automatiques de ce devis sont arrêtées.</p>':'<p>Vous pouvez arrêter les relances de ce devis. Cela n’annule aucune réservation et ne modifie pas vos documents.</p><form method="post"><button style="font:inherit;padding:14px 20px;background:#BE957A;border:0;border-radius:6px">Arrêter les relances</button></form>')+'<p>Pour toute question : contact.eywa08@gmail.com</p></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
 }
 if(route==='/send-quote'){
  if(request.method!=='POST')return send(stripe.json(405,{error:'Méthode non autorisée'}));
  if(request.headers.get('Origin')!==origin)return send(stripe.json(403,{error:'Origine non autorisée'}));
  if(event.body.length>20000)return send(stripe.json(413,{error:'Demande trop volumineuse'}));
  let body;try{body=JSON.parse(event.body);}catch{return send(stripe.json(400,{error:'Demande invalide'}));}
  try{const result=await quotes.submit(request,body);if(result.statusCode===200)ctx.waitUntil(mailer.flush());return send(result);}catch{return send(stripe.json(503,{error:'Le devis n’a pas pu être enregistré. Réessayez.'}));}
 }
 if(route==='/quote-price'){
  if(request.method!=='POST')return send(stripe.json(405,{error:'Méthode non autorisée'}));
  if(request.headers.get('Origin')!==origin)return send(stripe.json(403,{error:'Origine non autorisée'}));
  try{const body=JSON.parse(event.body||'{}'),calculated=await pricing.quote(body.quote||{}),plan=paymentPlan(calculated,body,env);return send(stripe.json(200,plan));}
  catch(e){return send(stripe.json(400,{code:e.code||'INVALID_QUOTE',error:e.code==='CODE_INVALID'||e.code==='DATE_TOO_SOON'?e.message:'Le devis doit être recalculé avec un lieu et une date valides.'}));}
 }
 if(route==='/launch-checkout'){
  if(request.headers.get('Origin')!==origin)return send(stripe.json(403,{error:'Origine non autorisée'}));
  // Do not offer any payment flow before the old state has been imported.
  try{await slots.status();}catch{return send(stripe.json(503,{error:'Le paiement est temporairement indisponible.'}));}
  const result=await createCheckout(deps)(event);return send(result);
 }
 if(route==='/launch-payment-status'){const result=await createPaymentStatus(deps)(event);if(env.EYWA_AUTOMATION_ENABLED==='true')ctx.waitUntil(mailer.flush());return send(result);}
 if(route==='/launch-webhook'){const result=await createWebhook(deps)(event);if(result.statusCode===200&&env.EYWA_AUTOMATION_ENABLED==='true')ctx.waitUntil(mailer.flush());return send(result);}
 return send(stripe.json(404,{error:'Service introuvable'}));
}
export async function runAutomation(env){
 if(env.EYWA_AUTOMATION_ENABLED!=='true')return;
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v),now=Date.now();
 await sql('INSERT INTO eywa_job_locks(name,until_at) VALUES(?,0) ON CONFLICT DO NOTHING','automation').run();
 if(!await sql('UPDATE eywa_job_locks SET until_at=? WHERE name=? AND until_at<? RETURNING name',now+240000,'automation',now).first())return;
 try{
  const stripe=createStripe(env),bookings=createBookings(env.DB),mailer=createMailer(env),notion=createNotionSync(env),notify=paymentAutomation(env,stripe,mailer);
  await reconcileBookings(bookings,stripe.request);
  const pending=(await sql("SELECT b.session_id FROM eywa_bookings b WHERE b.state='paid' AND json_extract(b.details_json,'$.automationVersion')='20261109' AND (NOT EXISTS (SELECT 1 FROM eywa_invoices i WHERE i.session_id=b.session_id) OR NOT EXISTS (SELECT 1 FROM eywa_email_outbox e WHERE e.id='payment:'||b.session_id||':admin')) LIMIT 10").all()).results;
  for(const row of pending){try{await notify(await stripe.request('checkout/sessions/'+encodeURIComponent(row.session_id)));}catch{/* Retry next scheduled execution; do not alter payment state. */}}
  try{await notion.refreshStops();}catch{/* Email delivery continues; Notion retries separately. */}
  await queueFollowups(env,mailer);await mailer.flush();
  try{await syncGmail(env);}catch{/* Keep the previous cursor for a safe retry. */}
  await notion.flush();
 }finally{await sql('UPDATE eywa_job_locks SET until_at=0 WHERE name=?','automation').run();}
}
export default {fetch:(request,env,ctx)=>handle(request,env,ctx,caches.default),scheduled:(_event,env,ctx)=>ctx.waitUntil(runAutomation(env))};
