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
export function invoiceHTML(row){
 const q=JSON.parse(row.data_json),number=invoiceNumber(row),issued=new Date(row.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'});
 const address=q.billingAddress||{};
 const buyer=[q.billingName||q.name,q.company&&q.company!==(q.billingName||q.name)?q.company:'',address.line1,address.line2,[address.postal_code,address.city].filter(Boolean).join(' '),address.country&&address.country!=='FR'?address.country:'',q.email].filter(Boolean);
 const lines=orderLines(q),full=!q.balanceCents;
 const p=(v,cls)=>'<p'+(cls?' class="'+cls+'"':'')+'>'+escape(v)+'</p>';
 // Cette facture ne facture que le versement réellement reçu ; la commande est rappelée pour information.
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escape(number)}</title><style>
@page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;color:#291817;font:10pt/1.45 Arial,Helvetica,sans-serif}
table{width:100%;border-collapse:collapse}td,th{vertical-align:top;overflow-wrap:anywhere}
.head td{padding-bottom:14pt;border-bottom:1pt solid #d9cdbb}h1{font:normal 28pt Georgia,serif;margin:0 0 4pt}
.ref{text-align:right;color:#594c42}.ref strong{color:#291817}
.stamp{display:inline-block;margin-top:6pt;padding:3pt 8pt;border:1pt solid #214b3e;color:#214b3e;font-size:8pt;letter-spacing:1pt;font-weight:bold}
.parties{margin:16pt 0}.parties td{width:50%;padding-right:14pt}h2{font-size:8pt;letter-spacing:1pt;color:#75665b;margin:0 0 6pt}
p{margin:0 0 3pt}.strong{font-weight:bold}
.lines th{text-align:left;font-size:8pt;letter-spacing:.8pt;color:#75665b;border-bottom:1pt solid #d9cdbb;padding:7pt 0}
.lines td{padding:9pt 10pt 9pt 0;border-bottom:.5pt solid #e5ddcf}.lines .n{text-align:right;white-space:nowrap;padding-right:0;width:90pt}
.sub{display:block;font-size:8.5pt;color:#75665b;margin-top:2pt}
.order td{border-bottom:0;padding-top:9pt;color:#594c42}
.pay{margin-top:16pt;background:#f6f0e4;border-radius:5pt}.pay td{padding:8pt 13pt}.pay .n{text-align:right;white-space:nowrap;width:110pt}
.pay .total td{border-top:1pt solid #d9cdbb;font-size:13pt;font-weight:bold}.pay .total .n{font:normal 18pt Georgia,serif}
.note{margin-top:12pt;font-size:9pt;color:#594c42}
footer{margin-top:18pt;border-top:.5pt solid #d9cdbb;padding-top:9pt;font-size:7.5pt;line-height:1.55;color:#75665b}tr,footer{page-break-inside:avoid}
</style></head><body>
<table class="head"><tr><td><img src="https://eywacoffeecatering.com/assets/brand/eywa-wordmark-email-hd.png?v=20261120" width="150" height="42" alt="eywa coffee catering"></td>
<td class="ref"><h1>${full?'Facture':'Facture d’acompte'}</h1><strong>N° ${escape(number)}</strong><br>Émise le ${escape(issued)}<br>Versement reçu le ${escape(q.paymentDate||issued)}<br><span class="stamp">${full?'FACTURE ACQUITTÉE':'ACOMPTE ACQUITTÉ'}</span></td></tr></table>
<table class="parties"><tr>
<td><h2>ÉMETTEUR</h2><p class="strong">EYWA Coffee Catering</p><p>Louis Le Poulain EI</p><p>87 ter rue Gustave Gailly</p><p>08090 Montcy-Notre-Dame</p><p>SIRET 910 174 390 00039 · RCS Sedan</p><p>contact.eywa08@gmail.com · 07 49 90 21 56</p></td>
<td><h2>CLIENT</h2>${buyer.map((v,i)=>p(v,i===0?'strong':'')).join('')}<h2 style="margin-top:10pt">LIVRAISON</h2>${p((q.location||'Lieu à préciser')+' · '+longDate(q.date))}${p('Réf. devis '+(q.reference||'EYWA'))}</td>
</tr></table>
<table class="lines"><thead><tr><th>VOTRE COMMANDE</th><th class="n">MONTANT</th></tr></thead><tbody>
${lines.map(l=>'<tr><td><strong>'+escape(l.title)+'</strong>'+(l.description?'<span class="sub">'+escape(l.description)+'</span>':'')+'</td><td class="n">'+escape(money(l.cents))+'</td></tr>').join('')}
<tr class="order"><td>Total de la commande</td><td class="n">${escape(money(q.totalCents))}</td></tr></tbody></table>
<table class="pay">
<tr><td>${full?'Paiement intégral reçu':'Acompte de 50 % reçu'} le ${escape(q.paymentDate||issued)} par carte bancaire</td><td class="n">${escape(money(q.paidCents))}</td></tr>
<tr class="total"><td>Montant de cette facture</td><td class="n">${escape(money(q.paidCents))}</td></tr>
<tr><td>Reste à payer sur cette facture</td><td class="n">0,00 €</td></tr>
</table>
<p class="note">${full?'Commande intégralement réglée.':'Solde de la commande : <strong>'+escape(money(q.balanceCents))+'</strong>, à régler au plus tard le '+escape(longDate(q.date))+', avant le début du service. Il fera l’objet d’une facture de solde qui déduira cet acompte.'}</p>
<p class="note">TVA non applicable, article 293 B du CGI.</p>
<footer>Opération : vente de biens. Pas d’escompte pour paiement anticipé. Clients professionnels : en cas de retard de paiement, pénalités au taux de trois fois le taux d’intérêt légal et indemnité forfaitaire pour frais de recouvrement de 40 € (articles L441-10 et D441-5 du Code de commerce).</footer>
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
