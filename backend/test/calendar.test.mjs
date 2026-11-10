import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {database,quote,request,context,bookingDetails} from './booking.test.mjs';
import {createBookings} from '../src/lib/bookings.mjs';
import {handle} from '../src/worker.mjs';
import policy from '../src/lib/booking-policy.cjs';
import pricing from '../src/lib/pricing.cjs';
import phone from '../src/lib/phone-validation.cjs';

test('Paris calendar: D+3 minimum includes DST and rejects yesterday, today, D+1, D+2',()=>{
 const now=new Date('2026-10-24T21:30:00Z');assert.equal(policy.minimumDate(now),'2026-10-27');
 for(const d of ['2026-10-23','2026-10-24','2026-10-25','2026-10-26','2026-02-30'])assert.throws(()=>policy.eventDays(d,1,now));
 assert.deepEqual(policy.eventDays('2026-10-27',2,now),['2026-10-27','2026-10-28']);
 assert.equal(policy.minimumDate(new Date('2026-10-24T22:30:00Z')),'2026-10-28');
 assert.deepEqual(policy.occupiedDays({d:'2026-10-27',dy:1,ti:'23:00',h:2},now),['2026-10-27','2026-10-28']);
});
test('Price base 300, bar 200: launch excludes every personalization and includes travel',async()=>{
 const basic=await pricing.quote(quote);assert.equal(basic.normalCents,30000);assert.equal(basic.discountedCents,6000);
 const custom=await pricing.quote({...quote,options:['Habillage du bar','Gobelets sur mesure','Logo sur les boissons']});assert.equal(custom.normalCents,85000);assert.equal(custom.personalizationCents,55000);assert.equal(custom.discountedCents,61000);
 const multi=await pricing.quote({...quote,dy:2,options:['Habillage du bar']});assert.equal(multi.normalCents,100000);assert.equal(multi.discountedCents,52000);
 const {normalCents}=await pricing.quote({...quote,g:76});assert.equal(normalCents,51006);
});
test('Phone format: France, Belgium, UK, international override and invalid numbers',()=>{
 assert.equal(phone.normalize('06 12 34 56 78','FR'),'+33612345678');assert.equal(phone.normalize('0491 12 34 56','BE'),'+32491123456');assert.equal(phone.normalize('+44 20 7946 0018','FR'),'+442079460018');
 for(const value of ['123456','06 12','abcdef','+331234567890123456','xx 0612345678'])assert.equal(phone.normalize(value,'FR'),null);
});
test('Atomic multi-day claims roll back partial conflicts and reject simultaneous bookings',async()=>{
 const db=database(),calendar=createBookings(db);try{
 const first=await calendar.claim(['2027-11-16'],45000,22500,'deposit',{});assert(first);
 assert.equal(await calendar.claim(['2027-11-15','2027-11-16'],45000,22500,'deposit',{}),null);
 assert.deepEqual(await calendar.busy('2027-11-15','2027-11-16'),['2027-11-16']);
 const claims=await Promise.all(Array.from({length:15},()=>calendar.claim(['2027-11-17'],45000,22500,'deposit',{})));assert.equal(claims.filter(Boolean).length,1);
 }finally{db.raw.close();}
});
test('Booked date remains blocked after paid, wrong amount/currency ignored, expiry only releases unpaid',async()=>{
 const db=database(),calendar=createBookings(db);try{
 const a=await calendar.claim(['2027-11-15','2027-11-16'],45000,22500,'deposit',{});await calendar.attach(a.id,'cs_test_calendar');
 const paid={id:'cs_test_calendar',metadata:{eywa_booking:a.id},currency:'eur',payment_status:'paid',amount_total:22500};
 assert.equal(await calendar.paid({...paid,amount_total:100}),false);assert.equal(await calendar.paid({...paid,currency:'usd'}),false);assert(await calendar.paid(paid));assert(await calendar.paid(paid));
 await calendar.release(a.id,paid.id);assert.deepEqual(await calendar.busy('2027-11-15','2027-11-16'),['2027-11-15','2027-11-16']);
 const b=await calendar.claim(['2027-11-20'],45000,22500,'deposit',{});await calendar.attach(b.id,'cs_test_expire');await calendar.release(b.id,'cs_test_other');assert.deepEqual(await calendar.busy('2027-11-20','2027-11-20'),['2027-11-20']);await calendar.release(b.id,'cs_test_expire');assert.deepEqual(await calendar.busy('2027-11-20','2027-11-20'),[]);
 }finally{db.raw.close();}
});
test('Server availability hides identities, checks all days, and fails closed before import',async()=>{
 const db=database(),env={DB:db},ctx=context(),calendar=createBookings(db);try{
 await calendar.claim(['2027-11-16'],45000,22500,'deposit',bookingDetails);
 const result=await (await handle(request('availability?date=2027-11-15&days=2'),env,ctx)).json();assert.equal(result.available,false);assert.deepEqual(result.blocked,['2027-11-16']);assert(!JSON.stringify(result).includes('Contact de contrôle'));
 assert.equal((await handle(request('availability?date=2026-10-25&days=1'),env,ctx)).status,400);
 db.raw.exec('DELETE FROM eywa_booking_import');assert.equal((await handle(request('availability?date=2027-11-15&days=1'),env,ctx)).status,503);
 }finally{db.raw.close();}
});
test('Special code gives full 1 euro, keeps launch slot available, stores dress and contact privately',async()=>{
 const DB=database(),env={DB,EYWA_LAUNCH_ENABLED:'true',EYWA_SPECIAL_PRICE_CODE:'1€'},ctx=context(),original=globalThis.fetch;let posts=0,params;
 globalThis.fetch=async(url,options)=>{posts++;params=new URLSearchParams(options.body);return Response.json({id:'cs_test_special',url:'https://checkout.stripe.com/c/pay/test'});};
 try{
  let response=await handle(request('launch-checkout','POST',{quote,offer:true,code:'wrong',expectedCents:100,bookingDetails}),env,ctx);assert.equal(response.status,400);assert.equal(posts,0);
  response=await handle(request('launch-checkout','POST',{quote,offer:true,code:'1€',expectedCents:100,bookingDetails:{...bookingDetails,dressCode:'Autre',dressDetails:'Bleu'}}),env,ctx);assert.equal(response.status,200);assert.equal(posts,1);assert.equal(params.get('line_items[0][price_data][unit_amount]'),'100');assert.equal(params.get('metadata[balance_cents]'),'0');assert.equal(params.get('metadata[payment_kind]'),'full_special');assert.equal(params.has('metadata[eywa_claim]'),false);
  assert.equal(DB.raw.prepare("SELECT state FROM eywa_launch_slots WHERE slot=1").get().state,'available');const stored=JSON.parse(DB.raw.prepare('SELECT details_json FROM eywa_bookings').get().details_json);assert.equal(stored.phone,'+33612345678');assert.equal(stored.dressDetails,'Bleu');assert(!params.toString().includes('Bleu'));
  response=await handle(request('launch-checkout','POST',{quote,offer:false,expectedCents:15000,bookingDetails}),env,ctx);assert.equal(response.status,409);assert.equal((await response.json()).code,'DATE_UNAVAILABLE');assert.equal(posts,1);
 }finally{globalThis.fetch=original;DB.raw.close();}
});
test('Launch checkout charges bar at full price and rejects missing mandatory power or bad phone',async()=>{
 const DB=database(),env={DB,EYWA_LAUNCH_ENABLED:'true'},ctx=context(),original=globalThis.fetch;let posts=0,params;
 globalThis.fetch=async(url,options)=>{posts++;params=new URLSearchParams(options.body);return Response.json({id:'cs_test_custom',url:'https://checkout.stripe.com/c/pay/test'});};
 try{
 const custom={...quote,options:['Habillage du bar']};
 for(const invalid of [{...bookingDetails,power220:false},{...bookingDetails,phone:'123456'},{...bookingDetails,dressCode:'Autre',dressDetails:''}]){const response=await handle(request('launch-checkout','POST',{quote:custom,offer:true,expectedCents:26000,bookingDetails:invalid}),env,ctx);assert.equal(response.status,400);}
 assert.equal(posts,0);assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM eywa_bookings').get().n,0);
 const response=await handle(request('launch-checkout','POST',{quote:custom,offer:true,expectedCents:26000,bookingDetails}),env,ctx);assert.equal(response.status,200);assert.equal(params.get('line_items[0][price_data][unit_amount]'),'6000');assert.equal(params.get('line_items[1][price_data][unit_amount]'),'20000');assert.equal(params.has('discounts[0][coupon]'),false);
 }finally{globalThis.fetch=original;DB.raw.close();}
});
test('Signed webhook locks paid date even if the customer never returns from Stripe',async()=>{
 const DB=database(),calendar=createBookings(DB),secret='fixture',env={DB,STRIPE_WEBHOOK_SECRET:secret},ctx=context();try{
 const row=await calendar.claim(['2027-11-15'],45000,100,'full_special',bookingDetails);await calendar.attach(row.id,'cs_test_webhook');
 const raw=JSON.stringify({type:'checkout.session.completed',data:{object:{id:'cs_test_webhook',metadata:{eywa_booking:row.id},currency:'eur',payment_status:'paid',amount_total:100}}}),t=Math.floor(Date.now()/1000),sig='t='+t+',v1='+createHmac('sha256',secret).update(t+'.'+raw).digest('hex');
 const req=()=>new Request('https://test.example/launch-webhook',{method:'POST',headers:{'stripe-signature':sig},body:raw});assert.equal((await handle(req(),env,ctx)).status,200);assert.equal((await handle(req(),env,ctx)).status,200);assert.equal(DB.raw.prepare('SELECT state FROM eywa_bookings WHERE id=?').get(row.id).state,'paid');assert.equal(await calendar.claim(['2027-11-15'],45000,22500,'deposit',{}),null);
 }finally{DB.raw.close();}
});

