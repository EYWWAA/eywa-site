import {Buffer} from 'node:buffer';
import {createHmac,timingSafeEqual} from 'node:crypto';
export function verify(raw,header,secret,now=Date.now()){
  if(!secret||!header)return false;
  const parts=header.split(',').map(x=>x.split('='));const timestamp=parts.find(x=>x[0]==='t');
  if(!timestamp||!Number.isFinite(Number(timestamp[1]))||Math.abs(now/1000-Number(timestamp[1]))>300)return false;
  const expected=createHmac('sha256',secret).update(timestamp[1]+'.'+raw).digest();
  return parts.filter(x=>x[0]==='v1').some(x=>{try{const actual=Buffer.from(x[1],'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}catch(_){return false;}});
}

export function createWebhook(deps){
 const {getSlots,getBookings,settings}=deps;
 return async function(event){
  const raw=event.isBase64Encoded?Buffer.from(event.body,'base64').toString():event.body||'';
  if(!verify(raw,event.headers['stripe-signature'],settings.STRIPE_WEBHOOK_SECRET))return {statusCode:400,body:'Signature invalide'};
  let payload;try{payload=JSON.parse(raw);}catch(_){return {statusCode:400,body:'Événement invalide'};}
  try{
    const session=payload.data.object;
    {
      const bookings=await getBookings();
      if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(payload.type)){await bookings.paid(session);await deps.notifyPayment?.(session);}
      else if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(payload.type)){const id=session.metadata?.eywa_booking||(await bookings.bySession(session.id))?.id;if(id)await bookings.release(id,session.id);}
    }
    if(session.metadata&&session.metadata.eywa_claim){
      const slots=await getSlots();
      if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(payload.type))await slots.paid(session);
      else if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(payload.type))await slots.release(session.metadata.eywa_claim,session.id);
    }
    return {statusCode:200,body:'ok'};
  }catch(_){return {statusCode:500,body:'Réessayez cet événement'};}
};
}
