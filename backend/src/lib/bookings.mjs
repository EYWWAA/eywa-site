import {randomUUID} from 'node:crypto';
export function createBookings(db){
 const q=(sql,...p)=>db.prepare(sql).bind(...p);
 async function ready(){if(!await q('SELECT id FROM eywa_booking_import WHERE id=1').first())throw Error('Calendar history not imported');}
 return {
  ready,
  async busy(from,to){await ready();return (await q('SELECT day FROM eywa_booking_days WHERE day>=? AND day<=? ORDER BY day',from,to).all()).results.map(r=>r.day);},
  async claim(dates,normal,payable,kind,details){
   await ready();const id=randomUUID();
   const statements=[q('INSERT INTO eywa_bookings(id,state,start_date,end_date,normal_cents,payable_cents,payment_kind,details_json) VALUES(?,?,?,?,?,?,?,?)',id,'held',dates[0],dates.at(-1),normal,payable,kind,JSON.stringify(details)),q("WITH RECURSIVE dates(day) AS (SELECT ? UNION ALL SELECT date(day,'+1 day') FROM dates WHERE day<?) INSERT INTO eywa_booking_days(day,booking_id) SELECT day,? FROM dates",dates[0],dates.at(-1),id)];
   try{await db.batch(statements);return {id};}catch(e){if((await this.busy(dates[0],dates.at(-1))).length)return null;throw e;}
  },
  async attach(id,session){const row=await q("UPDATE eywa_bookings SET session_id=? WHERE id=? AND (session_id IS NULL OR session_id=?) AND state IN ('held','paid') RETURNING id",session,id,session).first();if(!row)throw Error('Booking attach failed');},
  async bySession(session){return q('SELECT id,state FROM eywa_bookings WHERE session_id=?',session).first();},
  async paid(s){if(s.payment_status!=='paid'||s.currency!=='eur')return false;return Boolean(await q("UPDATE eywa_bookings SET state='paid',session_id=?,paid_at=COALESCE(paid_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE (id=? OR (session_id=? AND ? IS NULL)) AND (session_id IS NULL OR session_id=?) AND payable_cents=? AND state IN ('held','paid') RETURNING id",s.id,s.metadata?.eywa_booking||null,s.id,s.metadata?.eywa_booking||null,s.id,s.amount_total).first());},
  async release(id,session){await db.batch([q("DELETE FROM eywa_booking_days WHERE booking_id=? AND EXISTS (SELECT 1 FROM eywa_bookings WHERE id=? AND state='held' AND session_id IS ?)",id,id,session),q("UPDATE eywa_bookings SET state='released' WHERE id=? AND state='held' AND session_id IS ?",id,session)]);},
  async stale(){return (await q("SELECT id,session_id,created_at FROM eywa_bookings WHERE state='held' AND created_at<strftime('%Y-%m-%dT%H:%M:%fZ','now','-32 minutes') ORDER BY created_at LIMIT 10").all()).results;}
 };
}
export async function reconcileBookings(bookings,request){
 for(const row of await bookings.stale()){
  if(!row.session_id)continue; // Ambiguous Stripe failures remain blocked for manual reconciliation.
  const s=await request('checkout/sessions/'+encodeURIComponent(row.session_id));
  if(s.payment_status==='paid')await bookings.paid(s);
  else if(s.status==='expired')await bookings.release(row.id,s.id);
 }
}
