export function createPaymentStatus(deps){
 const {quote,getSlots,getBookings,json,reconcile,request,coupon,settings}=deps;
 return async function(event){
  if(event.httpMethod==='OPTIONS')return json(204,{});
  const id=event.queryStringParameters&&event.queryStringParameters.session_id;
  if(!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(id||''))return json(400,{error:'Lien de paiement invalide'});
  try{
    const session=await request('checkout/sessions/'+id);
    if(session.payment_status==='paid'){await (await getBookings()).paid(session);try{await deps.notifyPayment?.(session);}catch{/* The scheduled job retries delivery without misreporting a paid booking. */}}
    if(session.metadata&&session.metadata.eywa_claim&&(session.payment_status==='paid'))await (await getSlots()).paid(session);
    return json(200,{paid:session.payment_status==='paid',status:session.status,amountCents:session.amount_total,full:session.metadata&&['full_launch','full_special'].includes(session.metadata.payment_kind),balanceCents:Number(session.metadata&&session.metadata.balance_cents)||0});
  }catch(_){return json(503,{error:'Le paiement n’a pas pu être vérifié. Contactez EYWA.'});}
};
}
