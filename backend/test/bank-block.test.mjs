import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bankBlock,bankCSP} from '../src/lib/bank-block.mjs';

const bank={holder:'EYWA Coffee Catering',iban:'FR7630006000011234567890189',bic:'AGRIFRPP'};

test('Virement: deux boutons Copier (IBAN, montant), ni référence ni QR code',()=>{
 const html=bankBlock({bank,amountCents:21000});
 assert.equal((html.match(/data-copy=/g)||[]).length,2);
 assert.ok(!/Référence|QR|<details|<svg/.test(html));
 assert.ok(html.includes('data-copy="FR7630006000011234567890189"'));assert.ok(html.includes('data-copy="210,00"'));
 assert.ok(html.includes('FR76 3000 6000 0112 3456 7890 189'));
 assert.equal((html.match(/<button[^>]*hidden/g)||[]).length,2);
});

test('Virement: la politique de sécurité n’autorise que le script de copie, par son empreinte',()=>{
 const html=bankBlock({bank,amountCents:21000});
 const script=/<script>([\s\S]*?)<\/script>/.exec(html)[1];
 assert.ok(bankCSP.includes("script-src 'sha256-"+createHash('sha256').update(script).digest('base64')+"'"));
 assert.ok(bankCSP.includes("default-src 'none'"));assert.ok(!bankCSP.includes('unsafe-eval'));
 assert.ok(!/script-src[^;]*unsafe-inline/.test(bankCSP));
});

test('Virement: un titulaire piégé est échappé dans la page',()=>{
 const html=bankBlock({bank:{...bank,holder:'<img src=x onerror=alert(1)>'},amountCents:100});
 assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));
});
