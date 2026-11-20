import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {invoiceHTML} from '../src/lib/invoices.mjs';
test('classic invoice bills only the actual advance and distinguishes the remaining booking balance',()=>{
 const row={seq:8,created_at:Date.parse('2026-11-10T09:00:00Z'),data_json:JSON.stringify({billingName:'Client <Exemple>',email:'client@example.com',billingAddress:{line1:'Adresse de facturation'},date:'2027-01-20',paymentDate:'10/11/2026',totalCents:71935,paidCents:35968,balanceCents:35967,guests:100,hours:3,days:1,reference:'EYWA-EXEMPLE',lines:[{title:'Ancienne grille conservée',cents:71935}]})};
 const before=JSON.stringify(row),html=invoiceHTML(row);
 assert(html.includes('Client &lt;Exemple&gt;'));assert(html.includes('EYWA-WEB-2026-000008'));
 assert(html.includes('359,68'));assert(html.includes('359,67'));assert(html.includes('719,35'));
 assert(html.includes('Montant de cette facture'));
 assert(html.includes('Solde restant à régler'));assert(!/prestation|forfait\b|animation/i.test(html));assert(html.includes('293 B'));assert.equal(JSON.stringify(row),before);
});
test('website quote downloads the dedicated PDF instead of printing the entire website',async()=>{
 const html=await fs.readFile(new URL('../../devis.html',import.meta.url),'utf8');
 const js=await fs.readFile(new URL('../../quote-details.js',import.meta.url),'utf8');
 assert(html.includes('id="quote-pdf-link"'));assert(!html.includes('onclick="window.print()"'));assert(js.includes('/quote-pdf?id='));
});

test('deposit invoice shows one price for the drinks (travel included) and one per option, with URSSAF wording (20/11/2026)',()=>{
 const lines=[{title:'Formule de base',cents:30000},{title:'Déplacement aller-retour',cents:17644},{title:'Habillage du bar',cents:20000,personalization:true},{title:'Gobelets sur mesure',cents:20000,personalization:true},{title:'Impression accélérée des gobelets',cents:5000,personalization:true}];
 const row={seq:1,created_at:Date.parse('2026-11-21T09:00:00Z'),data_json:JSON.stringify({billingName:'Publicis Consultants',email:'x@example.com',date:'2026-12-02',location:'Lille',guests:20,hours:1.5,days:1,paymentDate:'21/11/2026',totalCents:92644,paidCents:46322,balanceCents:46322,reference:'EYWA-00CFD9C8',lines})};
 const html=invoiceHTML(row);
 for(const v of ['Boissons chaudes préparées et servies sur place','476,44','Habillage du bar à vos couleurs','Gobelets personnalisés à votre logo','Impression accélérée des gobelets','926,44','463,22','déplacement compris','Facture d’acompte'])assert(html.includes(v),v);
 assert(!/prestation|forfait\b|animation|Formule de base|176,44/i.test(html));
});
