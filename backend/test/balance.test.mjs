import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {database} from './booking.test.mjs';
import {queueBalanceInvoices,recordBalancePayment,balanceCheckout,BALANCE_START} from '../src/lib/balance.mjs';
import {invoiceHTML} from '../src/lib/invoices.mjs';
function setup(){const DB=database();for(const name of ['0002_booking_calendar.sql','0003_transactional_email.sql','0004_automation.sql','0016_quote_expiry.sql','0006_balance_invoices.sql'])DB.raw.exec(fs.readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));return {DB};}
const lines=[{title:'Formule de base',cents:30000},{title:'Déplacement aller-retour',cents:17644},{title:'Habillage du bar',cents:20000,personalization:true},{title:'Gobelets sur mesure',cents:20000,personalization:true},{title:'Impression accélérée des gobelets',cents:5000,personalization:true}];
async function seed(env,{end='2026-12-02',created=BALANCE_START+1000}={}){
 await env.DB.prepare("INSERT INTO eywa_bookings(id,session_id,state,start_date,end_date,normal_cents,payable_cents,payment_kind,paid_at) VALUES('b1','cs_1','paid',?,?,92644,46322,'deposit','2026-11-21T09:00:00Z')").bind(end,end).run();
 await env.DB.prepare('INSERT INTO eywa_invoices(token,session_id,quote_id,data_json,created_at) VALUES(?,?,?,?,?)').bind('a'.repeat(64),'cs_1','q1',JSON.stringify({name:'Léa Corblin',firstName:'Léa',email:'lea@example.com',billingName:'Publicis Consultants France',date:end,location:'Lille',guests:20,hours:1.5,days:1,paymentDate:'21/11/2026',totalCents:92644,paidCents:46322,balanceCents:46322,reference:'EYWA-00CFD9C8',lines}),created).run();
}
const mailer=()=>{const sent=[];return {sent,enqueue:async(id,to,payload)=>sent.push({id,to,payload})};};
test('the balance invoice is sent the day after the event, payable within 30 days, deducting the deposit',async()=>{
 const env=setup();await seed(env);const m=mailer();
 await queueBalanceInvoices(env,m,Date.parse('2026-12-02T20:00:00Z'));assert.equal(m.sent.length,0,'not before the event is over');
 await queueBalanceInvoices(env,m,Date.parse('2026-12-03T08:00:00Z'));
 assert.deepEqual(m.sent.map(x=>x.to),['lea@example.com','contact.eywa08@gmail.com']);
 await queueBalanceInvoices(env,m,Date.parse('2026-12-04T08:00:00Z'));assert.equal(m.sent.length,2,'only once');
 const row=await env.DB.prepare("SELECT * FROM eywa_invoices WHERE session_id='balance:cs_1'").bind().first(),html=invoiceHTML(row);
 for(const v of ['Facture de solde','Reste à payer','463,22','926,44','EYWA-WEB-','2 janv. 2027','/balance-pay?token='])assert(html.includes(v),v);
 assert(!/prestation|forfait\b|animation/i.test(html));
});
test('old test bookings never get an automatic balance invoice',async()=>{
 const env=setup();await seed(env,{created:BALANCE_START-1000});const m=mailer();
 await queueBalanceInvoices(env,m,Date.parse('2026-12-03T08:00:00Z'));assert.equal(m.sent.length,0);
});
test('a balance payment is recorded once, only for the exact amount, and the link then stops charging',async()=>{
 const env=setup();await seed(env);const m=mailer();await queueBalanceInvoices(env,m,Date.parse('2026-12-03T08:00:00Z'));
 const row=await env.DB.prepare("SELECT token FROM eywa_invoices WHERE session_id='balance:cs_1'").bind().first();
 assert.equal(await recordBalancePayment(env,{id:'cs_b',payment_status:'paid',amount_total:100,metadata:{eywa_balance:row.token}}),false);
 assert.equal(await recordBalancePayment(env,{id:'cs_b',payment_status:'paid',amount_total:46322,metadata:{eywa_balance:row.token}}),true);
 let called=false;const res=await balanceCheckout(env,async()=>{called=true;return {url:'https://checkout.stripe.com/x'};},row.token);
 assert.equal(called,false);assert.match(await res.text(),/déjà réglée/);
});
test('the balance link opens a Stripe checkout for the exact balance',async()=>{
 const env=setup();await seed(env);const m=mailer();await queueBalanceInvoices(env,m,Date.parse('2026-12-03T08:00:00Z'));
 const row=await env.DB.prepare("SELECT token FROM eywa_invoices WHERE session_id='balance:cs_1'").bind().first();let params;
 const res=await balanceCheckout(env,async(path,method,p)=>{params=p;return {url:'https://checkout.stripe.com/x'};},row.token);
 assert.equal(res.status,303);assert.equal(params['line_items[0][price_data][unit_amount]'],'46322');assert.equal(params['metadata[eywa_balance]'],row.token);
});
