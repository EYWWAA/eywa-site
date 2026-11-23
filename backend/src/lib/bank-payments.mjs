import {randomBytes} from 'node:crypto';
import {emailAddress} from './quote-emails.mjs';
import {escape as e,money,shell,paymentMail} from './mail-templates.mjs';
import {createBookings} from './bookings.mjs';
import {createInvoice,invoiceHTML,invoiceURL,invoiceNumber} from './invoices.mjs';
import {stopQuote,expireOverlapping} from './followups.mjs';
import {createMailer} from './mail-delivery.mjs';
import terms from './payment-terms.cjs';
const ORIGIN='https://eywa-booking.eywa-booking-cloudflare.workers.dev';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src https://eywacoffeecatering.com; base-uri 'none'; frame-ancestors 'none'"};
export function bankDetails(env){try{const b=JSON.parse(env.EYWA_BANK_DETAILS||'null');return b&&/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(b.iban)&&/^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$/.test(b.bic)&&b.holder?b:null;}catch{return null;}}
export function bankURL(token){return ORIGIN+'/bank-request?token='+token;}
function bankRows(b,reference){return [['Titulaire',b.holder],['IBAN',b.iban.replace(/(.{4})/g,'$1 ').trim()],['BIC',b.bic],['Référence du virement',reference]];}
export function prepareBank(env,details,savedQuote,now=Date.now()){
 const bank=bankDetails(env);if(!bank)fail('Le virement bancaire est temporairement indisponible.',503);
 let email;try{email=emailAddress(savedQuote?.email||details.billingEmail);}catch{fail('Indiquez votre adresse e-mail pour recevoir les instructions de virement.');}
 return {token:randomBytes(32).toString('hex'),expiresAt:now+48*3600000,email,account:bank};
}
export function createBankPayments(env,mailer=createMailer(env)){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 async function find(token){if(!/^[a-f0-9]{64}$/.test(token||''))fail('Document introuvable.',404);const r=await sql("SELECT * FROM eywa_bookings WHERE json_extract(details_json,'$.bank.token')=?",token).first();if(!r)fail('Document introuvable.',404);return r;}
 async function requested(booking,calculated,plan,details,saved){
  const reference='EYWA-'+booking.id.slice(0,8).toUpperCase(),b=details.bank;
  const text='Votre date est retenue provisoirement pendant 48 heures. La réservation sera confirmée après réception et vérification de votre acompte. Si le virement ne peut pas arriver dans ce délai, contactez-nous avant de le faire.';
  for(const [role,to] of [['client',b.email],['admin','contact.eywa08@gmail.com']])await mailer.enqueue('bank-request:'+booking.id+':'+role,to,{subject:role==='admin'?'Virement attendu EYWA — '+details.contactName:'Votre demande d’acompte EYWA',...shell({heading:role==='admin'?'Un virement à vérifier.':'Votre réservation par virement.',intro:text,rows:[['Date',details.eventSummary.date],['Client',details.contactName],['Échéance du solde',details.eventSummary.date],...bankRows(b.account,reference)],amount:plan.payableCents,amountLabel:plan.payableCents===plan.totalCents?'Montant à virer':'Acompte de 50 % à virer',buttons:[[role==='admin'?'Ouvrir mon espace EYWA':'Voir la demande d’acompte',role==='admin'?ORIGIN+'/espace/':bankURL(b.token)]],note:'Le virement doit porter la référence '+reference+'. Aucun prélèvement automatique ne sera effectué.'})},saved?.id||null,'bank-request');
  return {url:bankURL(b.token),paymentMethod:'bank_transfer'};
 }
 async function pending(){return (await sql("SELECT id,details_json,payable_cents,start_date FROM eywa_bookings WHERE state='held' AND session_id LIKE 'bank:%' ORDER BY created_at DESC LIMIT 100").all()).results.map(r=>{const d=JSON.parse(r.details_json);return {id:r.id,name:d.contactName,email:d.bank.email,date:r.start_date,amount:r.payable_cents,expiresAt:d.bank.expiresAt,url:bankURL(d.bank.token)};});}
 async function notify(row){
  const d=JSON.parse(row.details_json),qid=d.quoteId,qrow=qid?await sql('SELECT data_json FROM eywa_quotes WHERE id=?',qid).first():null,q={...(qrow?JSON.parse(qrow.data_json):{}),...d.eventSummary};
  const bank=d.bank,totalCents=bank.totalCents,balanceCents=totalCents-row.payable_cents;
  let lines=(q.lineItems||[]).map(l=>({...l,cents:l.normalCents}));if(!lines.length)lines=[{title:'Boissons chaudes et personnalisations',cents:totalCents}];
  const normal=lines.reduce((n,l)=>n+l.cents,0);if(normal!==totalCents)lines.push({title:'Réduction appliquée',cents:totalCents-normal});
  const data={...q,name:q.name||d.contactName,firstName:q.firstName||d.contactName,email:bank.email,billingName:d.billingName,billingAddress:{},quoteId:qid||null,reference:q.reference||'EYWA-'+row.id.slice(0,8).toUpperCase(),date:row.start_date,location:d.address,totalCents,paidCents:row.payable_cents,balanceCents,lines,paymentDate:new Date(row.paid_at).toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'}),paymentMethod:'bank_transfer',paymentSchedule:terms.SCHEDULE,balanceDueDate:row.start_date,bankDetails:bank.account};
  if(qid)await stopQuote(env,qid,'paid',row.session_id);await expireOverlapping(env,row.start_date,row.end_date,qid);
  const invoice=await createInvoice(env,row,data);data.invoiceUrl=invoiceURL(invoice)+'&format=pdf';
  for(const [role,to]of [['client',bank.email],['admin','contact.eywa08@gmail.com']])await mailer.enqueue('payment:'+row.session_id+':'+role,to,{...paymentMail(data,role==='admin'),invoice:{token:invoice.token,filename:invoiceNumber(invoice)+'.pdf',html:invoiceHTML(invoice)}},qid,'payment');
  if(qid)await sql('UPDATE eywa_notion_jobs SET version=version+1 WHERE quote_id=?',qid).run();
 }
 async function confirm(id){
  const row=await sql("SELECT * FROM eywa_bookings WHERE id=? AND session_id LIKE 'bank:%'",id).first();if(!row)fail('Demande de virement introuvable.',404);
  if(!['held','paid'].includes(row.state))fail('Cette demande a expiré. Vérifiez la disponibilité et le paiement avec le client avant toute nouvelle réservation.',409);
  const ok=await createBookings(env.DB).paid({id:row.session_id,payment_status:'paid',currency:'eur',amount_total:row.payable_cents,metadata:{eywa_booking:id}});if(!ok)fail('La demande ne peut plus être confirmée.',409);
  await notify(await sql('SELECT * FROM eywa_bookings WHERE id=?',id).first());return {ok:true};
 }
 async function reconcile(now=Date.now()){
  await env.DB.batch([
   sql("DELETE FROM eywa_booking_days WHERE booking_id IN (SELECT id FROM eywa_bookings WHERE state='held' AND session_id LIKE 'bank:%' AND json_extract(details_json,'$.bank.expiresAt')<=?)",now),
   sql("UPDATE eywa_bookings SET state='released' WHERE state='held' AND session_id LIKE 'bank:%' AND json_extract(details_json,'$.bank.expiresAt')<=?",now)
  ]);
  const paid=(await sql("SELECT b.* FROM eywa_bookings b WHERE state='paid' AND session_id LIKE 'bank:%' AND NOT EXISTS (SELECT 1 FROM eywa_email_outbox e WHERE e.id='payment:'||b.session_id||':admin') LIMIT 5").all()).results;
  for(const row of paid)await notify(row);
 }
 async function view(token){
  try{const row=await find(token),d=JSON.parse(row.details_json),b=d.bank;if(row.state==='released')return new Response('<h1>Cette demande a expiré.</h1><p>Contactez EYWA avant de faire un virement pour vérifier la disponibilité.</p>',{status:410,headers});
   const reference='EYWA-'+row.id.slice(0,8).toUpperCase();
   const content=shell({heading:row.state==='paid'?'Votre virement est confirmé.':'Demande d’acompte · Proforma',intro:row.state==='paid'?'Votre réservation est confirmée. La facture est envoyée par e-mail.':'Ce document présente le règlement attendu et ne constitue pas une facture acquittée. La date est retenue pendant 48 heures ; la confirmation est envoyée après vérification de la réception du virement.',rows:[['Événement',row.start_date],['Facturation',d.billingName],['Total du devis',money(b.totalCents)],['Solde après cet acompte',money(b.totalCents-row.payable_cents)],...bankRows(b.account,reference)],amount:row.payable_cents,amountLabel:row.state==='paid'?'Montant reçu':'Montant à virer',buttons:[],note:'Référence à indiquer : '+reference+'. Un virement effectué après expiration nécessite une nouvelle vérification de disponibilité. Contact : contact.eywa08@gmail.com.'});
   return new Response(content.html,{headers});
  }catch(error){return new Response('Document introuvable.',{status:error.status||503,headers});}
 }
 async function confirmBalance(token){
  const row=await sql("SELECT * FROM eywa_invoices WHERE token=? AND json_extract(data_json,'$.kind')='balance'",token).first();if(!row)fail('Facture de solde introuvable.',404);
  const data=JSON.parse(row.data_json);if(!Number.isSafeInteger(data.balanceCents)||data.balanceCents<1)fail('Montant de solde invalide.');
  await sql('INSERT INTO eywa_balance_payments(token,session_id,amount_cents,paid_at) VALUES(?,?,?,?) ON CONFLICT(token) DO NOTHING',token,'bank:'+token,data.balanceCents,Date.now()).run();if(row.quote_id)await sql('UPDATE eywa_notion_jobs SET version=version+1 WHERE quote_id=?',row.quote_id).run();return {ok:true};
 }
 return {requested,pending,confirm,reconcile,view,confirmBalance};
}
