import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crmDatabase} from './crm.test.mjs';
import {createCRM} from '../src/lib/crm.mjs';
import {createChecklists} from '../src/lib/crm-checklists.mjs';
const envFor=DB=>({DB,EYWA_AUTOMATION_ENABLED:'true',EYWA_MAIL_RELAY_SECRET:'local-test-only'});
const manual={name:'Client fictif',email:'fixture@example.com',date:'2099-06-01',time:'10:00',hours:2,days:1,guests:70,eventType:'Salon professionnel',location:'Lieu fictif'};
test('Checklists: defaults are copied to new events, dated J-x, and stay independent from the library',async()=>{
 const DB=crmDatabase(),crm=createCRM(envFor(DB)),cl=createChecklists(envFor(DB));try{
  const lib=await cl.library();assert.equal(lib.filter(l=>l.is_default).length,2);
  const {id}=await crm.mutate('manual-event',manual);
  const tasks=DB.raw.prepare('SELECT title,due_date FROM eywa_crm_tasks WHERE event_id=? ORDER BY due_date').all(id);
  assert.equal(tasks[0].due_date,'2099-05-18');assert.equal(tasks.at(-1).due_date,'2099-07-01');
  const brief=await cl.brief(id);assert.equal(brief.length,27);assert.deepEqual([...new Set(brief.map(b=>b.stage))],['prep','travel','setup','service','cleanup','return']);
  await crm.mutate('brief-item',{id:brief[0].id,done:true});assert.equal((await cl.brief(id))[0].done,1);
  await crm.mutate('brief-item',{eventId:id,stage:'prep',label:'Lait entier',quantity:'6',unit:'L'});assert.equal((await cl.brief(id)).find(b=>b.label==='Lait entier').quantity,6);
  await assert.rejects(()=>crm.mutate('brief-item',{eventId:id,stage:'nope',label:'x'}),/Étape/);
  const {id:wedding}=await crm.mutate('checklist',{kind:'brief',name:'Mariage',items:[{stage:'setup',label:'Arche fleurie',quantity:1,unit:'pièce'}]});
  await crm.mutate('event-checklist-replace',{eventId:id,checklistId:wedding});assert.deepEqual((await cl.brief(id)).map(b=>b.label),['Arche fleurie']);
  await assert.rejects(()=>crm.mutate('checklist-delete',{id:'default-brief'}),/par défaut/);
  await crm.mutate('checklist-default',{id:wedding});await crm.mutate('checklist-delete',{id:'default-brief'});
  const {id:copy}=await crm.mutate('checklist-duplicate',{id:'default-admin'});assert.equal((await cl.library()).find(l=>l.id===copy).items.length,7);
  await crm.mutate('checklist',{id:'default-admin',kind:'admin',name:'Prestation standard',items:[{label:'Nouvelle tâche J-3',offsetDays:-3}]});
  const r=await crm.mutate('checklist-apply-upcoming',{kind:'admin'});assert.equal(r.added,1);
  await assert.rejects(()=>crm.mutate('checklist',{kind:'admin',name:'X',items:[{label:'a',offsetDays:999}]}),/365/);
 }finally{DB.raw.close();}
});