test('Legacy imported paid session is reconciled even without the new booking metadata',async()=>{
 const db=database(),calendar=createBookings(db);try{const row=await calendar.claim(['2027-11-22'],65000,32500,'deposit',{});await calendar.attach(row.id,'cs_test_legacy');assert(await calendar.paid({id:'cs_test_legacy',metadata:{event_date:'2027-11-22'},payment_status:'paid',currency:'eur',amount_total:32500}));await calendar.release(row.id,'cs_test_legacy');assert.deepEqual(await calendar.busy('2027-11-22','2027-11-22'),['2027-11-22']);}finally{db.raw.close();}
});
test('Unpaid expired checkout releases its hold; paid checkout stays blocked after a missed webhook',async()=>{
 const {reconcileBookings}=await import('../src/lib/bookings.mjs');const db=database(),calendar=createBookings(db);try{
 const a=await calendar.claim(['2027-11-23'],45000,22500,'deposit',{}),b=await calendar.claim(['2027-11-24'],45000,22500,'deposit',{});await calendar.attach(a.id,'cs_test_expired2');await calendar.attach(b.id,'cs_test_paid2');db.raw.exec("UPDATE eywa_bookings SET created_at='2026-10-01T00:00:00Z' WHERE id<>'fixture'");
 await reconcileBookings(calendar,async path=>path.endsWith('cs_test_expired2')?{status:'expired',id:'cs_test_expired2',payment_status:'unpaid'}:{status:'complete',id:'cs_test_paid2',payment_status:'paid',amount_total:22500,currency:'eur',metadata:{eywa_booking:b.id}});
 assert.deepEqual(await calendar.busy('2027-11-23','2027-11-24'),['2027-11-24']);assert.equal(db.raw.prepare('SELECT state FROM eywa_bookings WHERE id=?').get(b.id).state,'paid');
 }finally{db.raw.close();}
});
