import {escape,safeURL} from './mail-templates.mjs';
/* Trois relances recopiées des mails d'Always Kind Co et validées par Louis le 20/11/2026.
   Mêmes textes pour tous les types d'événements ; le reste viendra plus tard. */
export const reminderDays=[1,3,7];
export function segment(type=''){
 if(/mariage|wedding/i.test(type))return 'wedding';
 if(/anniversaire|privé|famille|baptême|communion/i.test(type))return 'private';
 return 'business';
}
const longDate=iso=>{const d=new Date(String(iso||'')+'T12:00:00Z');return isNaN(d)?'':new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);};
function messages(q){
 const where=[longDate(q.date)&&'du '+longDate(q.date),q.location&&'à '+q.location].filter(Boolean).join(' ');
 return [
  ['Merci d’avoir pensé à Eywa',['Merci beaucoup d’avoir pensé à Eywa pour votre événement !','Si vous avez des questions ou si vous souhaitez modifier quoi que ce soit, n’hésitez pas à m’écrire à tout moment !','Cliquez sur le bouton ci-dessous pour consulter votre devis.']],
  ['Votre devis Eywa',['Je reviens vers vous pour savoir si vous avez des questions sur votre devis. Si vous avez un budget idéal à respecter, dites-le-moi. Je serai ravi de trouver une solution avec vous.','Prêt à réserver ? Cliquez simplement sur le bouton ci-dessous.']],
  ['Toujours disponible pour votre événement',['Nous sommes toujours disponibles pour votre événement'+(where?' '+where:'')+' !','Pensez à réserver dès maintenant pour bloquer votre date. Cliquez simplement sur le bouton ci-dessous.','Merci,']]
 ];
}
export function reminderMail(q,day,stopUrl){
 const index=reminderDays.indexOf(day);if(index<0)throw Error('INVALID_REMINDER_DAY');
 const [subject,paragraphs]=messages(q)[index],link=q.quoteUrl||q.documentUrl,href=safeURL(link),stop=safeURL(stopUrl);
 const hello='Bonjour '+(q.firstName||'')+',';
 /* Le span invisible et unique en fin de mail empêche Gmail de replier le bas du message (les « … »).
    Fond blanc, carte beige, seulement le message et le bouton : pas de prix ni de détails,
    pour que la personne ouvre son devis (Louis, 20/11/2026). */
 const p=t=>`<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#4a3c34">${escape(t)}</p>`;
 const button=href?`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td bgcolor="#d9b9a2" style="border-radius:6px;background:#d9b9a2"><a href="${href}" target="_blank" rel="noopener" style="display:inline-block;padding:16px 30px;color:#291817;text-decoration:none;font-size:17px;font-weight:bold;font-family:Arial,Helvetica,sans-serif">Voir le devis</a></td></tr></table>`:'';
 const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;background:#ffffff;color:#291817;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#ffffff"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#fffdf9" style="width:100%;max-width:600px;background:#fffdf9;border:1px solid #ece3d8;border-radius:10px"><tr><td style="padding:32px 28px"><p style="margin:4px 0 34px" align="center"><img src="https://eywacoffeecatering.com/assets/brand/eywa-wordmark-email-hd.png?v=20261120" alt="eywa coffee catering" width="280" height="78" style="display:block;margin:0 auto;width:280px;max-width:100%;height:auto;border:0"></p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px;line-height:1.2;margin:0 0 22px;color:#291817">${escape(subject)}</h1>${p(hello)}${paragraphs.map(p).join('')}${p('Louis Le Poulain')}${button}${stop?`<p style="margin:28px 0 0;font-size:11px"><a href="${stop}" target="_blank" rel="noopener" style="color:#a99c91">Ne plus recevoir ces relances</a></p>`:''}<span style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden">${escape((q.reference||q.id||'')+'-'+day+'-'+Date.now())}</span></td></tr></table></td></tr></table></body></html>`;
 const text=[hello,...paragraphs,'Louis Le Poulain',link?'Voir le devis : '+link:'',stopUrl?'Ne plus recevoir ces relances : '+stopUrl:''].filter(Boolean).join('\n\n');
 return {subject,html,text};
}
export async function registerQuote(env,q,now=Date.now()){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 // Use the earliest Paris midnight offset as a conservative cut-off.
 // Never follow up on the event date, including across DST changes.
 const eventAt=Date.parse(q.date+'T00:00:00+02:00');
 await env.DB.batch([
  sql('INSERT INTO eywa_quote_state(quote_id,event_at,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING',q.id,eventAt,now),
  /* Relances systématiques : la personne vient de demander ce devis, le
     suivi en est le prolongement direct. Chaque message porte en pied de
     page un lien pour les arrêter, et elles cessent dès qu'un paiement
     est confirmé ou que la date de l'événement est passée. */
  ...reminderDays.map(day=>sql('INSERT INTO eywa_reminders(quote_id,day,due_at) SELECT ?,?,? WHERE ?<? ON CONFLICT DO NOTHING',q.id,day,now+day*86400000,now+day*86400000,eventAt)),
  sql('INSERT INTO eywa_notion_jobs(quote_id) VALUES(?) ON CONFLICT(quote_id) DO UPDATE SET version=version+1',q.id)
 ]);
}
export async function stopQuote(env,id,status='closed',session=null,now=Date.now()){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 await env.DB.batch([
  sql("UPDATE eywa_quote_state SET status=CASE WHEN status='paid' THEN 'paid' ELSE ? END,paid_session=COALESCE(?,paid_session),paid_at=CASE WHEN ?='paid' THEN COALESCE(paid_at,?) ELSE paid_at END,stopped_at=? WHERE quote_id=?",status,session,status,now,now,id),
  sql("UPDATE eywa_reminders SET state='cancelled' WHERE quote_id=? AND state='pending'",id),
  sql("DELETE FROM eywa_email_outbox WHERE quote_id=? AND kind='reminder' AND status='pending'",id),
  sql('UPDATE eywa_notion_jobs SET version=version+1 WHERE quote_id=?',id)
 ]);
}
export async function queueFollowups(env,mailer,now=Date.now()){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 const rows=(await sql("SELECT r.*,q.data_json FROM eywa_reminders r JOIN eywa_quote_state s ON s.quote_id=r.quote_id JOIN eywa_quotes q ON q.id=r.quote_id WHERE r.state='pending' AND r.due_at<=? AND s.status='open' AND s.event_at>? AND EXISTS (SELECT 1 FROM eywa_email_outbox o WHERE o.id='quote:'||q.id||':client' AND o.status='sent') ORDER BY r.due_at LIMIT 10",now,now).all()).results;
 for(const row of rows){
  // Relances J+15 et J+25 déjà programmées avant le 20/11/2026 : on ne les envoie plus.
  if(!reminderDays.includes(row.day)){await sql("UPDATE eywa_reminders SET state='skipped' WHERE quote_id=? AND day=?",row.quote_id,row.day).run();continue;}
  // If the worker was unavailable, do not send a burst of missed messages.
  const newer=await sql("SELECT day FROM eywa_reminders WHERE quote_id=? AND day>? AND due_at<=? AND state='pending' LIMIT 1",row.quote_id,row.day,now).first();
  if(newer||now-row.due_at>86400000){await sql("UPDATE eywa_reminders SET state='skipped' WHERE quote_id=? AND day=?",row.quote_id,row.day).run();continue;}
  const q=JSON.parse(row.data_json),id='reminder:'+q.id+':'+row.day;
  // « Toujours disponibles » : seulement si aucune réservation ne prend la date.
  if(row.day===reminderDays.at(-1)){const end=new Date(Date.parse(q.date+'T12:00:00Z')+(Math.max(1,Number(q.days)||1)-1)*86400000).toISOString().slice(0,10);if(await sql('SELECT 1 FROM eywa_booking_days WHERE day>=? AND day<=? LIMIT 1',q.date,end).first()){await sql("UPDATE eywa_reminders SET state='skipped' WHERE quote_id=? AND day=?",row.quote_id,row.day).run();continue;}}
  const stop='https://eywa-booking.eywa-booking-cloudflare.workers.dev/followup-stop?id='+q.id;
  const payload=reminderMail(q,row.day,stop);
  await env.DB.batch([
   sql("INSERT INTO eywa_email_outbox(id,recipient,payload_json,created_at,quote_id,kind) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM eywa_quote_state WHERE quote_id=? AND status='open' AND event_at>?) ON CONFLICT DO NOTHING",id,q.email,JSON.stringify(payload),now,q.id,'reminder',q.id,now),
   sql("UPDATE eywa_reminders SET state='queued' WHERE quote_id=? AND day=?",q.id,row.day)
  ]);
 }
}
