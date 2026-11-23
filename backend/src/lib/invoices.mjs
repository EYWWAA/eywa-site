import terms from './payment-terms.cjs';
import {randomBytes} from 'node:crypto';
import {escape,money} from './mail-templates.mjs';
export const invoiceNumber=row=>'EYWA-WEB-'+new Date(row.created_at).toLocaleDateString('en-CA',{timeZone:'Europe/Paris',year:'numeric'})+'-'+String(row.seq).padStart(6,'0');
export const invoiceURL=row=>'https://eywa-booking.eywa-booking-cloudflare.workers.dev/invoice?token='+row.token;
// Libellés de facture validés par Louis le 20/11/2026 : jamais « prestation », « forfait » ni « animation »
// (qualification URSSAF en vente de boissons). Un prix pour les boissons, déplacement compris, puis un prix par option.
const OPTION_NAMES={'Habillage du bar':'Habillage du bar à vos couleurs','Gobelets sur mesure':'Gobelets personnalisés à votre logo','Gobelets avec stickers':'Gobelets avec stickers personnalisés','Logo sur les boissons':'Logo dessiné sur la mousse'};
const longDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Date(value+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}):value||'date à préciser';
const hoursLabel=value=>{const n=Number(value);if(!Number.isFinite(n))return String(value||'');const m=Math.round(n*60);return Math.floor(m/60)+' h'+(m%60?' '+String(m%60).padStart(2,'0'):'');};
export function orderLines(q){
 const lines=Array.isArray(q.lines)?q.lines:[],extras=[],discounts=[];let drinks=0;
 for(const l of lines){
  const cents=Number(l.cents);if(!Number.isSafeInteger(cents))continue;
  if(cents<0)discounts.push({title:'Remise appliquée',description:l.description||'',cents});
  else if(l.personalization||/^Impression accélérée/.test(l.title||''))extras.push({title:OPTION_NAMES[l.title]||l.title,description:/^Impression accélérée/.test(l.title||'')?'Commande à moins de 14 jours de l’événement':'',cents});
  else drinks+=cents;
 }
 const days=Number(q.days)>1?' par jour, '+q.days+' jours':'';
 const description='Événement du '+longDate(q.date)+(q.location?' à '+q.location:'')+(q.guests?', jusqu’à '+q.guests+' invités':'')+(q.hours?', '+hoursLabel(q.hours)+' de service'+days:'')+', déplacement compris';
 return [{title:'Boissons chaudes préparées et servies sur place',description,cents:drinks},...extras,...discounts];
}
// Mise en page recopiée de la facture Pennylane validée par Louis le 20/11/2026 (une seule page A4).
export function invoiceHTML(row){
 const q=JSON.parse(row.data_json),number=invoiceNumber(row),fr=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Paris'});
 const issued=fr(new Date(row.created_at)),paid=q.paymentDate||new Date(row.created_at).toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'});
 const address=q.billingAddress||{},balance=q.kind==='balance',full=!balance&&!q.balanceCents,lines=orderLines(q),e=escape;
 const buyer=[q.company&&q.company!==(q.billingName||q.name)?q.name:'',address.line1,address.line2,[address.postal_code,address.city].filter(Boolean).join(' ')+(address.country&&address.country!=='FR'?' - '+address.country:' - France'),q.email].filter(v=>v&&v!==' - France');
 const row1=l=>'<tr><td class="p"><b>'+e(l.title)+'</b>'+(l.description?'<span class="d">'+e(l.description)+'</span>':'')+'</td><td class="r">1 unité</td><td class="r">'+e(money(l.cents))+'</td><td class="c">Aucune</td><td class="r">'+e(money(l.cents))+'</td><td class="r">'+e(money(l.cents))+'</td></tr>';
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${e(number)}</title><style>
@page{size:A4;margin:12mm 14mm}*{box-sizing:border-box}body{margin:0;color:#1d1d1b;font:8.5pt/1.35 Poppins,Arial,Helvetica,sans-serif}
table{width:100%;border-collapse:collapse}td,th{vertical-align:top}.acc{color:#BE957A}b{font-weight:600}
.top td{padding:0}.logo{width:230pt;display:block}.from{font-size:8pt;line-height:1.3}.from .acc{font-size:9.5pt;font-weight:600}
.kind{font-size:13pt;font-weight:600;margin:16pt 0 0}.num{font-size:12pt;margin:0 0 4pt}.meta td{padding:1pt 0;font-size:9pt}.meta td:first-child{font-weight:600;width:105pt}
h2{font-size:12pt;font-weight:600;color:#BE957A;margin:18pt 0 8pt}
.lines th{background:#f6f2ee;font-weight:600;font-size:8pt;padding:4pt 3pt;text-align:right}.lines th:first-child{text-align:left}.lines td{padding:4pt 3pt;border-bottom:.5pt solid #e7e2dc}
.lines .p{width:40%}.lines .r{text-align:right;white-space:nowrap}.lines .c{text-align:center}.d{display:block;font-weight:400;color:#6b645d;font-size:7.5pt}
.sum{margin-top:12pt}.sum>tbody>tr>td{width:50%}.sum h3{font-size:11pt;font-weight:600;color:#BE957A;margin:0 0 4pt}
.vat td{padding:1pt 0}.vat th{text-align:left;font-weight:600;padding:1pt 0}.vat .r,.recap .r{text-align:right;white-space:nowrap}
.recap td{padding:1pt 0}.recap .t td{background:#f6f2ee;font-weight:600;padding:4pt 5pt;font-size:9.5pt}.recap .s td{padding-top:6pt}
.pay{margin-top:18pt}.pay>tbody>tr>td{width:50%}.box{overflow-wrap:anywhere;background:#f6f2ee;border-radius:4pt;padding:9pt 10pt}.box h3{font-size:11pt;font-weight:600;color:#BE957A;margin:0 0 4pt}
.ment{padding-left:16pt;font-size:8.5pt}.ment small{display:block;font-size:7pt}
.legal{margin-top:12pt;font-size:8pt}.foot{margin-top:28pt;font-size:7pt;color:#1d1d1b;border-top:0}
</style></head><body>
<table class="top"><tr><td style="width:58%"><img class="logo" src="https://eywacoffeecatering.com/assets/brand/eywa-wordmark-email-hd.png?v=20261120" alt="eywa coffee catering"></td>
<td class="from">Envoyée par<br><span class="acc">EYWA Coffee Catering</span><br>87 ter rue Gustave Gailly<br>08090 Montcy-Notre-Dame - France<br>contact.eywa08@gmail.com<br>+33 7 49 90 21 56</td></tr>
<tr><td><p class="kind acc">${balance?'Facture de solde':full?'Facture':'Facture d’acompte'}</p><p class="num">N° ${e(number)}</p><table class="meta"><tr><td>Date d’émission</td><td>${e(issued)}</td></tr>${balance?'<tr><td>Date d’échéance</td><td>'+e(q.dueDate)+'</td></tr>':'<tr><td>Date de paiement</td><td>'+e(paid)+'</td></tr>'}<tr><td>Type de vente</td><td>Livraisons de biens</td></tr></table></td>
<td class="from" style="padding-top:14pt">À destination de<br><span class="acc">${e(q.billingName||q.company||q.name||'')}</span>${buyer.map(v=>'<br>'+e(v)).join('')}</td></tr></table>
<h2>Boissons chaudes servies sur place, événement du ${e(longDate(q.date))}${q.location?' à '+e(q.location):''}</h2>
<table class="lines"><thead><tr><th>Produits</th><th>Qté</th><th>Prix u. HT</th><th style="text-align:center">TVA (%)</th><th>Total HT</th><th>Total TTC</th></tr></thead><tbody>${lines.map(row1).join('')}</tbody></table>
<table class="sum"><tr><td style="padding-right:30pt"><h3>Détails TVA</h3><table class="vat"><tr><th>Taux</th><th class="r">Montant TVA</th><th class="r">Base HT</th></tr><tr><td>Aucune</td><td class="r">0,00 €</td><td class="r">${e(money(q.totalCents))}</td></tr></table></td>
<td><h3>Récapitulatif</h3><table class="recap"><tr><td><b>Total HT</b></td><td class="r">${e(money(q.totalCents))}</td></tr><tr><td><b>Total TVA</b></td><td class="r">0,00 €</td></tr><tr class="t"><td>Total TTC</td><td class="r">${e(money(q.totalCents))}</td></tr>
${balance?`<tr class="s"><td>Acompte versé le ${e(q.depositDate)} (facture N° ${e(q.depositNumber)})</td><td class="r">−${e(money(q.paidCents))}</td></tr><tr class="t"><td>Reste à payer</td><td class="r">${e(money(q.balanceCents))}</td></tr>`:full?`<tr class="s"><td>Payé le ${e(paid)}</td><td class="r">${e(money(q.paidCents))}</td></tr><tr class="t"><td>Reste à payer</td><td class="r">0,00 €</td></tr>`:`<tr class="s"><td>Acompte de 50 % payé le ${e(paid)}</td><td class="r">${e(money(q.paidCents))}</td></tr><tr class="t"><td>Montant de cette facture</td><td class="r">${e(money(q.paidCents))}</td></tr><tr><td>Solde restant à régler</td><td class="r">${e(money(q.balanceCents))}</td></tr>`}</table></td></tr></table>
<table class="pay"><tr><td><div class="box"><h3>Paiement</h3>${balance?'<b>Moyens de paiement</b>&nbsp;&nbsp; '+(q.bankTransfer?'Carte bancaire ou virement':'Carte bancaire')+'<br><b>À régler avant le</b>&nbsp;&nbsp; '+e(q.dueDate)+(q.bankDetails?'<br><b>Titulaire</b>&nbsp; '+e(q.bankDetails.holder)+'<br><b>IBAN</b>&nbsp; '+e(q.bankDetails.iban.replace(/(.{4})/g,'$1 ').trim())+'<br><b>BIC</b>&nbsp; '+e(q.bankDetails.bic)+'<br><b>Référence</b>&nbsp; '+e(number):'')+(q.payUrl?'<br><b>Payer en ligne</b>&nbsp;&nbsp; <a href="'+e(q.payUrl)+'" style="color:#1d1d1b">'+e(q.payUrl.replace(/^https:\/\//,''))+'</a>':''):'<b>Moyen de paiement</b>&nbsp;&nbsp; '+(q.paymentMethod==='bank_transfer'?'Virement bancaire':'Carte de crédit')+'<br><b>Statut</b>&nbsp;&nbsp; '+(full?'Facture acquittée':'Acompte acquitté')+' le '+e(paid)}</div></td>
<td class="ment"><small>Mention spéciale</small>TVA non applicable, article 293 B du CGI. Réf. devis ${e(q.reference||'EYWA')}.${balance?' Facture de solde de la commande, déduction faite de l’acompte. '+(q.paymentSchedule===terms.SCHEDULE?'À régler au plus tard le '+e(q.dueDate)+', avant le début du service.':'Payable sous 30 jours.') :full?'':q.paymentSchedule===terms.SCHEDULE?' Le solde de '+e(money(q.balanceCents))+' est à régler au plus tard le '+e(longDate(q.balanceDueDate||q.date))+', avant le début du service. Une facture de solde vous sera adressée avant l’événement.':' Le solde de '+e(money(q.balanceCents))+' fera l’objet d’une facture de solde envoyée après l’événement, payable sous 30 jours.'}</td></tr></table>
<div class="legal"><b>Pénalités de retard</b> : Trois fois le taux annuel d’intérêt légal en vigueur calculé depuis la date d’échéance jusqu’à complet paiement du prix.<br><b>Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement</b> : 40 €<br><b>Escompte</b> : Pas d’escompte pour paiement anticipé.</div>
<div class="foot">LOUIS LE POULAIN EI | Entrepreneur individuel | N° SIRET 910 174 390 00039 | RCS Sedan</div>
</body></html>`;
}

export async function createInvoice(env,row,data,now=Date.now()){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 if(!Number.isSafeInteger(data.paidCents)||data.paidCents!==row.payable_cents||data.paidCents<1)throw Error('INVALID_INVOICE_PAYMENT');
 if(data.lines.reduce((n,l)=>n+l.cents,0)!==data.totalCents||data.paidCents+data.balanceCents!==data.totalCents)throw Error('INVALID_INVOICE_TOTAL');
 // INSERT SELECT avoids consuming an invoice number on a duplicate webhook.
 await sql('INSERT INTO eywa_invoices(token,session_id,quote_id,data_json,created_at) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM eywa_invoices WHERE session_id=?)',randomBytes(32).toString('hex'),row.session_id,data.quoteId||null,JSON.stringify(data),now,row.session_id).run();
 return sql('SELECT * FROM eywa_invoices WHERE session_id=?',row.session_id).first();
}
export async function invoiceResponse(env,token,pdf=false){
 if(!/^[a-f0-9]{64}$/.test(token||''))return new Response('Facture introuvable',{status:404});
 const row=await env.DB.prepare('SELECT * FROM eywa_invoices WHERE token=?').bind(token).first();
 if(!row)return new Response('Facture introuvable',{status:404});
 const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 if(pdf){if(!row.pdf_base64)return new Response('Document en cours de préparation. Réessayez dans quelques instants.',{status:503,headers});return new Response(Uint8Array.from(atob(row.pdf_base64),c=>c.charCodeAt(0)),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+invoiceNumber(row)+'.pdf"'}});}
 return new Response(invoiceHTML(row),{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
}
