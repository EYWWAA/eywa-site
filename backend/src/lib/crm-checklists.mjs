// Checklists réutilisables, sur le modèle de Flashquotes :
// - « brief » : le jour J, en 6 étapes, avec quantités ;
// - « admin » : le back-office, chaque tâche datée J-x ou J+x par rapport à l'événement.
import {randomUUID} from 'node:crypto';
import policy from './booking-policy.cjs';

export const stages={prep:'Préparation et chargement',travel:'Trajet',setup:'Installation',service:'Service',cleanup:'Rangement',return:'Retour et déchargement'};
const fail=(s,status=400)=>{throw Object.assign(Error(s),{status});};
const text=(s,n)=>String(s??'').trim().slice(0,n);
function quantity(v){if(v===''||v===null||v===undefined)return null;const n=Number(String(v).replace(',','.'));if(!Number.isFinite(n)||n<0||n>100000)fail('Quantité invalide.');return n;}

export function createChecklists(env){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 async function library(){
  const lists=(await sql('SELECT * FROM eywa_crm_checklists ORDER BY kind,is_default DESC,name').all()).results;
  const items=(await sql('SELECT * FROM eywa_crm_checklist_items ORDER BY checklist_id,position').all()).results;
  return lists.map(l=>({...l,items:items.filter(i=>i.checklist_id===l.id)}));
 }
 async function defaultOf(kind){return sql('SELECT id FROM eywa_crm_checklists WHERE kind=? AND is_default=1',kind).first();}
 const itemsOf=async id=>(await sql('SELECT * FROM eywa_crm_checklist_items WHERE checklist_id=? ORDER BY position',id).all()).results;
 // Copie une checklist admin en tâches datées, et une checklist brief en éléments du jour J.
 function adminStatements(eventId,date,items,now){return items.map(i=>sql('INSERT INTO eywa_crm_tasks(id,event_id,title,due_date,created_at) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING',eventId+':cl:'+i.id,eventId,i.label,policy.addDays(date,i.offset_days),now));}
 function briefStatements(eventId,items,now){return items.map(i=>sql('INSERT INTO eywa_crm_brief_items(id,event_id,stage,label,quantity,unit,position,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',eventId+':cl:'+i.id,eventId,i.stage,i.label,i.quantity,i.unit,i.position,now));}
 async function applyDefaults(eventId,date,now=Date.now()){
  const statements=[];
  const a=await defaultOf('admin');if(a)statements.push(...adminStatements(eventId,date,await itemsOf(a.id),now));
  const b=await defaultOf('brief');if(b)statements.push(...briefStatements(eventId,await itemsOf(b.id),now));
  for(let i=0;i<statements.length;i+=60)await env.DB.batch(statements.slice(i,i+60));
 }
 async function brief(eventId){return (await sql('SELECT * FROM eywa_crm_brief_items WHERE event_id=? ORDER BY position,created_at',eventId).all()).results;}
 async function mutate(action,b,now=Date.now()){
  if(action==='checklist'){
   if(!['brief','admin'].includes(b.kind))fail('Type de checklist invalide.');
   const name=text(b.name,120);if(!name)fail('Donnez un nom à la checklist.');
   const items=Array.isArray(b.items)?b.items.slice(0,200):[];
   const clean=items.map((it,i)=>{const label=text(it.label,300);if(!label)return null;
    if(b.kind==='brief'&&!(it.stage in stages))fail('Étape invalide.');
    const offset=Number(it.offsetDays??0);if(b.kind==='admin'&&(!Number.isInteger(offset)||offset<-365||offset>365))fail('Le nombre de jours doit être entre -365 et 365.');
    return {id:text(it.id,100)||randomUUID(),stage:b.kind==='brief'?it.stage:'',label,quantity:b.kind==='brief'?quantity(it.quantity):null,unit:b.kind==='brief'?text(it.unit,30):'',offset:b.kind==='admin'?offset:0,position:i+1};}).filter(Boolean);
   const id=b.id?text(b.id,100):randomUUID();
   const current=b.id?await sql('SELECT kind FROM eywa_crm_checklists WHERE id=?',id).first():null;if(b.id&&!current)fail('Checklist introuvable.',404);if(current&&current.kind!==b.kind)fail('Le type d’une checklist ne peut pas changer.');
   const hasDefault=await defaultOf(b.kind);
   const statements=[current?sql('UPDATE eywa_crm_checklists SET name=?,description=?,updated_at=? WHERE id=?',name,text(b.description,300),now,id):sql('INSERT INTO eywa_crm_checklists(id,kind,name,description,is_default,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,b.kind,name,text(b.description,300),hasDefault?0:1,now,now),
    sql('DELETE FROM eywa_crm_checklist_items WHERE checklist_id=?',id),
    ...clean.map(c=>sql('INSERT INTO eywa_crm_checklist_items(id,checklist_id,stage,label,quantity,unit,offset_days,position) VALUES(?,?,?,?,?,?,?,?)',c.id,id,c.stage,c.label,c.quantity,c.unit,c.offset,c.position))];
   await env.DB.batch(statements);return {ok:true,id};
  }
  if(action==='checklist-default'){
   const l=await sql('SELECT id,kind FROM eywa_crm_checklists WHERE id=?',text(b.id,100)).first();if(!l)fail('Checklist introuvable.',404);
   await env.DB.batch([sql('UPDATE eywa_crm_checklists SET is_default=0 WHERE kind=?',l.kind),sql('UPDATE eywa_crm_checklists SET is_default=1 WHERE id=?',l.id)]);return {ok:true};
  }
  if(action==='checklist-duplicate'){
   const l=await sql('SELECT * FROM eywa_crm_checklists WHERE id=?',text(b.id,100)).first();if(!l)fail('Checklist introuvable.',404);
   const id=randomUUID(),items=await itemsOf(l.id);
   await env.DB.batch([sql('INSERT INTO eywa_crm_checklists(id,kind,name,description,is_default,created_at,updated_at) VALUES(?,?,?,?,0,?,?)',id,l.kind,(l.name+' (copie)').slice(0,120),l.description,now,now),...items.map(i=>sql('INSERT INTO eywa_crm_checklist_items(id,checklist_id,stage,label,quantity,unit,offset_days,position) VALUES(?,?,?,?,?,?,?,?)',randomUUID(),id,i.stage,i.label,i.quantity,i.unit,i.offset_days,i.position))]);
   return {ok:true,id};
  }
  if(action==='checklist-delete'){
   const l=await sql('SELECT id,kind,is_default FROM eywa_crm_checklists WHERE id=?',text(b.id,100)).first();if(!l)fail('Checklist introuvable.',404);
   if(l.is_default)fail('Choisissez d’abord une autre checklist par défaut.');
   await env.DB.batch([sql('DELETE FROM eywa_crm_checklist_items WHERE checklist_id=?',l.id),sql('DELETE FROM eywa_crm_checklists WHERE id=?',l.id)]);return {ok:true};
  }
  if(action==='checklist-apply-upcoming'){
   const kind=b.kind==='brief'?'brief':'admin',d=await defaultOf(kind);if(!d)fail('Aucune checklist par défaut.');
   const items=await itemsOf(d.id),events=(await sql("SELECT id,json_extract(data_json,'$.date') AS date FROM eywa_crm_events WHERE status NOT IN ('cancelled','completed') AND json_extract(data_json,'$.date')>=?",policy.today(new Date(now))).all()).results;
   let added=0;
   for(const e of events){
    const existing=new Set((kind==='admin'?(await sql('SELECT title AS l FROM eywa_crm_tasks WHERE event_id=?',e.id).all()):(await sql('SELECT label AS l FROM eywa_crm_brief_items WHERE event_id=?',e.id).all())).results.map(r=>r.l));
    const missing=items.filter(i=>!existing.has(i.label));added+=missing.length;
    const st=kind==='admin'?adminStatements(e.id,e.date,missing,now):briefStatements(e.id,missing,now);
    for(let i=0;i<st.length;i+=60)await env.DB.batch(st.slice(i,i+60));
   }
   return {ok:true,added,events:events.length};
  }
  if(action==='event-checklist-replace'){
   const e=await sql("SELECT id,json_extract(data_json,'$.date') AS date FROM eywa_crm_events WHERE id=?",text(b.eventId,150)).first();if(!e)fail('Événement introuvable.',404);
   const l=await sql('SELECT id,kind FROM eywa_crm_checklists WHERE id=?',text(b.checklistId,100)).first();if(!l)fail('Checklist introuvable.',404);
   const items=await itemsOf(l.id);
   if(l.kind==='admin')await env.DB.batch([sql("DELETE FROM eywa_crm_tasks WHERE event_id=? AND id LIKE ?",e.id,e.id+':cl:%'),...adminStatements(e.id,e.date,items,now)]);
   else await env.DB.batch([sql('DELETE FROM eywa_crm_brief_items WHERE event_id=?',e.id),...briefStatements(e.id,items,now)]);
   return {ok:true,id:e.id};
  }
  if(action==='brief-item'){
   if(b.id&&b.done!==undefined&&b.label===undefined){const r=await sql('UPDATE eywa_crm_brief_items SET done=? WHERE id=? RETURNING event_id',b.done===true?1:0,text(b.id,200)).first();if(!r)fail('Élément introuvable.',404);return {ok:true,id:r.event_id};}
   if(b.delete===true){const r=await sql('DELETE FROM eywa_crm_brief_items WHERE id=? RETURNING event_id',text(b.id,200)).first();if(!r)fail('Élément introuvable.',404);return {ok:true,id:r.event_id};}
   const e=await sql('SELECT id FROM eywa_crm_events WHERE id=?',text(b.eventId,150)).first();if(!e)fail('Événement introuvable.',404);
   if(!(b.stage in stages))fail('Étape invalide.');const label=text(b.label,300);if(!label)fail('Décrivez l’élément.');
   const pos=(await sql('SELECT COALESCE(MAX(position),0)+1 AS p FROM eywa_crm_brief_items WHERE event_id=?',e.id).first()).p;
   await sql('INSERT INTO eywa_crm_brief_items(id,event_id,stage,label,quantity,unit,position,created_at) VALUES(?,?,?,?,?,?,?,?)',randomUUID(),e.id,b.stage,label,quantity(b.quantity),text(b.unit,30),pos,now).run();
   return {ok:true,id:e.id};
  }
  if(action==='task-delete'){const r=await sql('DELETE FROM eywa_crm_tasks WHERE id=? RETURNING event_id',text(b.id,150)).first();if(!r)fail('Tâche introuvable.',404);return {ok:true,id:r.event_id};}
  fail('Action inconnue.',404);
 }
 return {library,applyDefaults,brief,mutate};
}
