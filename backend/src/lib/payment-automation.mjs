import {paymentMail} from './mail-templates.mjs';
import {stopQuote} from './followups.mjs';
import {emailAddress} from './quote-emails.mjs';
import {createInvoice,invoiceNumber,invoiceURL,invoiceHTML} from './invoices.mjs';
export function paymentAutomation(env,stripe,mailer){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 return async function notify(session){
  if(env.EYWA_AUTOMATION_ENABLED!=='true')return;
  if(session.payment_status!=='paid'||session.currency!=='eur')return;
  const booking=await sql("SELECT * FROM eywa_bookings WHERE session_id=? AND state='paid'",session.id).first();
  if(!booking||booking.payable_cents!==session.amount_total)return;
  const details=JSON.parse(booking.details_json||'{}');if(details.automationVersion!=='20261109')return;const qid=details.quoteId||session.metadata?.eywa_quote;
  // Stop follow-ups first. Email/invoice failures must not resume reminders.
  if(qid)await stopQuote(env,qid,'paid',session.id);
  const saved=qid?await sql('SELECT data_json FROM eywa_quotes WHERE id=?',qid).first():null;
  const q={...(saved?JSON.parse(saved.data_json):{}),...details.eventSummary};
  const expanded=await stripe.request('checkout/sessions/'+encodeURIComponent(session.id)+'?expand[]=payment_intent.latest_charge');
  const email=emailAddress(expanded.customer_details?.email||expanded.customer_email||q.email);
  const paidCents=booking.payable_cents,balanceCents=Number(expanded.metadata?.balance_cents??session.metadata?.balance_cents??0),totalCents=paidCents+balanceCents;
  if(!Number.isSafeInteger(balanceCents)||balanceCents<0)throw Error('INVALID_PAYMENT_BALANCE');
  let lines=(q.lineItems||[]).map(l=>({...l,cents:l.normalCents}));
  if(!lines.length)lines=[{title:'Coffee bar, options et déplacement selon devis',cents:totalCents}];
  const normal=lines.reduce((n,l)=>n+l.cents,0);
  if(normal!==totalCents)lines.push({title:'Réduction appliquée à la réservation',description:booking.payment_kind==='full_special'?'Code avantage accepté avant règlement':'Offre acceptée avant règlement',cents:totalCents-normal});
  const data={...q,quoteId:qid||null,reference:q.reference||'EYWA-'+booking.id.slice(0,8).toUpperCase(),email,name:q.name||details.contactName,firstName:q.firstName||details.contactName,billingName:details.billingName||expanded.customer_details?.name,billingAddress:expanded.customer_details?.address||{},phone:details.phone,date:q.date||booking.start_date,location:details.address,hours:q.hours||'À préciser',days:q.days||1,guests:q.guests||'À préciser',totalCents,paidCents,balanceCents,lines,paymentDate:new Date((expanded.payment_intent?.latest_charge?.created||Date.parse(booking.paid_at)/1000||Date.now()/1000)*1000).toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'}),setupLocation:details.setupLocation,parking:details.unloadParking};
  const invoice=await createInvoice(env,booking,data),link=invoiceURL(invoice);
  data.invoiceUrl=link+'&format=pdf';
  for(const [role,to] of [['client',email],['admin','contact.eywa08@gmail.com']]){
   const payload={...paymentMail(data,role==='admin'),invoice:{token:invoice.token,filename:invoiceNumber(invoice)+'.pdf',html:invoiceHTML(invoice)}};
   await mailer.enqueue('payment:'+session.id+':'+role,to,payload,qid,'payment');
  }
  if(qid)await sql('UPDATE eywa_notion_jobs SET version=version+1 WHERE quote_id=?',qid).run();
 };
}
