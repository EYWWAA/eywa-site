// Bloc « virement » des pages publiques (proforma d'acompte et solde) : coordonnées à copier d'un geste et QR code de virement (norme EPC) déplié à la demande.
// Les pages interdisent tout script (CSP) : le petit script de copie est autorisé par son empreinte, rien d'autre ne peut s'exécuter.
import {createHash} from 'node:crypto';
import qrcode from 'qrcode-generator';
import {escape} from './mail-templates.mjs';

const SCRIPT="document.querySelectorAll('[data-copy]').forEach(function(b){b.hidden=false;b.addEventListener('click',function(){var t=b.getAttribute('data-copy'),l=b.textContent;function ok(){b.textContent='Copié';setTimeout(function(){b.textContent=l},1600)}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,function(){})}else{var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');ok()}catch(e){}a.remove()}})})";
const HASH=createHash('sha256').update(SCRIPT).digest('base64');
export const bankCSP="default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-"+HASH+"'; img-src https://eywacoffeecatering.com; base-uri 'none'; frame-ancestors 'none'";

const clean=(s,n)=>String(s??'').replace(/[\r\n]+/g,' ').trim().slice(0,n);
// Contenu du QR code : norme EPC (« GiroCode ») version 002, virement SEPA. Les applis bancaires qui la lisent préremplissent bénéficiaire, IBAN, montant et motif.
export function epcPayload(bank,amountCents,reference){
 return ['BCD','002','1','SCT',clean(bank.bic,11),clean(bank.holder,70),clean(bank.iban,34).replace(/\s/g,''),'EUR'+(amountCents/100).toFixed(2),'','',clean(reference,140)].join('\n');
}
export function qrSvg(text){
 const q=qrcode(0,'M');q.addData(text,'Byte');q.make();
 return q.createSvgTag({cellSize:4,margin:0,scalable:true});
}
const row=(label,value,copy)=>`<tr><th scope="row" align="left" style="width:34%;padding:11px 8px 11px 0;border-bottom:1px solid #e5d9c7;color:#67584d;font-weight:400;vertical-align:middle">${escape(label)}</th><td style="padding:11px 0;border-bottom:1px solid #e5d9c7;overflow-wrap:anywhere;vertical-align:middle">${escape(value)}</td><td align="right" style="padding:11px 0 11px 8px;border-bottom:1px solid #e5d9c7;vertical-align:middle">${copy?`<button type="button" hidden data-copy="${escape(copy)}" style="font:13px Arial,Helvetica,sans-serif;background:#fffbef;color:#291817;border:1px solid #c4937f;border-radius:5px;padding:7px 12px;cursor:pointer">Copier</button>`:''}</td></tr>`;
export function bankBlock({bank,reference,amountCents}){
 const amount=(amountCents/100).toFixed(2).replace('.',',');
 const qr=`<details style="margin:16px 0 4px"><summary style="cursor:pointer;font-size:14px;color:#594c42">Vous êtes sur un ordinateur ? Afficher le QR code à scanner avec votre téléphone</summary><div style="margin:14px 0 4px;text-align:center"><div style="display:inline-block;width:190px;height:190px;background:#fff;padding:10px;border:1px solid #e5d9c7">${qrSvg(epcPayload(bank,amountCents,reference))}</div><p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#67584d">Scannez-le avec l’application de votre banque : le bénéficiaire, l’IBAN, le montant et la référence se remplissent seuls. Selon les banques, cette fonction s’appelle « scanner un QR code de virement ».</p></div></details>`;
 const html=`<h2 style="font-family:Georgia,serif;font-weight:400;font-size:22px;margin:26px 0 4px">Coordonnées du virement</h2><p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#67584d">Sur téléphone, touchez « Copier » pour chaque ligne, puis collez dans l’application de votre banque.</p><table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">${row('Bénéficiaire',bank.holder)}${row('IBAN',String(bank.iban).replace(/(.{4})/g,'$1 ').trim(),String(bank.iban).replace(/\s/g,''))}${row('BIC',bank.bic)}${row('Montant',amount.replace(',',',')+' €',amount)}${row('Référence à indiquer',reference,reference)}</table>${qr}<script>${SCRIPT}</script>`;
 return html;
}
