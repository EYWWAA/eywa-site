import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {database} from './booking.test.mjs';
import {createCRM} from '../src/lib/crm.mjs';
import {createOrders,orderCategories,suggestions,supplierLink} from '../src/lib/crm-orders.mjs';
import {crmHTTP} from '../src/lib/crm-http.mjs';
function setup(){const DB=database();for(const f of ['0003_transactional_email.sql','0004_automation.sql','0006_balance_invoices.sql'])DB.raw.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));return {DB};}
const sample={name:'Client fictif',email:'fixture@example.invalid',date:'2027-06-15',time:'10:00',hours:2,days:1,guests:50,eventType:'Mariage'};
const payload=o=>({id:o.id,updatedAt:o.updated_at,quantity:o.quantity??'',quantityConfirmed:!!o.quantity_confirmed,supplierId:o.supplier_id||'',status:o.status,artworkStatus:o.artwork_status,clientRequest:o.client_request,format:o.format,artworkUrl:o.artwork_url,orderReference:o.order_reference,orderUrl:o.order_url,dueDate:o.due_date||'',notes:o.notes});
test('orders: each selected option gets the right supply item, with plain cups for stickers',()=>{
 assert.deepEqual(orderCategories({options:[]}),['cups-plain']);
 assert.deepEqual(orderCategories({options:['Gobelets avec stickers','Habillage du bar','Logo sur les boissons']}),['cups-plain','stickers','bar-wrap','foam']);
 assert.deepEqual(orderCategories({options:['Gobelets sur mesure']}),['cups-printed']);
});
test('orders: suggestions require confirmed quantity, enabled supplier, matching range and sufficient lead time',()=>{
 const s={id:'supplier',name:'Fixture',category:'cups-printed',url:'https://example.com',active:1,preferred:1,min_quantity:250,max_quantity:500,lead_days:21,priority:10},o={category:'cups-printed',quantity:300,quantity_confirmed:1};
 assert.equal(suggestions([s],o,'2027-06-30',new Date('2027-06-01')).length,1);
 for(const change of [{quantity_confirmed:0},{quantity:50},{quantity:501},{category:'stickers'}])assert.equal(suggestions([s],{...o,...change},'2027-06-30',new Date('2027-06-01')).length,0);
 assert.equal(suggestions([{...s,preferred:0}],o,'2027-06-30',new Date('2027-06-01')).length,0);
 assert.equal(suggestions([s],o,'2027-06-10',new Date('2027-06-01')).length,0);
 assert.equal(suggestions([{...s,lead_days:null}],o,'2027-06-30',new Date('2027-06-01')).length,0);
});
test('orders: Notion supplier seeds remain candidates and do not silently become selected',async()=>{
 const env=setup(),crm=createCRM(env),orders=createOrders(env);try{
  const list=await orders.suppliers();assert.equal(list.length,10);assert(list.every(s=>s.preferred===0));assert.equal(list.find(s=>s.id==='pixeprint-cups').min_quantity,250);
  const {id}=await crm.mutate('manual-event',sample);const d=await orders.details(id);assert.equal(d.orders.length,1);assert.equal(d.orders[0].supplier_id,null);assert.equal(d.orders[0].quantity,null);assert.deepEqual(d.orders[0].suggestions,[]);
  await orders.details(id);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_crm_orders').get().n,1);
 }finally{env.DB.raw.close();}
});
test('orders: order validation prevents wrong category, missing quantity, unapproved artwork and below-minimum order',async()=>{
 const env=setup(),crm=createCRM(env),orders=createOrders(env);try{
  const {id}=await crm.mutate('manual-event',sample);env.DB.raw.prepare("UPDATE eywa_crm_events SET data_json=json_set(data_json,'$.options',json(?)) WHERE id=?").run('["Gobelets sur mesure"]',id);
  let o=(await orders.details(id)).orders[0];const b={...payload(o),supplierId:'pixeprint-cups',status:'ready',artworkStatus:'approved'};
  await assert.rejects(()=>orders.mutate('order',b),/quantité/);
  await assert.rejects(()=>orders.mutate('order',{...b,quantity:300,quantityConfirmed:true,artworkStatus:'received'}),/visuel/);
  await assert.rejects(()=>orders.mutate('order',{...b,quantity:50,quantityConfirmed:true}),/quantité/);
  await assert.rejects(()=>orders.mutate('order',{...b,quantity:300,quantityConfirmed:true,supplierId:'boutique-jetable-cups'}),/produit/);
  await orders.mutate('order',{...b,quantity:300,quantityConfirmed:true,clientRequest:'Logo et date, couleur verte'});o=(await orders.details(id)).orders[0];assert.equal(o.status,'ready');assert.equal(o.quantity,300);assert(o.client_request.includes('verte'));
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_email_outbox').get().n,0);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM eywa_invoices').get().n,0);
 }finally{env.DB.raw.close();}
});
test('orders: concurrent edits fail safely and supplier lead time updates only unfinished preparation',async()=>{
 const env=setup(),crm=createCRM(env),orders=createOrders(env);try{
  const {id}=await crm.mutate('manual-event',sample);env.DB.raw.prepare("UPDATE eywa_crm_events SET data_json=json_set(data_json,'$.options',json(?)) WHERE id=?").run('["Gobelets sur mesure"]',id);
  env.DB.raw.prepare('INSERT INTO eywa_crm_tasks VALUES(?,?,?,?,?,?,?)').run(id+':cups',id,'Commander les gobelets imprimés','2027-05-25',0,null,Date.now());
  await orders.mutate('supplier',{id:'pixeprint-cups',name:'PixePrint',category:'cups-printed',url:'https://www.pixeprint.com/',minQuantity:250,leadDays:15,preferred:true,priority:1});
  let o=(await orders.details(id)).orders[0],b={...payload(o),supplierId:'pixeprint-cups',quantity:300,quantityConfirmed:true};await orders.mutate('order',b);
  assert.equal(env.DB.raw.prepare('SELECT due_date FROM eywa_crm_tasks WHERE id=?').get(id+':cups').due_date,'2027-05-31');
  await assert.rejects(()=>orders.mutate('order',b),e=>e.status===409);
  await crm.mutate('task',{id:id+':cups',done:true});o=(await orders.details(id)).orders[0];await orders.mutate('order',{...payload(o),dueDate:'2027-06-01'});
  const task=env.DB.raw.prepare('SELECT * FROM eywa_crm_tasks WHERE id=?').get(id+':cups');assert.equal(task.done,1);assert.equal(task.due_date,'2027-05-31');
 }finally{env.DB.raw.close();}
});
test('orders: supplier links reject executable URLs and credentials; no unapproved suggestion rules',async()=>{
 for(const s of ['javascript:alert(1)','data:text/html,hi','http://example.com','https://user:secret@example.com','https://localhost/path'])assert.throws(()=>supplierLink(s));
 assert.equal(supplierLink('https://example.com/product?a=1&b=2'),'https://example.com/product?a=1&b=2');
 const env=setup();try{await assert.rejects(()=>createOrders(env).mutate('supplier',{name:'Fixture',category:'stickers',preferred:true,url:'https://example.com'}),/délai/);}finally{env.DB.raw.close();}
});
test('orders: private data stays protected and shortcut manifest contains no client data',async()=>{
 const env=setup();try{
  const manifest=await crmHTTP(new Request('https://test.example/espace/manifest.webmanifest'),env,{});assert.equal(manifest.status,200);const m=await manifest.json();assert.equal(m.start_url,'/espace/');assert.equal(m.display,'standalone');
  assert.equal((await crmHTTP(new Request('https://test.example/espace/api/overview'),env,{})).status,401);
 }finally{env.DB.raw.close();}
});
