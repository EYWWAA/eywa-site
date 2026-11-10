import {invoiceURL,invoiceNumber} from './invoices.mjs';
import {stopQuote} from './followups.mjs';
const contactsSource='7c2d5417-97e7-4224-a357-84a7f9d369ab';
const dossiersSource='07254d77-93a8-4235-aa33-e7359fef0a29';
const rich=s=>[{type:'text',text:{content:String(s||'').slice(0,1900)}}];
const paragraph=s=>({object:'block',type:'paragraph',paragraph:{rich_text:rich(s)}});
const heading=s=>({object:'block',type:'heading_2',heading_2:{rich_text:rich(s)}});
const chunks=s=>String(s||'').match(/[\s\S]{1,1900}/g)||[''];
export function createNotionSync(env,fetcher=fetch){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);let lastRequest=0;
 async function api(path,method='GET',body){
  const wait=360-(Date.now()-lastRequest);if(wait>0)await new Promise(r=>setTimeout(r,wait));lastRequest=Date.now();
  const response=await fetcher('https://api.notion.com/v1/'+path,{method,headers:{Authorization:'Bearer '+env.EYWA_NOTION_TOKEN,'Notion-Version':'2025-09-03',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('NOTION_'+response.status);return response.json();
 }
 async function children(page){const all=[];let cursor='';do{const d=await api('blocks/'+page+'/children?page_size=100'+(cursor?'&start_cursor='+encodeURIComponent(cursor):''));all.push(...d.results);cursor=d.has_more?d.next_cursor:'';}while(cursor);return all;}
 async function contact(q){
  const d=await api('data_sources/'+contactsSource+'/query','POST',{filter:{property:'Email',email:{equals:q.email}},page_size:2});
  if(d.results.length)return d.results[0].id;
  return (await api('pages','POST',{parent:{data_source_id:contactsSource},properties:{Contact:{title:rich(q.name)},Email:{email:q.email},'Téléphone':{phone_number:q.phone||null},Organisation:{rich_text:rich(q.company)},Source:{url:(q.quoteUrl||q.documentUrl)}}})).id;
 }
 async function appendOnce(page,event,blocks){
  if(await sql('SELECT event_id FROM eywa_sync_events WHERE event_id=? AND notion_block_id IS NOT NULL',event.id).first())return;
  // Recover a successful append even if the previous HTTP response was lost.
  const marker='https://eywa-booking.eywa-booking-cloudflare.workers.dev/message-view?qid='+event.quoteId+'&message='+encodeURIComponent(event.id);
  const existing=(await children(page)).find(b=>JSON.stringify(b[b.type]?.rich_text||b[b.type]?.caption||[]).includes(marker));
  let block=existing;
  if(!block){const title={type:'text',text:{content:event.title.slice(0,1900),link:{url:marker}}};const r=await api('blocks/'+page+'/children','PATCH',{children:[{object:'block',type:'toggle',toggle:{rich_text:[title],children:blocks}}]});block=r.results[0];}
  await sql('INSERT INTO eywa_sync_events(event_id,quote_id,notion_block_id,data_json,created_at) VALUES(?,?,?,?,?) ON CONFLICT(event_id) DO UPDATE SET notion_block_id=excluded.notion_block_id',event.id,event.quoteId,block.id,JSON.stringify(event),Date.now()).run();
 }
 async function attachDocument(page,q,data){
  if(!data.pdf)return;
  const event={id:data.id,quoteId:q.id,title:data.title,text:data.url};
  if(await sql('SELECT event_id FROM eywa_sync_events WHERE event_id=? AND notion_block_id IS NOT NULL',data.id).first())return;
  const bytes=Uint8Array.from(atob(data.pdf),c=>c.charCodeAt(0));
  const upload=await api('file_uploads','POST',{mode:'single_part',filename:data.filename,content_type:data.contentType||'application/pdf'});
  const form=new FormData();form.set('file',new Blob([bytes],{type:data.contentType||'application/pdf'}),data.filename);
  const response=await fetcher(upload.upload_url,{method:'POST',headers:{Authorization:'Bearer '+env.EYWA_NOTION_TOKEN,'Notion-Version':'2025-09-03'},body:form,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('NOTION_FILE_UPLOAD_FAILED');
  await appendOnce(page,event,[{object:'block',type:'file',file:{type:'file_upload',file_upload:{id:upload.id},caption:rich(data.title)}},paragraph(data.url)]);
 }
 async function syncOne(job){
  const saved=await sql('SELECT data_json FROM eywa_quotes WHERE id=?',job.quote_id).first();if(!saved)return;
  const q=JSON.parse(saved.data_json),state=await sql('SELECT * FROM eywa_quote_state WHERE quote_id=?',q.id).first();
  const invoice=await sql('SELECT * FROM eywa_invoices WHERE quote_id=? ORDER BY seq DESC LIMIT 1',q.id).first();
  const paid=invoice?JSON.parse(invoice.data_json):null;
  const sent=await sql("SELECT sent_at FROM eywa_email_outbox WHERE id=? AND status='sent'",'quote:'+q.id+':client').first();
  const contactId=job.contact_id||await contact(q);
  const properties={Dossier:{title:rich(q.name+' — '+q.date)},Client:{relation:[{id:contactId}]},Date:{date:{start:q.date}},Total:{number:(paid?.totalCents??q.totalCents)/100},'Réglé':{number:(paid?.paidCents||0)/100},Devis:{url:(q.quoteUrl||q.documentUrl)},Facture:{url:invoice?invoiceURL(invoice)+'&format=pdf':null},'Référence':{rich_text:rich(q.reference)},Statut:{select:state?.status==='paid'?{name:'Réservé'}:sent?{name:'Devis envoyé'}:null}};
  let pageId=job.page_id;
  if(!pageId){const found=await api('data_sources/'+dossiersSource+'/query','POST',{filter:{property:'Référence',rich_text:{equals:q.reference}},page_size:2});pageId=found.results[0]?.id;}
  if(pageId){
   const current=await api('pages/'+pageId);
   if(state?.status!=='paid'&&['Annulé','Réservé'].includes(current.properties?.Statut?.select?.name)){await stopQuote(env,q.id);properties.Statut={select:{name:current.properties.Statut.select.name}};}
   await api('pages/'+pageId,'PATCH',{properties});
  }else{
   const contents=[paragraph('Contact : '+q.name+' · '+q.email+(q.phone?' · '+q.phone:'')),paragraph('Lieu : '+q.location+'\nService : '+q.time+' · '+q.hours+' h · '+q.guests+' invités · '+q.days+' jour(s)\nOptions : '+(q.options?.join(', ')||'Aucune')),heading('Devis'),paragraph('Référence : '+q.reference+'\nMontant proposé : '+(q.totalCents/100).toFixed(2)+' €\n'+(q.quoteUrl||q.documentUrl)),...(q.details?[paragraph('Demande du client : '+q.details)]:[]),heading('Échanges et documents')];
   pageId=(await api('pages','POST',{parent:{data_source_id:dossiersSource},properties,children:contents})).id;
  }
  await sql('UPDATE eywa_notion_jobs SET page_id=?,contact_id=? WHERE quote_id=?',pageId,contactId,q.id).run();
  const mailRows=(await sql("SELECT * FROM eywa_email_outbox WHERE quote_id=? AND status='sent' ORDER BY created_at",q.id).all()).results;
  for(const m of mailRows){const p=JSON.parse(m.payload_json),event={id:m.id,quoteId:q.id,title:p.subject+' · '+new Date(m.sent_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}),text:p.text,to:m.recipient};await appendOnce(pageId,event,[paragraph('À : '+m.recipient),...chunks(p.text).map(paragraph)]);}
  const quotePDF=await sql('SELECT pdf_base64 FROM eywa_quote_pdfs WHERE quote_id=?',q.id).first();
  if(quotePDF)await attachDocument(pageId,q,{id:'quote-pdf:'+q.id,pdf:quotePDF.pdf_base64,title:'Devis '+q.reference,filename:'Devis-'+q.reference+'.pdf',url:(q.quoteUrl||q.documentUrl)});
  if(invoice)await attachDocument(pageId,q,{id:'invoice:'+invoice.session_id,pdf:invoice.pdf_base64,title:'Facture '+invoiceNumber(invoice),filename:invoiceNumber(invoice)+'.pdf',url:invoiceURL(invoice)});
  if(invoice){
   const booking=await sql('SELECT details_json FROM eywa_bookings WHERE session_id=?',invoice.session_id).first();
   if(booking){const d=JSON.parse(booking.details_json),info={id:'organisation:'+invoice.session_id,quoteId:q.id,title:'Organisation confirmée de la prestation',text:['Adresse : '+d.address,'Contact sur place : '+d.contactName+' · '+d.phone,'Emplacement : '+d.setupLocation,'Extérieur : '+d.outdoor,'Déchargement : '+d.unloadParking,'Stationnement : '+(d.eventParking||'Non précisé'),'Tenue : '+d.dressCode+(d.dressDetails?' — '+d.dressDetails:''),'Accès 60 min avant : '+(d.access60?'confirmé':'à vérifier'),'Espace 2 m × 1 m : '+(d.space?'confirmé':'à vérifier'),'Prise 220 V à moins de 10 m : '+(d.power220?'confirmée':'à vérifier'),'Facturation : '+d.billingName].join('\n')};await appendOnce(pageId,info,chunks(info.text).map(paragraph));
    if(d.referencePhoto){const m=/^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(d.referencePhoto);if(m)await attachDocument(pageId,q,{id:'reference-photo:'+invoice.session_id,pdf:m[2],title:'Photo de référence du client',filename:'Reference-'+q.id+'.'+(m[1]==='jpeg'?'jpg':m[1]),contentType:'image/'+m[1],url:(q.quoteUrl||q.documentUrl)});}
   }
  }
  const messages=(await sql('SELECT * FROM eywa_sync_events WHERE quote_id=? AND notion_block_id IS NULL ORDER BY created_at LIMIT 10',q.id).all()).results;
  for(const m of messages){const e=JSON.parse(m.data_json);await appendOnce(pageId,e,[paragraph('De : '+e.from+'\nÀ : '+e.to),...chunks(e.text).map(paragraph)]);}
  await sql('UPDATE eywa_notion_jobs SET done_version=?,last_error=NULL,next_attempt=0 WHERE quote_id=?',job.version,q.id).run();
 }
 async function flush(){
  if(env.EYWA_AUTOMATION_ENABLED!=='true'||!env.EYWA_NOTION_TOKEN)return;
  const now=Date.now();await sql('INSERT INTO eywa_job_locks(name,until_at) VALUES(?,0) ON CONFLICT DO NOTHING','notion').run();
  if(!await sql('UPDATE eywa_job_locks SET until_at=? WHERE name=? AND until_at<? RETURNING name',now+240000,'notion',now).first())return;
  try{const jobs=(await sql('SELECT * FROM eywa_notion_jobs WHERE done_version<version AND next_attempt<=? ORDER BY next_attempt LIMIT 3',now).all()).results;for(const job of jobs){try{await syncOne(job);}catch{await sql('UPDATE eywa_notion_jobs SET last_error=?,next_attempt=? WHERE quote_id=?','NOTION_SYNC_FAILED',Date.now()+300000,job.quote_id).run();}}}
  finally{await sql('UPDATE eywa_job_locks SET until_at=0 WHERE name=?','notion').run();}
 }
 async function refreshStops(){
  if(!env.EYWA_NOTION_TOKEN)return;
  const jobs=(await sql("SELECT j.* FROM eywa_notion_jobs j JOIN eywa_quote_state s ON s.quote_id=j.quote_id WHERE j.page_id IS NOT NULL AND s.status='open' ORDER BY j.checked_at LIMIT 10").all()).results;
  for(const job of jobs){const page=await api('pages/'+job.page_id),status=page.properties?.Statut?.select?.name;if(['Annulé','Réservé'].includes(status))await stopQuote(env,job.quote_id);await sql('UPDATE eywa_notion_jobs SET checked_at=? WHERE quote_id=?',Date.now(),job.quote_id).run();}
 }
 return {flush,refreshStops};
}
