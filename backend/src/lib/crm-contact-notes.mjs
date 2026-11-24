// Notes de la fiche contact : plusieurs notes par contact, épinglables.
import {randomUUID} from 'node:crypto';

const fail=(s,status=400)=>{throw Object.assign(Error(s),{status});};
const text=(s,n)=>String(s??'').trim().slice(0,n);

export function createContactNotes(env){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 async function list(){return (await sql('SELECT id,contact_key,body,pinned,created_at FROM eywa_crm_contact_notes ORDER BY pinned DESC,created_at DESC LIMIT 3000').all()).results;}
 async function mutate(action,b,now=Date.now()){
  if(action==='contact-note'){
   const key=text(b.contactKey,300),body=text(b.body,4000);if(!key)fail('Contact introuvable.');if(!body)fail('Écrivez votre note.');
   await sql('INSERT INTO eywa_crm_contact_notes(id,contact_key,body,pinned,created_at) VALUES(?,?,?,0,?)',randomUUID(),key,body,now).run();return {ok:true};
  }
  if(action==='contact-note-pin'){
   const r=await sql('UPDATE eywa_crm_contact_notes SET pinned=? WHERE id=? RETURNING id',b.pinned===true?1:0,text(b.id,100)).first();if(!r)fail('Note introuvable.',404);return {ok:true};
  }
  if(action==='contact-note-delete'){
   const r=await sql('DELETE FROM eywa_crm_contact_notes WHERE id=? RETURNING id',text(b.id,100)).first();if(!r)fail('Note introuvable.',404);return {ok:true};
  }
  fail('Action inconnue.',404);
 }
 return {list,mutate};
}
