import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {database,bookingDetails,quote,request,context} from './booking.test.mjs';
import {createBankPayments,prepareBank} from '../src/lib/bank-payments.mjs';
import {createMailer} from '../src/lib/mail-delivery.mjs';
import {createBookings} from '../src/lib/bookings.mjs';
import {handle} from '../src/worker.mjs';
import {queueBalanceInvoices} from '../src/lib/balance.mjs';
import {invoiceHTML} from '../src/lib/invoices.mjs';
const account={holder:'Compte fictif de contrôle',iban:'FR7630006000011234567890189',bic:'AGRIFRPPXXX'};
function setup(){const DB=database();for(const file of ['0003_transactional_email.sql','0004_automation.sql','0006_balance_invoices.sql','0016_quote_expiry.sql'])DB.raw.exec(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));return {DB,EYWA_LAUNCH_ENABLED:'false',EYWA_BANK_DETAILS:JSON.stringify(account)};}
async function start(env,date='2027-11-15'){
 const res=await handle(request('launch-checkout','POST',{quote:{...quote,d:date},bookingDetails:{...bookingDetails,billingEmail:'client@example.invalid'},expectedCents:15000,paymentMethod:'bank_transfer'}),env,context());
 assert.equal(res.status,200,await res.clone().text());return res.json();
}
test('bank transfer holds the date without pretending it is paid, never calls Stripe and confirms once after owner verification',async()=>{
 const env=setup(),original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('No real payment or email permitted');};
 try{
  const plan=await (await handle(request('quote-price','POST',{quote}),env,context())).json();assert.equal(plan.bankAvailable,true);assert(!JSON.stringify(plan).includes(account.iban));
  const result=await start(env);assert.equal(new URL(result.url).pathname,'/bank-request');
  const row=env.DB.raw.prepare('SELECT * FROM eywa_bookings').get();assert.equal(row.state,'held');assert(row.session_id.startsWith('bank:'));assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_invoices').get().n,0);
  assert.equal((await createBookings(env.DB).stale()).length,0,'pending bank requests are not sent to Stripe reconciliation');
  const bank=createBankPayments(env,createMailer(env)),pending=await bank.pending();assert.equal(pending.length,1);
  const page=await bank.view(new URL(result.url).searchParams.get('token'));assert((await page.text()).includes('Proforma'));
  await bank.confirm(row.id);await bank.confirm(row.id);
  assert.equal(env.DB.raw.prepare('SELECT state FROM eywa_bookings').get().state,'paid');assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_invoices').get().n,1);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM eywa_email_outbox WHERE kind='payment'").get().n,2);
  const invoice=env.DB.raw.prepare('SELECT * FROM eywa_invoices').get(),q=JSON.parse(invoice.data_json);assert.equal(q.paidCents,15000);assert.equal(q.balanceCents,15000);assert.equal(q.balanceDueDate,'2027-11-15');assert(invoiceHTML(invoice).includes('Virement bancaire'));
 }finally{globalThis.fetch=original;env.DB.raw.close();}
});
test('an expired bank request releases its provisional dates and cannot confirm a date subsequently sold',async()=>{
 const env=setup();try{const result=await start(env),row=env.DB.raw.prepare('SELECT * FROM eywa_bookings').get(),d=JSON.parse(row.details_json),bank=createBankPayments(env,createMailer(env));await bank.reconcile(d.bank.expiresAt+1);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_booking_days').get().n,0);await assert.rejects(()=>bank.confirm(row.id),e=>e.status===409);assert.equal((await bank.view(new URL(result.url).searchParams.get('token'))).status,410);}finally{env.DB.raw.close();}
});
test('new balances are issued before the event, due on its first day, with a bank receipt recorded once',async()=>{
 const env=setup();try{await start(env);const row=env.DB.raw.prepare('SELECT * FROM eywa_bookings').get(),mailer=createMailer(env),bank=createBankPayments(env,mailer);await bank.confirm(row.id);
  await queueBalanceInvoices(env,mailer,Date.parse('2027-11-07T12:00:00Z'));assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_invoices').get().n,1);
  await queueBalanceInvoices(env,mailer,Date.parse('2027-11-08T12:00:00Z'));await queueBalanceInvoices(env,mailer,Date.parse('2027-11-09T12:00:00Z'));
  const balance=env.DB.raw.prepare("SELECT * FROM eywa_invoices WHERE json_extract(data_json,'$.kind')='balance'").get();assert(balance);const html=invoiceHTML(balance);assert(html.includes('15 nov. 2027'));assert(!html.includes('Payable sous 30 jours'));assert(html.includes('IBAN'));assert(html.includes(account.holder));
  await bank.confirmBalance(balance.token);await bank.confirmBalance(balance.token);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_balance_payments').get().n,1);
 }finally{env.DB.raw.close();}
});
test('bank details are never accepted from a visitor and owner confirmation requires a CRM session',async()=>{
 const env=setup();try{const details=prepareBank(env,{...bookingDetails,billingEmail:'client@example.invalid'},null);assert.equal(details.account.iban,account.iban);await assert.rejects(async()=>prepareBank({},bookingDetails,null),e=>e.status===503);
  const result=await handle(new Request('https://test.example/espace/api/action',{method:'POST',headers:{Origin:'https://test.example','Content-Type':'application/json'},body:JSON.stringify({action:'bank-paid',id:'untrusted'})}),env,context());assert.equal(result.status,401);
 }finally{env.DB.raw.close();}
});
