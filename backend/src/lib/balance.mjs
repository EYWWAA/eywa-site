import {bankDetails} from './bank-payments.mjs';
import {bankBlock,bankCSP} from './bank-block.mjs';
// Contrats du 23/11 : facture à J-7, solde au jour J.
// Les anciens contrats conservent l'envoi après événement et le délai de 30 jours.
import terms from './payment-terms.cjs';
import policy from './booking-policy.cjs';
import {randomBytes} from 'node:crypto';
import {shell,money} from './mail-templates.mjs';
import {invoiceNumber,invoiceURL,invoiceHTML} from './invoices.mjs';

export const BALANCE_DAYS=30;
// Seules les réservations payées après la mise en ligne reçoivent une facture de solde automatique,
// pour ne jamais en envoyer sur d'anciennes réservations de test.
export const BALANCE_START=Date.parse('2026-11-21T00:00:00Z');
const WORKER='https://eywa-booking.eywa-booking-cloudflare.workers.dev';
const parisDay=ms=>new Date(ms).toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});
const frDate=ms=>new Date(ms).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Paris'});
export const balancePayURL=token=>WORKER+'/balance-pay?token='+token;

export function balanceMail(q,admin=false){
 return {subject:(admin?'Facture de solde envoyée — '+(q.name||'client'):'Votre facture de solde Eywa').replace(/[\r\n]+/g,' ').slice(0,220),...shell({
  heading:admin?'Facture de solde envoyée.':q.paymentSchedule===terms.SCHEDULE?'Le solde de votre réservation.':'Merci pour votre événement.',
  intro:q.paymentSchedule===terms.SCHEDULE?(admin?'La facture de solde a été adressée au client.':'Bonjour '+(q.firstName||'')+', voici votre facture de solde, déduction faite de votre acompte.')+' Le règlement est attendu au plus tard le '+q.dueDate+', avant le début du service.':admin?'La facture de solde est partie chez le client. Elle est payable sous 30 jours.':'Bonjour '+(q.firstName||'')+', merci encore de nous avoir fait confiance. Voici la facture de solde, déduction faite de votre acompte. Elle est payable sous 30 jours.',
  rows:[['Facture',q.number],['Échéance',q.dueDate]],amount:q.balanceCents,amountLabel:'Reste à payer',
  buttons:[['Payer le solde',q.payUrl],['Télécharger la facture',q.invoiceUrl]],
  note:q.bankTransfer?'Paiement par carte bancaire ou par virement depuis le lien ci-dessus.':'Paiement par carte bancaire depuis le lien ci-dessus.'})};
}

export async function queueBalanceInvoices(env,mailer,now=Date.now()){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 const deposits=(await sql("SELECT i.* FROM eywa_invoices i JOIN eywa_bookings b ON b.session_id=i.session_id WHERE b.state='paid' AND ((json_extract(i.data_json,'$.paymentSchedule')=? AND b.start_date<=?) OR (COALESCE(json_extract(i.data_json,'$.paymentSchedule'),'')<>? AND b.end_date<?)) AND i.created_at>=? AND json_extract(i.data_json,'$.kind') IS NULL AND json_extract(i.data_json,'$.balanceCents')>0 AND NOT EXISTS (SELECT 1 FROM eywa_invoices s WHERE s.session_id='balance:'||i.session_id) LIMIT 10",terms.SCHEDULE,policy.addDays(parisDay(now),7),terms.SCHEDULE,parisDay(now),BALANCE_START).all()).results;
 for(const dep of deposits){
  const q=JSON.parse(dep.data_json),token=randomBytes(32).toString('hex');
  const data={...q,kind:'balance',bankTransfer:!!bankDetails(env)||env.EYWA_BANK_TRANSFER==='true',bankDetails:q.bankDetails||bankDetails(env),depositNumber:invoiceNumber(dep),depositDate:q.paymentDate,dueDate:q.paymentSchedule===terms.SCHEDULE?frDate(Date.parse((q.balanceDueDate||q.date)+'T12:00:00Z')):frDate(now+BALANCE_DAYS*86400000),payUrl:balancePayURL(token)};
  await sql('INSERT INTO eywa_invoices(token,session_id,quote_id,data_json,created_at) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM eywa_invoices WHERE session_id=?)',token,'balance:'+dep.session_id,dep.quote_id,JSON.stringify(data),now,'balance:'+dep.session_id).run();
  const row=await sql('SELECT * FROM eywa_invoices WHERE session_id=?','balance:'+dep.session_id).first();
  const saved={...JSON.parse(row.data_json),number:invoiceNumber(row),invoiceUrl:invoiceURL(row)+'&format=pdf'};
  for(const [role,to] of [['client',saved.email],['admin','contact.eywa08@gmail.com']]){
   if(!to)continue;
   await mailer.enqueue('balance:'+dep.session_id+':'+role,to,{...balanceMail(saved,role==='admin'),invoice:{token:row.token,filename:saved.number+'.pdf',html:invoiceHTML(row)}},dep.quote_id,'balance');
  }
 }
}

