export async function syncGmail(env,fetcher=fetch){
 if(env.EYWA_AUTOMATION_ENABLED!=='true'||env.EYWA_GMAIL_ARCHIVE_ENABLED!=='true')return;
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 const contacts=(await sql("SELECT json_extract(q.data_json,'$.email') AS email,COALESCE(c.scanned_at,0) AS scanned_at,c.page_token,c.range_end FROM eywa_quotes q JOIN eywa_quote_state s ON s.quote_id=q.id LEFT JOIN eywa_mail_cursors c ON c.email=json_extract(q.data_json,'$.email') WHERE s.created_at>? GROUP BY email ORDER BY scanned_at LIMIT 3",Date.now()-3*365*86400000).all()).results;
 for(const c of contacts){
  if(c.email.toLowerCase()==='contact.eywa08@gmail.com')continue;
  const end=c.range_end||Date.now();
  const response=await fetcher(env.EYWA_MAIL_RELAY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.EYWA_MAIL_RELAY_SECRET,action:'messages',email:c.email,after:Math.max(0,c.scanned_at-120000),before:end,pageToken:c.page_token||''}),redirect:'follow',signal:AbortSignal.timeout(25000)});
  const data=await response.json();if(!response.ok||data.ok!==true)continue;
  const quotes=(await sql("SELECT id FROM eywa_quotes WHERE json_extract(data_json,'$.email')=?",c.email).all()).results;
  const delivered=(await sql("SELECT payload_json FROM eywa_email_outbox WHERE recipient=? AND status='sent'",c.email).all()).results.map(r=>JSON.parse(r.payload_json));
  const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
  const messages=(data.messages||[]).filter(m=>/^[a-fA-F0-9]+$/.test(m.id)&&Number.isFinite(m.at)&&m.at<=end).filter(m=>!(/(?:^|[<\s])contact\.eywa08@gmail\.com(?:$|[>\s])/i.test(m.from||'')&&delivered.some(d=>d.subject===m.subject&&normalize(d.text)===normalize(m.text))));
  const statements=[];
  for(const m of messages)for(const q of quotes){const event={id:'gmail:'+m.id+':'+q.id,quoteId:q.id,title:String(m.subject||'(Sans objet)').slice(0,250)+' · '+new Date(m.at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}),text:String(m.text||'').slice(0,60000),from:String(m.from||'').slice(0,500),to:String(m.to||'').slice(0,500)};statements.push(sql('INSERT INTO eywa_sync_events(event_id,quote_id,data_json,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING',event.id,q.id,JSON.stringify(event),m.at));}
  for(const q of quotes)if(messages.length)statements.push(sql('UPDATE eywa_notion_jobs SET version=version+1 WHERE quote_id=?',q.id));
  statements.push(sql('INSERT INTO eywa_mail_cursors(email,scanned_at,page_token,range_end) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET scanned_at=excluded.scanned_at,page_token=excluded.page_token,range_end=excluded.range_end',c.email,data.nextPageToken?c.scanned_at:end,data.nextPageToken||null,data.nextPageToken?end:null));
  for(let i=0;i<statements.length;i+=60)await env.DB.batch(statements.slice(i,i+60));
 }
}
