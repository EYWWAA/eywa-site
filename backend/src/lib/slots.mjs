import {randomUUID} from 'node:crypto';
export function createSlots(db){
 const query=(sql,...params)=>db.prepare(sql).bind(...params);
 async function ready(){if(!await query('SELECT id FROM eywa_migration WHERE id=1').first())throw Error('Offer state not imported');}
 return {
  async status(){
   await ready();
   const r=await query("SELECT SUM(CASE WHEN state='paid' THEN 1 ELSE 0 END) AS paid, SUM(CASE WHEN state='held' THEN 1 ELSE 0 END) AS held, SUM(CASE WHEN slot=1 AND state='available' THEN 1 ELSE 0 END) AS available, COUNT(*) AS count FROM eywa_launch_slots").first();
   if(r.count!==2)throw Error('Incomplete offer state');
   const remaining=Math.max(0,1-r.paid),available=remaining&&r.held===0?Math.min(1,r.available):0;
   return {supported:true,active:available>0,remaining,available};
  },
  async claim(normal,payable){
   await ready();
   return query("UPDATE eywa_launch_slots SET state='held',claim_id=?,normal_cents=?,payable_cents=?,held_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),session_id=NULL,paid_at=NULL WHERE slot=1 AND state='available' AND NOT EXISTS (SELECT 1 FROM eywa_launch_slots WHERE state IN ('held','paid')) RETURNING *",randomUUID(),normal,payable).first();
  },
  async attach(claim,session){if(!await query("UPDATE eywa_launch_slots SET session_id=? WHERE claim_id=? AND state='held' AND session_id IS NULL RETURNING slot",session,claim).first())throw Error('Slot could not be attached');},
  async paid(s){
   if(s.payment_status!=='paid'||s.currency!=='eur')return false;
   return Boolean(await query("UPDATE eywa_launch_slots SET state='paid',paid_at=COALESCE(paid_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE claim_id=? AND session_id=? AND payable_cents=? AND state IN ('held','paid') RETURNING slot",s.metadata?.eywa_claim||null,s.id,s.amount_total).first());
  },
  async release(claim,session){await query("UPDATE eywa_launch_slots SET state='available',claim_id=NULL,session_id=NULL,normal_cents=NULL,payable_cents=NULL,held_at=NULL,paid_at=NULL WHERE claim_id=? AND state='held' AND session_id IS ?",claim,session).run();},
  async held(){return (await query("SELECT * FROM eywa_launch_slots WHERE state='held' AND session_id IS NOT NULL").all()).results;}
 };
}