// Lien de paiement du solde : crée une session Stripe à la demande (carte ou virement).
export async function balanceCheckout(env,request,token,method='choose'){
 if(!/^[a-f0-9]{64}$/.test(token||''))return new Response('Lien invalide',{status:404});
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 const row=await sql("SELECT * FROM eywa_invoices WHERE token=? AND json_extract(data_json,'$.kind')='balance'",token).first();
 if(!row)return new Response('Facture introuvable',{status:404});
 if(await sql('SELECT 1 FROM eywa_balance_payments WHERE token=?',token).first())return new Response('Cette facture est déjà réglée. Merci !',{headers:{'Content-Type':'text/plain; charset=utf-8'}});
 const q=JSON.parse(row.data_json),bank=q.bankDetails||bankDetails(env);
 if(method!=='card'&&bank){const page=shell({heading:'Le solde de votre réservation.',intro:'Vous pouvez effectuer un virement avec les coordonnées ci-dessous ou régler par carte. Le règlement par virement sera validé après vérification de sa réception.',rows:[['Échéance',q.dueDate]],extra:bankBlock({bank,amountCents:q.balanceCents}),amount:q.balanceCents,amountLabel:'Solde à régler',buttons:[['Régler par carte',balancePayURL(token)+'&method=card']],note:''});return new Response(page.html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Security-Policy':bankCSP}});}
 const session=await request('checkout/sessions','POST',{
  mode:'payment',locale:'fr','payment_method_types[0]':'card',
  customer_creation:'always',...(q.email?{customer_email:q.email}:{}),
  'line_items[0][price_data][currency]':'eur','line_items[0][price_data][unit_amount]':String(q.balanceCents),'line_items[0][quantity]':'1',
  'line_items[0][price_data][product_data][name]':'Solde, facture N° '+invoiceNumber(row),
  success_url:invoiceURL(row),cancel_url:invoiceURL(row),'metadata[eywa_balance]':token
 },'eywa-balance-'+token+'-'+parisDay(Date.now()));
 return Response.redirect(session.url,303);
}

export async function recordBalancePayment(env,session){
 const token=session.metadata?.eywa_balance;
 if(!token||session.payment_status!=='paid')return false;
 const row=await env.DB.prepare("SELECT data_json FROM eywa_invoices WHERE token=? AND json_extract(data_json,'$.kind')='balance'").bind(token).first();
 if(!row||JSON.parse(row.data_json).balanceCents!==session.amount_total)return false;
 await env.DB.prepare('INSERT INTO eywa_balance_payments(token,session_id,amount_cents,paid_at) VALUES(?,?,?,?) ON CONFLICT(token) DO NOTHING').bind(token,session.id,session.amount_total,Date.now()).run();
 return true;
}
