// Carnet : tâches (dont routines quotidiennes), idées et mémo.
import {randomUUID} from 'node:crypto';
import policy from './booking-policy.cjs';

export const noteKinds={task:'Tâche',idea:'Idée',memo:'Mémo'};
export const ideaStatuses={'a-creuser':'À creuser',retenue:'Retenue',abandonnee:'Abandonnée'};
const fail=(s,status=400)=>{throw Object.assign(Error(s),{status});};
const text=(s,n)=>String(s??'').trim().slice(0,n);
function day(v){const s=text(v,10);if(!s)return null;if(!policy.validDate(s))fail('Date invalide.');return s;}

export function createNotebook(env){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 async function list(){return (await sql('SELECT id,kind,title,details,category,status,due_date,recurring,done_on,position,updated_at FROM eywa_crm_notes ORDER BY kind,position,created_at LIMIT 3000').all()).results;}
 async function mutate(action,b,now=Date.now()){
  const today=policy.today(new Date(now));
  if(action==='note'){
   if(!(b.kind in noteKinds))fail('Type invalide.');
   const title=text(b.title,300);if(!title)fail('Donnez un titre.');
   const status=b.kind==='idea'?(b.status in ideaStatuses?b.status:'a-creuser'):b.kind==='task'?(b.status==='done'?'done':'todo'):'';
   const row=[b.kind,title,text(b.details,6000),text(b.category,80),status,b.kind==='task'?day(b.dueDate):null,b.kind==='task'&&b.recurring===true?1:0];
   if(b.id){const r=await sql('UPDATE eywa_crm_notes SET kind=?,title=?,details=?,category=?,status=?,due_date=?,recurring=?,updated_at=? WHERE id=? RETURNING id',...row,now,text(b.id,100)).first();if(!r)fail('Élément introuvable.',404);return {ok:true,id:r.id};}
   const id=randomUUID(),pos=(await sql('SELECT COALESCE(MAX(position),0)+1 AS p FROM eywa_crm_notes WHERE kind=?',b.kind).first()).p;
   await sql('INSERT INTO eywa_crm_notes(id,kind,title,details,category,status,due_date,recurring,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,...row,pos,now,now).run();
   return {ok:true,id};
  }
  if(action==='note-done'){
   const n=await sql("SELECT id,recurring FROM eywa_crm_notes WHERE id=? AND kind='task'",text(b.id,100)).first();if(!n)fail('Tâche introuvable.',404);
   if(n.recurring)await sql('UPDATE eywa_crm_notes SET done_on=?,updated_at=? WHERE id=?',b.done===true?today:null,now,n.id).run();
   else await sql('UPDATE eywa_crm_notes SET status=?,done_on=?,updated_at=? WHERE id=?',b.done===true?'done':'todo',b.done===true?today:null,now,n.id).run();
   return {ok:true,id:n.id};
  }
  if(action==='note-delete'){const r=await sql('DELETE FROM eywa_crm_notes WHERE id=? RETURNING id',text(b.id,100)).first();if(!r)fail('Élément introuvable.',404);return {ok:true};}
  fail('Action inconnue.',404);
 }
 return {list,mutate};
}
