export function createStripe(settings){
async function request(path,method='GET',values,requestKey){
  const headers={Authorization:'Bearer '+settings.STRIPE_SECRET_KEY};
  if(values)headers['Content-Type']='application/x-www-form-urlencoded';
  if(requestKey)headers['Idempotency-Key']=requestKey;
  const response=await fetch('https://api.stripe.com/v1/'+path,{method,headers,body:values?new URLSearchParams(values).toString():undefined,signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok){const err=Error('Stripe request failed');err.stripeStatus=response.status;throw err;}
  return result;
}
async function reconcile(slots){
  for(const row of await slots.held()){
    const session=await request('checkout/sessions/'+encodeURIComponent(row.session_id));
    if(session.payment_status==='paid')await slots.paid(session);
    else if(session.status==='expired')await slots.release(row.claim_id,row.session_id);
    // Complete but unpaid sessions remain held until the signed success/failure event.
  }
}
async function coupon(){
  const id='eywa-launch-80-20261014';
  try{const c=await request('coupons/'+id);if(c.percent_off!==80)throw Error('Unexpected offer coupon');}
  catch(e){if(e.stripeStatus!==404)throw e;await request('coupons','POST',{id,percent_off:'80',duration:'once',name:'Offre de lancement EYWA −80 %'},'eywa-launch-coupon-20261014');}
  return id;
}
const headers={'Access-Control-Allow-Origin':'https://eywacoffeecatering.com','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
function json(statusCode,data){return {statusCode,headers,body:JSON.stringify(data)};}

return {request,reconcile,coupon,json};
}
