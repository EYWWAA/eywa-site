import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {invoiceHTML} from '../src/lib/invoices.mjs';
test('classic invoice bills only the actual advance and distinguishes the remaining booking balance',()=>{
 const row={seq:8,created_at:Date.parse('2026-11-10T09:00:00Z'),data_json:JSON.stringify({billingName:'Client <Exemple>',email:'client@example.com',billingAddress:{line1:'Adresse de facturation'},date:'2027-01-20',paymentDate:'10/11/2026',totalCents:71935,paidCents:35968,balanceCents:35967,guests:100,hours:3,days:1,reference:'EYWA-EXEMPLE',lines:[{title:'Ancienne grille conservée',cents:71935}]})};
 const before=JSON.stringify(row),html=invoiceHTML(row);
 assert(html.includes('Client &lt;Exemple&gt;'));assert(html.includes('EYWA-WEB-2026-000008'));
 assert(html.includes('359,68'));assert(html.includes('359,67'));assert(html.includes('719,35'));
 assert(html.includes('Total réglé'));assert(html.includes('Reste à payer sur cette facture</td><td>0,00 €'));
 assert(html.includes('Solde de la prestation'));assert(html.includes('293 B'));assert.equal(JSON.stringify(row),before);
});
test('website quote downloads the dedicated PDF instead of printing the entire website',async()=>{
 const html=await fs.readFile(new URL('../../devis.html',import.meta.url),'utf8');
 const js=await fs.readFile(new URL('../../quote-details.js',import.meta.url),'utf8');
 assert(html.includes('id="quote-pdf-link"'));assert(!html.includes('onclick="window.print()"'));assert(js.includes('/quote-pdf?id='));
});
