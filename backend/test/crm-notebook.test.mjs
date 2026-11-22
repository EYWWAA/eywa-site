import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crmDatabase} from './crm.test.mjs';
import {createNotebook} from '../src/lib/crm-notebook.mjs';
test('Notebook: tasks, daily routines, ideas and memos',async()=>{
 const DB=crmDatabase(),n=createNotebook({DB});try{
  await assert.rejects(()=>n.mutate('note',{kind:'task',title:''}),/titre/);
  await assert.rejects(()=>n.mutate('note',{kind:'bidon',title:'x'}),/Type/);
  const {id:t}=await n.mutate('note',{kind:'task',title:'Poncer le bar',category:'Bar et matériel',dueDate:'2026-12-01'});
  const {id:r}=await n.mutate('note',{kind:'task',title:'Appeler 2 personnes',category:'Routine',recurring:true});
  const {id:i}=await n.mutate('note',{kind:'idea',title:'Jeu concours',status:'retenue'});
  await n.mutate('note',{kind:'memo',title:'Mesures Brico Dépôt',details:'111,2 × 76,5 cm'});
  const day=Date.parse('2026-11-22T10:00:00Z');
  await n.mutate('note-done',{id:t,done:true},day);await n.mutate('note-done',{id:r,done:true},day);
  let l=await n.list();const get=id=>l.find(x=>x.id===id);
  assert.equal(get(t).status,'done');assert.equal(get(r).status,'todo');assert.equal(get(r).done_on,'2026-11-22');assert.equal(get(i).status,'retenue');assert.equal(l.length,4);
  await n.mutate('note',{id:i,kind:'idea',title:'Jeu concours',status:'abandonnee'});await n.mutate('note-delete',{id:t});
  l=await n.list();assert.equal(l.length,3);assert.equal(l.find(x=>x.id===i).status,'abandonnee');
 }finally{DB.raw.close();}
});
