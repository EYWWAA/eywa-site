import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quoteMail} from '../src/lib/quote-document.mjs';
import {reminderMail} from '../src/lib/followups.mjs';
import {paymentMail} from '../src/lib/mail-templates.mjs';
const q={reference:'EYWA-EXEMPLE',name:'Client Exemple',firstName:'Client',email:'client@example.com',date:'2027-01-20',time:'14:00',guests:50,hours:1.5,days:1,totalCents:25000,normalCents:25000,quoteUrl:'https://eywacoffeecatering.com/devis.html?qid=fixture&g=50',documentUrl:'https://eywa-booking.eywa-booking-cloudflare.workers.dev/quote-view?id=fixture',lineItems:[{title:'Coffee bar',normalCents:25000},{title:'Déplacement aller-retour',description:'Zone locale gratuite',normalCents:0}]};
test('all quote buttons return to the website quote and reservation, including follow-ups and payment',()=>{
 for(const mail of [quoteMail(q),quoteMail(q,true),quoteMail(q,false,{document:true}),reminderMail(q,1,'https://example.com/stop'),paymentMail({...q,paidCents:12500,balanceCents:12500})]){
  assert(mail.html.includes('https://eywacoffeecatering.com/devis.html?qid=fixture&amp;g=50'));
  assert(!mail.html.includes(q.documentUrl));
 }
});
test('free travel disappears from quote documents without changing the saved snapshot or total',()=>{
 const before=JSON.stringify(q);
 for(const document of [false,true]){
  const mail=quoteMail(q,false,{document});
  assert(!mail.html.includes('Déplacement aller-retour'));assert(!mail.text.includes('Zone locale gratuite'));
  assert(mail.html.includes('250,00'));assert(mail.html.includes('Cette demande ne bloque pas la date.'));
  assert(!/matériel et gobelets|Installation et rangement hors du temps de service/.test(mail.html));
 }
 assert.equal(JSON.stringify(q),before);
});
test('paid travel and every selected option remain itemised in the print layout',()=>{
 const items=[...q.lineItems.slice(0,1),{title:'Habillage du bar',normalCents:20000,personalization:true},{title:'Déplacement aller-retour',normalCents:6500}];
 const mail=quoteMail({...q,lineItems:items,totalCents:51500,normalCents:51500},false,{document:true});
 for(const value of ['Habillage du bar','Déplacement aller-retour','200,00','65,00','515,00'])assert(mail.html.includes(value));
 assert(mail.html.includes('@page{size:A4'));
});
test('the PDF is concise while the email retains the full client message safely escaped',()=>{
 const details='<script>message</script>\n'.repeat(60);
 const mail=quoteMail({...q,name:'Client <Exemple>',details}),pdf=quoteMail({...q,name:'Client <Exemple>',details},false,{document:true});
 assert(mail.html.includes('&lt;script&gt;message&lt;/script&gt;'));assert(!pdf.html.includes('&lt;script&gt;message'));
 assert(pdf.html.includes('Client &lt;Exemple&gt;'));assert(pdf.html.includes('Consulter mon devis et réserver'));
});
