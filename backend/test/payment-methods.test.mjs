import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withCardFallback} from '../src/lib/payment-methods.mjs';

const base={'payment_method_types[0]':'card','payment_method_types[1]':'wero',mode:'payment'};

test('Paiement: Wero est proposé avec la carte quand Stripe l’accepte',async()=>{
 const calls=[];
 const r=await withCardFallback(async(p,m,v,k)=>{calls.push({v,k});return {id:'cs_1',url:'u'};},base,'cle');
 assert.equal(r.id,'cs_1');assert.equal(calls.length,1);assert.equal(calls[0].v['payment_method_types[1]'],'wero');assert.equal(calls[0].k,'cle');
});

test('Paiement: si Stripe refuse Wero, la session est recréée avec la carte seule et une autre clé',async()=>{
 const calls=[];
 const r=await withCardFallback(async(p,m,v,k)=>{calls.push({v,k});if(calls.length===1)throw Object.assign(Error('x'),{stripeStatus:400});return {id:'cs_2'};},base,'cle');
 assert.equal(r.id,'cs_2');assert.equal(calls.length,2);
 assert.ok(!('payment_method_types[1]' in calls[1].v));assert.equal(calls[1].v['payment_method_types[0]'],'card');assert.equal(calls[1].k,'cle-card');
});

test('Paiement: une autre panne Stripe n’est pas rejouée',async()=>{
 let n=0;
 await assert.rejects(()=>withCardFallback(async()=>{n++;throw Object.assign(Error('x'),{stripeStatus:500});},base,'cle'));
 assert.equal(n,1);
 await assert.rejects(()=>withCardFallback(async()=>{n++;throw Object.assign(Error('x'),{stripeStatus:400});},{mode:'payment','payment_method_types[0]':'card'},'cle'));
 assert.equal(n,2);
});
