import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bankBlock,bankCSP,epcPayload,qrSvg} from '../src/lib/bank-block.mjs';

const bank={holder:'EYWA Coffee Catering',iban:'FR7630006000011234567890189',bic:'AGRIFRPP'};

test('Virement: charge EPC conforme, montant en euros avec deux décimales, motif repris',()=>{
 const lines=epcPayload(bank,21000,'EYWA-0412').split('\n');
 assert.deepEqual(lines.slice(0,4),['BCD','002','1','SCT']);
 assert.equal(lines[4],'AGRIFRPP');assert.equal(lines[5],'EYWA Coffee Catering');assert.equal(lines[6],'FR7630006000011234567890189');
 assert.equal(lines[7],'EUR210.00');assert.equal(lines[10],'EYWA-0412');
 assert.equal(epcPayload({...bank,holder:'A\nB'},5,'X').split('\n')[5],'A B');
});

test('Virement: le QR code est un SVG et le bloc propose trois boutons Copier',()=>{
 assert.match(qrSvg('BCD'),/^<svg/);
 const html=bankBlock({bank,reference:'EYWA-0412',amountCents:21000});
 assert.equal((html.match(/data-copy=/g)||[]).length,3);
 assert.ok(html.includes('data-copy="FR7630006000011234567890189"'));assert.ok(html.includes('data-copy="210,00"'));assert.ok(html.includes('data-copy="EYWA-0412"'));
 assert.ok(html.includes('FR76 3000 6000 0112 3456 7890 189'));
 assert.match(html,/<details/);
 assert.equal((html.match(/<button[^>]*hidden/g)||[]).length,3);
});

test('Virement: la politique de sécurité n’autorise que le script de copie, par son empreinte',()=>{
 const html=bankBlock({bank,reference:'EYWA-0412',amountCents:21000});
 const script=/<script>([\s\S]*?)<\/script>/.exec(html)[1];
 assert.ok(bankCSP.includes("script-src 'sha256-"+createHash('sha256').update(script).digest('base64')+"'"));
 assert.ok(bankCSP.includes("default-src 'none'"));assert.ok(!bankCSP.includes('unsafe-eval'));
 assert.ok(!/script-src[^;]*unsafe-inline/.test(bankCSP));
});

test('Virement: un titulaire piégé est échappé dans la page',()=>{
 const html=bankBlock({bank:{...bank,holder:'<img src=x onerror=alert(1)>'},reference:'EYWA-1',amountCents:100});
 assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));
});
