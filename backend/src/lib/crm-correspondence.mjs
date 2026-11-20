import {randomUUID} from 'node:crypto';
import policy from './booking-policy.cjs';
import {escape,safeURL} from './mail-templates.mjs';
import {stopQuote} from './followups.mjs';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(v,max)=>String(v??'').trim().slice(0,max);
export function personalMail(q,draft){
 const subject=text(draft.subject,200).replace(/[\r\n]+/g,' '),body=text(draft.body_text,6000);
 const link=safeURL(q.quoteUrl||q.documentUrl||'');
 const paragraphs=body.split(/\n\s*\n/).map(p=>'<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#4a3c34">'+escape(p).replaceAll('\n','<br>')+'</p>').join('');
 const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(subject)+'</title></head><body style="margin:0;background:#ffffff;color:#291817;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#fffdf9" style="width:100%;max-width:600px;background:#fffdf9;border:1px solid #ece3d8;border-radius:10px"><tr><td style="padding:24px 28px;border-bottom:1px solid #ece3d8"><img src="https://eywacoffeecatering.com/assets/brand/eywa-wordmark-email-hd.png?v=20261120" alt="eywa coffee catering" width="160" style="display:block;width:160px;height:auto;border:0"></td></tr><tr><td style="padding:28px"><h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px;line-height:1.2;margin:0 0 22px">'+escape(subject)+'</h1>'+paragraphs+'<p style="font-size:15px;line-height:1.7;color:#4a3c34">Louis Le Poulain<br>EYWA Coffee Catering<br><a href="tel:+33749902156" style="color:#4a3c34">07 49 90 21 56</a></p>'+(link?'<p style="margin:24px 0"><a href="'+link+'" style="display:inline-block;padding:16px 28px;border-radius:6px;background:#d9b9a2;color:#291817;text-decoration:none;font-weight:bold">Voir le devis</a></p>':'')+'</td></tr></table></td></tr></table></body></html>';
 return {subject,html,text:body+'\n\nLouis Le Poulain\nEYWA Coffee Catering · 07 49 90 21 56'+(link?'\n\nVoir le devis : '+(q.quoteUrl||q.documentUrl):'')};
}
export function createCorrespondence(env){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 async function quote(id){const r=await sql('SELECT data_json FROM eywa_quotes WHERE id=?',text(id,100)).first();if(!r)fail('Devis introuvable.',404);return JSON.parse(r.data_json);}
 async function draft(id){const d=await sql('SELECT * FROM eywa_crm_mail_drafts WHERE id=?',text(id,100)).first();if(!d)fail('Brouillon introuvable.',404);return d;}
 async function details(id){
  const [tracking,drafts,reminders,status]=await Promise.all([
   sql('SELECT * FROM eywa_crm_quote_tracking WHERE quote_id=?',id).first(),
   sql("SELECT d.*,o.status AS delivery_status,o.last_error AS delivery_error,o.sent_at FROM eywa_crm_mail_drafts d LEFT JOIN eywa_email_outbox o ON o.id='crm-personal:'||d.id WHERE d.quote_id=? ORDER BY d.updated_at DESC LIMIT 30",id).all(),
   sql("SELECT r.day,r.due_at,r.state,o.status AS delivery_status,o.sent_at,o.last_error FROM eywa_reminders r LEFT JOIN eywa_email_outbox o ON o.id='reminder:'||r.quote_id||':'||r.day WHERE r.quote_id=? ORDER BY r.day",id).all(),
   sql('SELECT status FROM eywa_quote_state WHERE quote_id=?',id).first()
  ]);
  return {tracking:tracking||{quote_id:id,stage:'new',notes:'',next_action_date:null,version:0},drafts:drafts.results,reminders:reminders.results,quoteState:status?.status||'open'};
 }
 async function saveTracking(b,now=Date.now()){
  await quote(b.quoteId);if(!['new','contacted','waiting','lost'].includes(b.stage)||b.nextActionDate&&!policy.validDate(b.nextActionDate))fail('Suivi du devis invalide.');
  if(b.stage==='lost'&&(await sql('SELECT status FROM eywa_quote_state WHERE quote_id=?',b.quoteId).first())?.status==='paid')fail('Cette réservation est déjà réglée. Son suivi ne peut pas passer sans suite.',409);
  const row=Number(b.version)===0?
   await sql('INSERT INTO eywa_crm_quote_tracking(quote_id,stage,notes,next_action_date,updated_at) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING quote_id',b.quoteId,b.stage,text(b.notes,6000),b.nextActionDate||null,now).first():
   await sql('UPDATE eywa_crm_quote_tracking SET stage=?,notes=?,next_action_date=?,updated_at=?,version=version+1 WHERE quote_id=? AND version=? RETURNING quote_id',b.stage,text(b.notes,6000),b.nextActionDate||null,now,b.quoteId,Number(b.version)).first();
  if(!row)fail('Le suivi a changé. Rechargez le dossier.',409);
  if(b.stage==='lost')await stopQuote(env,b.quoteId);
  return {ok:true};
 }
 async function saveDraft(b,now=Date.now()){
  await quote(b.quoteId);const subject=text(b.subject,200).replace(/[\r\n]+/g,' '),body=text(b.body,6000);if(!subject)fail('Ajoutez un objet au message.');
  let id=b.id;
  if(id){const row=await sql("UPDATE eywa_crm_mail_drafts SET subject=?,body_text=?,version=version+1,updated_at=? WHERE id=? AND quote_id=? AND status='draft' AND version=? RETURNING id",subject,body,now,id,b.quoteId,Number(b.version)).first();if(!row)fail('Le brouillon a changé ou a déjà été envoyé. Rechargez le dossier.',409);}
  else{id=randomUUID();try{await sql('INSERT INTO eywa_crm_mail_drafts(id,quote_id,subject,body_text,updated_at) VALUES(?,?,?,?,?)',id,b.quoteId,subject,body,now).run();}catch{fail('Un brouillon existe déjà. Rechargez le dossier pour le retrouver.',409);}}
  return {ok:true,id};
 }
 async function preview(id){const d=await draft(id);return personalMail(await quote(d.quote_id),d);}
 async function send(b,mailer,now=Date.now()){
  const d=await draft(b.id),id='crm-personal:'+d.id,q=await quote(d.quote_id);
  if(d.status==='queued')return {ok:true,id,status:(await sql('SELECT status FROM eywa_email_outbox WHERE id=?',id).first())?.status||'pending'};
  if(d.version!==Number(b.version))fail('Le brouillon a changé. Relisez-le avant l’envoi.',409);
  if(!d.body_text.trim())fail('Le message est vide.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.email||''))fail('L’adresse du client est invalide.');
  if(env.EYWA_AUTOMATION_ENABLED!=='true')fail('Envoi désactivé dans cet environnement.',409);
  const payload=personalMail(q,d);
  const results=await env.DB.batch([
   sql("INSERT INTO eywa_email_outbox(id,recipient,payload_json,created_at,quote_id,kind) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM eywa_crm_mail_drafts WHERE id=? AND status='draft' AND version=?) ON CONFLICT(id) DO NOTHING",id,q.email,JSON.stringify(payload),now,d.quote_id,'crm-personal',d.id,d.version),
   sql("UPDATE eywa_crm_mail_drafts SET status='queued',updated_at=? WHERE id=? AND status='draft' AND version=?",now,d.id,d.version)
  ]);
  if(!results[1]?.meta?.changes&&!await sql('SELECT id FROM eywa_email_outbox WHERE id=?',id).first())fail('Le brouillon a changé. Rechargez le dossier.',409);
  await mailer.deliver(id);
  return {ok:true,id,status:(await sql('SELECT status FROM eywa_email_outbox WHERE id=?',id).first())?.status||'pending'};
 }
 return {details,saveTracking,saveDraft,preview,send};
}
