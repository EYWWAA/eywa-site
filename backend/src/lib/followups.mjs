import {shell,eventRows} from './mail-templates.mjs';
export const reminderDays=[1,3,7,15,25];
export function segment(type=''){
 if(/mariage|wedding/i.test(type))return 'wedding';
 if(/anniversaire|privé|famille|baptême|communion/i.test(type))return 'private';
 return 'business';
}
const benefits={
 business:[
  ['Un accueil à l’image de votre entreprise','Un coffee bar crée un point de rencontre naturel : vos invités prennent le temps d’échanger autour d’une boisson préparée à la demande.'],
  ['Votre marque jusque dans la tasse','Un bar et des gobelets à vos couleurs, ou votre logo sur la mousse, peuvent prolonger votre univers de marque. Ces personnalisations restent des options à choisir dans le devis.'],
  ['Une pause qui facilite les échanges','Sur un salon, un lancement ou un rendez-vous d’équipe, le comptoir invite à s’arrêter et à engager la conversation. Nous adaptons l’accueil au format de votre événement.'],
  ['Un coffee bar pris en charge de A à Z','Installation, matériel, service et rangement sont organisés par notre équipe. Nous faisons le point avec vous sur l’accès, l’emplacement et la prise électrique pour préparer notre venue.'],
  ['Votre projet est-il toujours d’actualité ?','Si votre événement est toujours prévu, votre devis rassemble la proposition et les options. Vous pouvez nous répondre avec vos questions ; nous vérifierons les disponibilités avant toute réservation.']
 ],
 private:[
  ['Une attention pour chacun de vos invités','Café, matcha, chai ou chocolat chaud : chaque invité choisit sa boisson, préparée à la demande. Un moment pour se retrouver et profiter ensemble.'],
  ['Un comptoir autour duquel on se retrouve','Le coffee bar apporte un lieu de rencontre à votre fête, où l’on peut discuter en regardant les boissons se préparer. Nous pouvons parler ensemble des goûts de vos invités.'],
  ['Vous profitez, nous assurons le service','Vous nous confiez le coffee bar : nous apportons le matériel et prenons en charge l’installation, le service et le rangement. Vous gardez votre attention pour vos proches.'],
  ['Préparons les petits détails ensemble','Boissons chaudes ou glacées, emplacement du comptoir, accès : un échange en amont permet d’adapter notre venue à votre fête. Une prise électrique 220 V standard à moins de 10 m est nécessaire.'],
  ['Votre fête est-elle toujours prévue ?','Votre devis reste le point de départ pour en parler. Répondez-nous si votre projet a évolué : nous reverrons les détails et les disponibilités avant réservation.']
 ],
 wedding:[
  ['Un moment pour se retrouver autour du café','Pour votre mariage ou le brunch du lendemain, un coffee bar offre à vos proches une boisson préparée à la demande et un comptoir autour duquel prolonger les échanges.'],
  ['Une attention qui accompagne votre journée','Vos invités choisissent leur boisson selon leurs envies. Nous pouvons voir ensemble la carte, les boissons chaudes ou glacées et les éventuelles personnalisations.'],
  ['Profitez de vos proches pendant le service','Notre équipe apporte le matériel et assure l’installation, le coffee bar et le rangement. Nous coordonnons avec vous les horaires et les conditions d’accueil du lieu.'],
  ['Une préparation avec votre lieu de réception','Avant le jour J, nous vérifions ensemble l’emplacement, l’accès et la prise électrique 220 V standard à moins de 10 m. Ces détails permettent de préparer sereinement notre installation.'],
  ['Où en êtes-vous dans les préparatifs ?','Si le coffee bar fait toujours partie de votre projet, répondez-nous avec vos questions. Votre devis nous permet de reprendre les détails et de vérifier la disponibilité de votre date.']
 ]
};
export function reminderMail(q,day,stopUrl){
 const index=reminderDays.indexOf(day);if(index<0)throw Error('INVALID_REMINDER_DAY');
 const [heading,value]=benefits[segment(q.eventType)][index];
 const content=shell({heading,intro:'Bonjour '+q.firstName+', '+value,rows:eventRows(q),amount:q.totalCents,amountLabel:'Votre proposition EYWA',buttons:[['Retrouver mon devis',(q.quoteUrl||q.documentUrl)],['Arrêter ces relances',stopUrl]],note:'Cette demande ne réserve pas votre date. Les relances s’arrêtent dès qu’un paiement lié à votre devis est confirmé, ou si vous choisissez de ne plus les recevoir.'});
 return {subject:heading+' — EYWA',...content};
}
export async function registerQuote(env,q,now=Date.now()){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 // Use the earliest Paris midnight offset as a conservative cut-off.
 // Never follow up on the event date, including across DST changes.
 const eventAt=Date.parse(q.date+'T00:00:00+02:00');
 await env.DB.batch([
  sql('INSERT INTO eywa_quote_state(quote_id,event_at,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING',q.id,eventAt,now),
  ...(q.followupConsent===true?reminderDays:[]).map(day=>sql('INSERT INTO eywa_reminders(quote_id,day,due_at) SELECT ?,?,? WHERE ?<? ON CONFLICT DO NOTHING',q.id,day,now+day*86400000,now+day*86400000,eventAt)),
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
  // If the worker was unavailable, do not send a burst of missed messages.
  const newer=await sql("SELECT day FROM eywa_reminders WHERE quote_id=? AND day>? AND due_at<=? AND state='pending' LIMIT 1",row.quote_id,row.day,now).first();
  if(newer||now-row.due_at>86400000){await sql("UPDATE eywa_reminders SET state='skipped' WHERE quote_id=? AND day=?",row.quote_id,row.day).run();continue;}
  const q=JSON.parse(row.data_json),id='reminder:'+q.id+':'+row.day;
  const stop='https://eywa-booking.eywa-booking-cloudflare.workers.dev/followup-stop?id='+q.id;
  const payload=reminderMail(q,row.day,stop);
  await env.DB.batch([
   sql("INSERT INTO eywa_email_outbox(id,recipient,payload_json,created_at,quote_id,kind) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM eywa_quote_state WHERE quote_id=? AND status='open' AND event_at>?) ON CONFLICT DO NOTHING",id,q.email,JSON.stringify(payload),now,q.id,'reminder',q.id,now),
   sql("UPDATE eywa_reminders SET state='queued' WHERE quote_id=? AND day=?",q.id,row.day)
  ]);
 }
}
