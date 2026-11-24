// Moyens de paiement proposés dans Stripe Checkout : carte et Wero (bêta). Si Stripe refuse Wero, la même session est recréée avec la carte seule,
// sans jamais bloquer une réservation. La clé d'idempotence change pour la seconde tentative.
export async function withCardFallback(request,params,key){
 try{return await request('checkout/sessions','POST',params,key);}
 catch(e){
  if(e.stripeStatus!==400||!('payment_method_types[1]' in params))throw e;
  const {'payment_method_types[1]':_wero,...cardOnly}=params;
  return request('checkout/sessions','POST',cardOnly,key+'-card');
 }
}
