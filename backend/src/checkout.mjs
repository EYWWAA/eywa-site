import {paymentPlan} from './lib/payment-plan.mjs';
import bookingDetails from './lib/booking-details.cjs';
import {reconcileBookings} from './lib/bookings.mjs';
export function createCheckout(deps){
 const {quote,getSlots,getBookings,json,reconcile,request,settings}=deps;
 return async function(event){
  if(event.httpMethod==='OPTIONS')return json(204,{});
  if(event.httpMethod!=='POST')return json(405,{error:'Méthode non autorisée'});
  let body;try{body=JSON.parse(event.body||'{}');}catch{return json(400,{error:'Demande invalide'});}
  let calculated,plan;
  try{calculated=await quote(body.quote||{});plan=paymentPlan(calculated,body,settings);}catch(e){return json(400,{code:e.code||'INVALID_QUOTE',error:e.code==='DATE_TOO_SOON'||e.code==='CODE_INVALID'?e.message:'Le devis doit être recalculé avec un lieu et une date valides.'});}
  const {normalCents:normal,payableCents:payable,launch,special,serviceSpecial,travelCents,kind,totalCents}=plan;
  if(Number(body.expectedCents)!==payable)return json(409,{code:'PRICE_CHANGED',...plan,error:'Le prix a changé. Vérifiez le nouveau montant avant de payer.'});
  let details;try{details=bookingDetails.validate(body.bookingDetails);}catch(e){return json(400,{code:'INVALID_BOOKING_DETAILS',error:e.message});}
  const quoteId=String(body.quote?.qid||'');
  const savedQuote=quoteId?await deps.findQuote?.(quoteId):null;
  if(quoteId&&!savedQuote)return json(400,{error:'Devis introuvable. Recréez votre devis avant de réserver.'});
  details.quoteId=savedQuote?.id||null;details.automationVersion='20261109';
  details.eventSummary={date:body.quote.d,lineItems:calculated.lineItems,staff:calculated.staff,normalCents:calculated.normalCents,time:body.quote.ti,guests:Number(body.quote.g),hours:Number(body.quote.h),days:Number(body.quote.dy||1),location:body.quote.l,eventType:body.quote.t,options:(()=>{try{return typeof body.quote.options==='string'?JSON.parse(body.quote.options):body.quote.options||[];}catch{return [];}})(),firstName:body.quote.p};
  let slot,slots,booking,bookings;
  try{
    bookings=await getBookings();await bookings.ready();await reconcileBookings(bookings,request);
    booking=await bookings.claim(calculated.dates,normal,payable,kind,details);
    if(!booking)return json(409,{code:'DATE_UNAVAILABLE',error:'Cette date n’est plus disponible. Choisissez une autre date pour votre événement.'});
    if(launch){
      if(settings.EYWA_LAUNCH_ENABLED!=='true'){await bookings.release(booking.id,null);return json(409,{code:'OFFER_ENDED',error:'L’offre n’est plus disponible. Recalculez votre devis avant de payer.'});}
      slots=await getSlots();await reconcile(slots);slot=await slots.claim(normal,payable);
      if(!slot){await bookings.release(booking.id,null);return json(409,{code:'OFFER_ENDED',error:'L’offre sur la première réservation n’est plus disponible. Vérifiez le tarif avant de payer.'});}
    }
    const line=(i,name,cents,description)=>({[`line_items[${i}][price_data][currency]`]:'eur',[`line_items[${i}][price_data][product_data][name]`]:name,[`line_items[${i}][price_data][product_data][description]`]:description,[`line_items[${i}][price_data][unit_amount]`]:String(cents),[`line_items[${i}][quantity]`]:'1'});
    const params={
      ...line(0,serviceSpecial?'Prestation et déplacement EYWA — code NATHALIE08':special?'Réservation EYWA — tarif spécial':launch?'Coffee bar et déplacement — offre de lancement −80 %':'Réservation EYWA — acompte de 50 %',serviceSpecial?100:launch?payable-calculated.personalizationCents:payable,serviceSpecial?'Prestation et déplacement à 1 €. Personnalisations au tarif normal.':special?'Paiement intégral de la réservation':launch?'Remise de 80 % sur la prestation et le déplacement. Personnalisations au tarif normal.':'Coffee bar, personnalisations et déplacement selon votre devis'),
      mode:'payment',locale:'fr','payment_method_types[]':'card',customer_creation:'always',billing_address_collection:'required',
      success_url:'https://eywacoffeecatering.com/merci.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:'https://eywacoffeecatering.com/reservation.html?'+new URLSearchParams({...body.quote,pr:normal/100}).toString(),
      expires_at:String(Math.floor(Date.now()/1000)+1860),
      'metadata[payment_kind]':kind,'metadata[quote_total_cents]':String(totalCents),'metadata[normal_total_cents]':String(normal),'metadata[balance_cents]':String(totalCents-payable),
      'metadata[event_date]':calculated.dates[0],'metadata[event_end_date]':calculated.dates.at(-1),'metadata[eywa_booking]':booking.id
    };
    let nextLine=1;
    const rush=calculated.rushCupsCents||0,customization=calculated.personalizationCents-rush;
    if((launch||serviceSpecial)&&customization)Object.assign(params,line(nextLine++,'Personnalisations — tarif normal',customization,'Habillage du bar, gobelets et/ou logo sur les boissons sélectionnés dans votre devis'));
    if((launch||serviceSpecial)&&rush)Object.assign(params,line(nextLine++,'Impression accélérée des gobelets',rush,'Supplément unique pour une commande de gobelets personnalisés moins de 14 jours avant l’événement'));
    if(serviceSpecial&&travelCents)Object.assign(params,line(nextLine++,'Déplacement — tarif normal',travelCents,'Frais de déplacement selon votre devis'));
    if(savedQuote){params.customer_email=savedQuote.email;params['payment_intent_data[receipt_email]']=savedQuote.email;params['metadata[eywa_quote]']=savedQuote.id;}
    if(slot){params['metadata[eywa_claim]']=slot.claim_id;params['metadata[eywa_slot]']=String(slot.slot);}
    const session=await request('checkout/sessions','POST',params,'eywa-booking-'+booking.id);
    await bookings.attach(booking.id,session.id);if(slot)await slots.attach(slot.claim_id,session.id);
    return json(200,{url:session.url});
  }catch(e){
    // Only a definite Stripe rejection can safely release a pre-payment hold.
    // Unknown failures remain held until the signed event or reconciliation.
    if(e.stripeStatus){if(slot)await slots.release(slot.claim_id,null);if(booking)await bookings.release(booking.id,null);}
    return json(503,{error:'Le paiement n’a pas pu être préparé. Réessayez ou contactez EYWA.'});
  }
 };
}
