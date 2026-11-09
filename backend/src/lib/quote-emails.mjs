import {registerQuote} from './followups.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {quoteMail} from './mail-templates.mjs';
export const apiOrigin='https://eywa-booking.eywa-booking-cloudflare.workers.dev';
export function emailAddress(value){const email=String(value||'').trim();if(email.length>254||!/^([^\s@<>]+)@([^\s@<>]+)\.([^\s@<>]+)$/.test(email))throw Error('Indiquez une adresse e-mail valide.');return email;}
export function quoteEmails(env,deps,mailer){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 async function find(id){if(!/^[0-9a-f-]{36}$/.test(id||''))return null;const row=await sql('SELECT data_json FROM eywa_quotes WHERE id=?',id).first();return row?JSON.parse(row.data_json):null;}
 async function submit(request,body){
  if(env.EYWA_AUTOMATION_ENABLED!=='true'||!env.EYWA_MAIL_RELAY_URL||!env.EYWA_MAIL_RELAY_SECRET)return deps.json(503,{error:'L’envoi du devis est temporairement indisponible. Réessayez ou contactez EYWA.'});
  let email,contact,q,key;try{
   contact=body.contact||{};email=emailAddress(contact.email);q=body.quote||{};key=String(body.requestId||'');
   if(!/^[0-9a-f-]{36}$/.test(key))throw Error('Demande invalide.');
   for(const [name,value]of Object.entries(contact))if(typeof value!=='string'||value.length>(name==='details'?2000:250))throw Error('Coordonnées invalides.');
   if(!contact.firstName?.trim()||!contact.lastName?.trim())throw Error('Complétez votre nom.');
  }catch(e){return deps.json(400,{error:e.message});}
  const existing=await sql('SELECT data_json FROM eywa_quotes WHERE request_key=?',key).first();
  if(existing){const data=JSON.parse(existing.data_json);if(data.email!==email)return deps.json(409,{error:'Demande invalide.'});await registerQuote(env,data,data.createdAt);return deps.json(200,{id:data.id,url:data.quoteUrl,queued:true});}
  const stamp=new Date().toISOString().slice(0,13),ip=request.headers.get('CF-Connecting-IP')||'local';
  const buckets=[['ip',ip,10],['email',email.toLowerCase(),3]];
  for(const[type,value,max]of buckets){const bucket=type+':'+stamp+':'+createHash('sha256').update(value).digest('hex');const r=await sql('INSERT INTO eywa_email_limits(bucket,count) VALUES(?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count',bucket).first();if(r.count>max)return deps.json(429,{error:'Plusieurs demandes ont déjà été reçues. Réessayez plus tard ou contactez EYWA.'});}
  let calculated;try{calculated=await deps.quote(q);}catch{return deps.json(400,{error:'Vérifiez le lieu, la date et les détails de votre événement.'});}
  let launch=false;if(body.offer===true&&env.EYWA_LAUNCH_ENABLED==='true'){try{const slots=await deps.getSlots();await deps.reconcile(slots);launch=(await slots.status()).active;}catch{return deps.json(503,{error:'Le tarif ne peut pas être vérifié. Réessayez.'});}}
  const totalCents=launch?calculated.discountedCents:calculated.normalCents;
  const id=randomUUID(),params=new URLSearchParams();
  for(const k of ['g','h','dy','d','ti','l','lat','lng','country','tk','tm','tw','to','lf','ta','t','p','options'])if(q[k]!==undefined)params.set(k,typeof q[k]==='object'?JSON.stringify(q[k]):String(q[k]));
  params.set('qid',id);params.set('pr',calculated.normalCents/100);params.set('v','20261109-automatisation');
  let options=[];try{options=typeof q.options==='string'?JSON.parse(q.options):q.options||[];}catch{}
  const data={id,createdAt:Date.now(),followupConsent:body.followupConsent===true,consentVersion:body.followupConsent===true?'quote-followup-20261109':null,reference:'EYWA-'+id.slice(0,8).toUpperCase(),email,name:(contact.firstName+' '+contact.lastName).trim(),firstName:contact.firstName.trim(),phone:contact.phone||'',company:contact.company||'',details:contact.details||'',eventType:String(q.t||'Votre événement').slice(0,250),date:q.d,time:q.ti,location:String(q.l||'Lieu à confirmer').slice(0,500),guests:Number(q.g),hours:Number(q.h),days:Number(q.dy||1),options,lineItems:calculated.lineItems,staff:calculated.staff,normalCents:calculated.normalCents,normalTravelCents:Math.round(calculated.travel.total*100),totalCents,travelCents:Math.round(calculated.travel.total*100*(launch?0.2:1)),launch,quoteUrl:'https://eywacoffeecatering.com/devis.html?'+params,documentUrl:apiOrigin+'/quote-view?id='+id};
  // Store the quote and both email jobs atomically, so a request retry can never lose a message.
  const now=Date.now(),jobs=[['quote:'+id+':client',email,{...quoteMail(data),quoteDocument:{quoteId:id,filename:'Devis-'+data.reference+'.pdf',html:quoteMail(data,false,{document:true}).html}}],['quote:'+id+':admin','contact.eywa08@gmail.com',quoteMail(data,true)]];
  try{await env.DB.batch([sql('INSERT INTO eywa_quotes(id,request_key,data_json,created_at) VALUES(?,?,?,?)',id,key,JSON.stringify(data),now),...jobs.map(([job,to,payload])=>sql("INSERT INTO eywa_email_outbox(id,recipient,payload_json,created_at,quote_id,kind) VALUES(?,?,?,?,?,'quote')",job,to,JSON.stringify(payload),now,id))]);}
  catch(e){const row=await sql('SELECT data_json FROM eywa_quotes WHERE request_key=?',key).first();if(!row)throw e;const stored=JSON.parse(row.data_json);if(stored.email!==email)return deps.json(409,{error:'Demande invalide.'});await registerQuote(env,stored,stored.createdAt);return deps.json(200,{id:stored.id,url:stored.quoteUrl,queued:true});}
  await registerQuote(env,data,data.createdAt);
  return deps.json(200,{id,url:data.quoteUrl,queued:true});
 }
 async function view(id){const q=await find(id);if(!q)return new Response('Devis introuvable',{status:404});const page=quoteMail(q,false,{document:true});return new Response(page.html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src https://eywacoffeecatering.com; base-uri 'none'; frame-ancestors 'none'"}});}
 return {find,submit,view};
}
