import {test} from 'node:test';
import assert from 'node:assert/strict';
import policy from '../../personalization-policy.js';
import pricing from '../src/lib/pricing.cjs';
import {quoteLines} from '../src/lib/quote-lines.mjs';
import {paymentPlan} from '../src/lib/payment-plan.mjs';
const now=new Date('2026-11-13T10:00:00Z');
const q={g:50,h:1.5,dy:1,d:'2026-11-18',ti:'14:00',country:'FR',lat:49.778496,lng:4.740663,t:'Mariage',options:[]};
test('stickers and the printer are offered only for weddings and private events',()=>{
 for(const type of ['Mariage','Célébration privée','Anniversaire','Fête de famille']){
  assert(policy.available(type,'Gobelets avec stickers'));assert(policy.available(type,'Logo sur les boissons'));
 }
 for(const type of ['Entreprise','Salon professionnel','Activation de marque','Autre','']){
  assert(!policy.available(type,'Gobelets avec stickers'));assert(!policy.available(type,'Logo sur les boissons'));
  assert(policy.available(type,'Gobelets sur mesure'));assert(policy.available(type,'Habillage du bar'));
 }
});
test('choosing stickers replaces printed cups and vice versa, without removing other options',()=>{
 assert.deepEqual(policy.toggle('Mariage',['Gobelets sur mesure','Logo sur les boissons'],'Gobelets avec stickers'),['Logo sur les boissons','Gobelets avec stickers']);
 assert.deepEqual(policy.toggle('Mariage',['Gobelets avec stickers'],'Gobelets sur mesure'),['Gobelets sur mesure']);
 assert.throws(()=>policy.validate('Mariage',['Gobelets avec stickers','Gobelets sur mesure']));
 assert.deepEqual(policy.filter('Entreprise',['Gobelets avec stickers','Logo sur les boissons','Habillage du bar']),['Habillage du bar']);
});
test('server rejects restricted private options on a corporate request',async()=>{
 for(const option of ['Gobelets avec stickers','Logo sur les boissons'])await assert.rejects(()=>pricing.quote({...q,t:'Entreprise',options:[option]},undefined,now),/indisponible/);
 await assert.rejects(()=>pricing.quote({...q,options:['Gobelets sur mesure','Gobelets avec stickers']},undefined,now),/Choisissez/);
});
test('stickers cost 100 per day, printer 150, and stickers never incur the printed-cup rush charge',async()=>{
 const stickers=await pricing.quote({...q,options:['Gobelets avec stickers']},undefined,now);
 assert.equal(stickers.normalCents,40000);assert.equal(stickers.personalizationCents,10000);assert.equal(stickers.rushCupsCents,0);
 const custom={...q,dy:2,options:['Gobelets avec stickers','Logo sur les boissons']},c=await pricing.quote(custom,undefined,now);
 assert.equal(c.normalCents,110000);assert.equal(c.personalizationCents,50000);assert.equal(c.rushCupsCents,0);
 assert.equal(paymentPlan(c,{code:'NATHALIE08'},{}).totalCents,50100);
 assert.equal(quoteLines(custom,c).lineItems.reduce((n,l)=>n+l.normalCents,0),110000);
});
