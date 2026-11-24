import {randomUUID} from 'node:crypto';
import policy from './booking-policy.cjs';
export const categories={'cups-printed':'Gobelets imprimés','cups-plain':'Gobelets standards','stickers':'Stickers pour gobelets','bar-wrap':'Habillage du bar','foam':'Logo sur la mousse'};
// Les fournisseurs ont un type de plus que les commandes d'événement : les consommables.
export const supplierCategories={...categories,consumables:'Consommables'};
const fail=(s,status=400)=>{throw Object.assign(Error(s),{status});};
const text=(s,n=2000)=>String(s??'').trim().slice(0,n);
export function supplierLink(value){
 if(!value)return '';
 let u;try{u=new URL(String(value));}catch{fail('Indiquez un lien HTTPS valide.');}
 if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||/^(localhost|127\.|0\.|169\.254\.)/.test(u.hostname)||u.hostname.endsWith('.local'))fail('Indiquez un lien HTTPS public.');
 return u.href.slice(0,2000);
}
export function orderCategories(q){
 const options=Array.isArray(q.options)?q.options:[],out=[];
 if(options.includes('Gobelets sur mesure'))out.push('cups-printed');else out.push('cups-plain');
 if(options.includes('Gobelets avec stickers'))out.push('stickers');
 if(options.includes('Habillage du bar'))out.push('bar-wrap');
 if(options.includes('Logo sur les boissons'))out.push('foam');
 return out;
}
export function suggestions(suppliers,order,date,now=new Date()){
 if(!order.quantity_confirmed||!order.quantity)return [];
 const remaining=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(policy.today(now)+'T12:00:00Z'))/86400000);
 return suppliers.filter(s=>s.active&&s.preferred&&s.category===order.category&&s.url&&s.lead_days!==null&&Number(s.lead_days)<=remaining&&(s.min_quantity===null||order.quantity>=s.min_quantity)&&(s.max_quantity===null||order.quantity<=s.max_quantity)).sort((a,b)=>a.priority-b.priority||a.name.localeCompare(b.name));
}
// Prix par quantité : « 100=158,35 ; 200=163,45 » (euros HT) enregistré en « 100=158.35;200=163.45 ».
export function priceList(v){
 const out=[];
 for(const part of String(v??'').split(/[;\n]/).map(x=>x.trim()).filter(Boolean)){
  const m=/^(\d{1,7})\s*=\s*(\d{1,7}(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)?$/i.exec(part);
  if(!m)fail('Prix non reconnus. Écrivez par exemple : 100=158,35 ; 200=163,45');
  const q=Number(m[1]),p=Number(m[2].replace(',','.'));
  if(q<1||q>1000000)fail('Quantité de prix invalide.');
  out.push([q,p]);
 }
 return out.sort((a,b)=>a[0]-b[0]).map(([q,p])=>q+'='+String(p)).join(';');
}
export function createOrders(env){
 const sql=(s,...v)=>env.DB.prepare(s).bind(...v);
 const suppliers=async()=>(await sql('SELECT * FROM eywa_crm_suppliers ORDER BY category,name').all()).results;
 async function event(id){const e=await sql('SELECT * FROM eywa_crm_events WHERE id=?',id).first();if(!e)fail('Événement introuvable.',404);return {...e,data:JSON.parse(e.data_json)};}
 async function ensure(e,now=Date.now()){
  const q=e.data;
  await env.DB.batch(orderCategories(q).map(category=>sql('INSERT INTO eywa_crm_orders(id,event_id,category,artwork_status,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(event_id,category) DO NOTHING',e.id+':'+category,e.id,category,category==='cups-plain'?'not-needed':'needed',now)));
 }
 async function details(id){const e=await event(id);await ensure(e);const list=await suppliers(),orders=(await sql('SELECT * FROM eywa_crm_orders WHERE event_id=? ORDER BY category',id).all()).results;return {suppliers:list,orders:orders.map(o=>({...o,suggestions:suggestions(list,o,e.data.date)}))};}
 async function mutate(action,b,now=Date.now()){
  if(action==='supplier'){
   if(!supplierCategories[b.category]||!text(b.name,150))fail('Complétez le nom et le type de fournisseur.');
   const id=b.id?text(b.id,100):randomUUID(),number=(v,min,max)=>{if(v===''||v===null||v===undefined)return null;const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)fail('Vérifiez les quantités et délais du fournisseur.');return n;};
   const min=number(b.minQuantity,1,1000000),max=number(b.maxQuantity,1,1000000),lead=number(b.leadDays,0,180),priority=number(b.priority??10,0,1000),url=supplierLink(b.url),preferred=b.preferred===true;
   if(min!==null&&max!==null&&min>max)fail('Le maximum doit être supérieur au minimum.');
   if(preferred&&(!url||lead===null))fail('Renseignez le lien et le délai avant d’activer les suggestions.');
   const prices=priceList(b.prices);
   const current=await sql('SELECT category FROM eywa_crm_suppliers WHERE id=?',id).first();
   if(current&&current.category!==b.category&&await sql('SELECT id FROM eywa_crm_orders WHERE supplier_id=? LIMIT 1',id).first())fail('Ce fournisseur est déjà lié à une commande. Ajoutez une autre fiche pour ce type de produit.',409);
   await sql('INSERT INTO eywa_crm_suppliers(id,name,category,url,min_quantity,max_quantity,lead_days,preferred,priority,active,notes,source_url,prices) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,url=excluded.url,min_quantity=excluded.min_quantity,max_quantity=excluded.max_quantity,lead_days=excluded.lead_days,preferred=excluded.preferred,priority=excluded.priority,active=excluded.active,notes=excluded.notes,prices=excluded.prices',id,text(b.name,150),b.category,url,min,max,lead,preferred?1:0,priority,b.active===false?0:1,text(b.notes,4000),'',prices).run();
   return {ok:true,id};
  }
  if(action==='order'){
   const row=await sql('SELECT * FROM eywa_crm_orders WHERE id=?',text(b.id,200)).first();if(!row)fail('Commande introuvable.',404);
   const e=await event(row.event_id);if(e.status==='cancelled')fail('Événement annulé.');
   const quantity=b.quantity===''||b.quantity===null?null:Number(b.quantity);if(quantity!==null&&(!Number.isInteger(quantity)||quantity<1||quantity>1000000))fail('Quantité invalide.');
   const confirmed=b.quantityConfirmed===true,artwork=b.artworkStatus,status=b.status;
   if(!['planning','ready','ordered','received'].includes(status)||!['not-needed','needed','received','review','approved'].includes(artwork))fail('État de commande invalide.');
   if(row.category!=='cups-plain'&&artwork==='not-needed')fail('Validez le visuel de cette personnalisation.');
   const supplierId=b.supplierId?text(b.supplierId,100):null,supplier=supplierId?await sql('SELECT * FROM eywa_crm_suppliers WHERE id=?',supplierId).first():null;
   if(supplierId&&(!supplier||supplier.category!==row.category||(!supplier.active&&supplierId!==row.supplier_id)))fail('Ce fournisseur ne correspond pas à ce produit.');
   let dueDate=text(b.dueDate,10);if(dueDate&&!policy.validDate(dueDate))fail('Échéance invalide.');
   if(!dueDate&&supplier?.lead_days!==null&&supplier?.lead_days!==undefined)dueDate=policy.addDays(e.data.date,-supplier.lead_days);
   if(status!=='planning'){
    if(!quantity||!confirmed)fail('Confirmez la quantité avant de valider cette préparation.');
    if(row.category!=='foam'&&!supplier)fail('Choisissez le fournisseur.');
    if(row.category!=='cups-plain'&&artwork!=='approved')fail('Le visuel doit être validé avant la commande.');
    if(supplier&&((supplier.min_quantity!==null&&quantity<supplier.min_quantity)||(supplier.max_quantity!==null&&quantity>supplier.max_quantity)))fail('La quantité ne respecte pas les conditions de ce fournisseur.');
   }
   const stamp=Number(b.updatedAt);if(!Number.isSafeInteger(stamp))fail('Rechargez cette fiche avant de l’enregistrer.');
   const changed=await sql('UPDATE eywa_crm_orders SET quantity=?,quantity_confirmed=?,supplier_id=?,status=?,artwork_status=?,client_request=?,format=?,artwork_url=?,order_reference=?,order_url=?,due_date=?,notes=?,updated_at=? WHERE id=? AND updated_at=? RETURNING id',quantity,confirmed?1:0,supplierId,status,artwork,text(b.clientRequest,4000),text(b.format,250),supplierLink(b.artworkUrl),text(b.orderReference,200),supplierLink(b.orderUrl),dueDate||null,text(b.notes,4000),Math.max(now,stamp+1),row.id,stamp).first();
   if(!changed)fail('Cette fiche vient d’être modifiée. Rechargez-la avant de recommencer.',409);
   const key={'cups-printed':'cups','stickers':'stickers','bar-wrap':'bar','foam':'printer'}[row.category];
   if(key&&dueDate)await sql('UPDATE eywa_crm_tasks SET due_date=? WHERE id=? AND done=0',dueDate,e.id+':'+key).run();
   await sql('INSERT INTO eywa_crm_audit(action,entity,at) VALUES(?,?,?)','order',row.id,now).run();
   return {ok:true,id:row.id};
  }
  fail('Action inconnue.',404);
 }
 return {suppliers,details,ensure,mutate};
}
