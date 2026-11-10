import {randomBytes} from 'node:crypto';
import {escape,money} from './mail-templates.mjs';
export const invoiceNumber=row=>'EYWA-WEB-'+new Date(row.created_at).toLocaleDateString('en-CA',{timeZone:'Europe/Paris',year:'numeric'})+'-'+String(row.seq).padStart(6,'0');
export const invoiceURL=row=>'https://eywa-booking.eywa-booking-cloudflare.workers.dev/invoice?token='+row.token;
export function invoiceHTML(row){
 const q=JSON.parse(row.data_json),number=invoiceNumber(row),issued=new Date(row.created_at).toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'});
 const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Date(value+'T12:00:00Z').toLocaleDateString('fr-FR',{timeZone:'UTC'}):value||'À préciser';
 const address=q.billingAddress||{};
 const buyerAddress=[address.line1,address.line2,[address.postal_code,address.city].filter(Boolean).join(' '),address.country].filter(Boolean);
 const description=q.balanceCents?'Acompte de réservation - prestation coffee catering':'Paiement intégral avant prestation - coffee catering';
 const options=(q.options||[]).join(', ');
 // This invoice bills the advance actually received. The booking balance is
 // shown separately and is not misrepresented as an amount billed or paid.
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escape(number)}</title><style>
 @page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;font:10pt/1.4 Arial,Helvetica,sans-serif;color:#202124}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{vertical-align:top;overflow-wrap:anywhere;word-wrap:break-word}h1{font-size:22pt;line-height:1.15;margin:0 0 10pt;font-weight:600}p{margin:0 0 5pt}.muted{color:#60646c}.header{margin-bottom:14pt}.header td:last-child{text-align:right}.badge{display:inline-block;color:#146c43;font-size:8pt;font-weight:bold;border:1pt solid #c3dfcd;padding:3pt 6pt;border-radius:3pt}.metadata{font-size:9pt;line-height:1.4;margin-top:6pt}.parties{margin-bottom:12pt}.parties td{width:50%;padding-right:20pt;line-height:1.35}.label{font-size:8pt;letter-spacing:.7pt;color:#60646c;font-weight:bold;margin-bottom:6pt}.event{font-size:9pt;border-top:.5pt solid #dadce0;padding-top:12pt;margin-bottom:12pt}.lines th{font-size:8pt;color:#60646c;font-weight:normal;text-align:left;border-bottom:1pt solid #8c8f94;padding:8pt 5pt}.lines td{padding:8pt 5pt;border-bottom:.5pt solid #dadce0}.lines .qty{width:35pt;text-align:center}.lines .unit,.lines .amount{width:85pt;text-align:right;white-space:nowrap}.summary{margin-top:10pt}.summary td{padding:4pt 0}.summary td:last-child{width:90pt;text-align:right;white-space:nowrap}.summary .total td{border-top:1pt solid #202124;padding-top:8pt;font-size:13pt;font-weight:bold}.booking{margin-top:12pt;padding-top:12pt;border-top:.5pt solid #dadce0;font-size:9pt}.booking p{margin:0 0 5pt}footer{margin-top:12pt;padding-top:10pt;border-top:.5pt solid #dadce0;color:#60646c;font-size:8pt;line-height:1.5}tr,footer{page-break-inside:avoid}a{color:inherit;text-decoration:none}
 </style></head><body><table class="header"><tr><td style="width:45%"><img src="https://eywacoffeecatering.com/assets/brand/eywa-wordmark-email.png?v=20261024" alt="EYWA Coffee Catering" width="150" height="43"></td><td style="width:55%"><h1>Facture d’acompte</h1><strong>${escape(number)}</strong><div class="metadata">Date d’émission : ${escape(issued)}<br>Versement reçu le : ${escape(q.paymentDate)}<br>Mode de paiement : carte bancaire</div><p style="margin-top:8pt"><span class="badge">ACOMPTE ACQUITTÉ</span></p></td></tr></table>
 <table class="parties"><tr><td><p class="label">ÉMETTEUR</p><strong>Louis Le Poulain EI</strong><br>EYWA Coffee Catering<br>87 ter rue Gustave Gailly<br>08090 Montcy-Notre-Dame, France<br>SIRET 910 174 390 00039<br>RCS Sedan 910 174 390<br>contact.eywa08@gmail.com<br>07 49 90 21 56</td><td><p class="label">FACTURÉ À</p><strong>${escape(q.billingName||q.name)}</strong>${q.company&&q.company!==(q.billingName||q.name)?'<br>'+escape(q.company):''}${buyerAddress.map(v=>'<br>'+escape(v)).join('')}<br>${escape(q.email)}</td></tr></table>
 <div class="event"><p><strong>${escape(q.eventType||'Coffee bar événementiel')} - ${escape(date(q.date))}</strong></p><p>${escape(q.location)}</p><p>${escape(q.guests)} invités · ${escape(q.hours)} h de service par jour · ${escape(q.days)} jour(s)</p>${options?'<p>Personnalisations : '+escape(options)+'</p>':''}<p>Devis de référence : ${escape(q.reference||'Réservation EYWA')}</p></div>
 <table class="lines"><thead><tr><th>DÉSIGNATION</th><th class="qty">QTÉ</th><th class="unit">PRIX UNIT. HT</th><th class="amount">MONTANT HT</th></tr></thead><tbody><tr><td><strong>${escape(description)}</strong><br><span class="muted">Selon le devis ${escape(q.reference||'accepté lors de la réservation')}.</span></td><td class="qty">1</td><td class="unit">${escape(money(q.paidCents))}</td><td class="amount">${escape(money(q.paidCents))}</td></tr></tbody></table>
 <table class="summary"><tr><td style="width:53%"></td><td>Total HT de cette facture</td><td>${escape(money(q.paidCents))}</td></tr><tr><td></td><td>TVA non applicable</td><td>-</td></tr><tr class="total"><td></td><td>Total réglé</td><td>${escape(money(q.paidCents))}</td></tr><tr><td></td><td>Reste à payer sur cette facture</td><td>0,00 €</td></tr></table>
 <div class="booking"><p>Montant total de la réservation : <strong>${escape(money(q.totalCents))}</strong></p><p>Solde de la prestation : <strong>${escape(money(q.balanceCents))}</strong>${q.balanceCents?' - à régler au plus tard le '+escape(date(q.date))+', avant le début du service.':' - prestation intégralement réglée.'}</p></div>
 <footer>TVA non applicable, article 293 B du Code général des impôts.<br>Facture établie pour le versement reçu avant prestation. Ce versement sera déduit de la facture finale.<br>Pas d’escompte pour paiement anticipé. Clients professionnels : pénalités de retard au taux de refinancement BCE majoré de 10 points ; indemnité forfaitaire de recouvrement de 40 € par facture échue impayée.</footer></body></html>`;
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
