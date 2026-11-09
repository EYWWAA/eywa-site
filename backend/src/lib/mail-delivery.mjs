export function createMailer(env,fetcher=fetch){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 async function enqueue(id,to,payload,quoteId=null,kind=null){await sql('INSERT INTO eywa_email_outbox(id,recipient,payload_json,created_at,quote_id,kind) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',id,to,JSON.stringify(payload),Date.now(),quoteId,kind).run();}
 async function deliver(id){
  if(env.EYWA_AUTOMATION_ENABLED!=='true')return;
  const now=Date.now();const row=await sql("UPDATE eywa_email_outbox SET status='sending',lease_until=?,attempts=attempts+1 WHERE id=? AND ((status='pending' AND next_attempt<=?) OR (status='sending' AND lease_until<?)) RETURNING *",now+120000,id,now,now).first();if(!row)return;
  try{
   if(row.kind==='reminder'){
    const allowed=await sql("SELECT quote_id FROM eywa_quote_state s WHERE quote_id=? AND status='open' AND event_at>? AND NOT EXISTS (SELECT 1 FROM eywa_bookings b WHERE b.state IN ('held','paid') AND json_extract(b.details_json,'$.quoteId')=s.quote_id)",row.quote_id,now).first();
    if(!allowed){await sql("DELETE FROM eywa_email_outbox WHERE id=? AND status='sending'",id).run();return;}
   }
   if(!env.EYWA_MAIL_RELAY_URL||!env.EYWA_MAIL_RELAY_SECRET)throw Error('MAIL_NOT_CONFIGURED');
   if(env.EYWA_MAIL_TEST_RECIPIENTS&&!env.EYWA_MAIL_TEST_RECIPIENTS.split(',').map(s=>s.trim().toLowerCase()).includes(row.recipient.toLowerCase()))throw Error('TEST_RECIPIENT_ONLY');
   const endpoint=new URL(env.EYWA_MAIL_RELAY_URL);if(endpoint.protocol!=='https:'||endpoint.hostname!=='script.google.com')throw Error('INVALID_MAIL_RELAY');
   const response=await fetcher(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.EYWA_MAIL_RELAY_SECRET,action:'send',id:row.id,to:row.recipient,...JSON.parse(row.payload_json)}),redirect:'follow',signal:AbortSignal.timeout(25000)});
   const result=await response.json();if(!response.ok||result.ok!==true)throw Error('MAIL_PROVIDER_FAILED');
   const payload=JSON.parse(row.payload_json),updates=[sql("UPDATE eywa_email_outbox SET status='sent',sent_at=?,provider_id=?,last_error=NULL,lease_until=0 WHERE id=? AND status='sending'",Date.now(),String(result.id||row.id),id)];
   if(payload.quoteDocument&&typeof result.pdf==='string'&&result.pdf.length<=1500000&&/^[A-Za-z0-9+/]+=*$/.test(result.pdf))updates.push(sql('INSERT INTO eywa_quote_pdfs(quote_id,pdf_base64) VALUES(?,?) ON CONFLICT DO NOTHING',payload.quoteDocument.quoteId,result.pdf));
   if(payload.invoice&&typeof result.pdf==='string'&&result.pdf.length<=1500000&&/^[A-Za-z0-9+/]+=*$/.test(result.pdf))updates.push(sql('UPDATE eywa_invoices SET pdf_base64=COALESCE(pdf_base64,?) WHERE token=?',result.pdf,payload.invoice.token));
   if(row.quote_id)updates.push(sql('UPDATE eywa_notion_jobs SET version=version+1 WHERE quote_id=?',row.quote_id));
   await env.DB.batch(updates);
  }catch(error){await sql("UPDATE eywa_email_outbox SET status='pending',next_attempt=?,lease_until=0,last_error=? WHERE id=? AND status='sending'",Date.now()+Math.min(3600000,30000*2**Math.min(row.attempts,7)),['MAIL_NOT_CONFIGURED','TEST_RECIPIENT_ONLY'].includes(error.message)?error.message:'MAIL_DELIVERY_FAILED',id).run();}
 }
 async function flush(){const rows=(await sql("SELECT id FROM eywa_email_outbox WHERE (status='pending' AND next_attempt<=?) OR (status='sending' AND lease_until<?) ORDER BY created_at LIMIT 6",Date.now(),Date.now()).all()).results;for(const row of rows)await deliver(row.id);}
 return {enqueue,deliver,flush};
}
