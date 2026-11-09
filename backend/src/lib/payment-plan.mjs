export function paymentPlan(calculated,body,settings){
 const code=String(body.code||'').trim();
 const serviceSpecial=code.toUpperCase()==='NATHALIE08';
 if(code&&!serviceSpecial&&(!settings.EYWA_SPECIAL_PRICE_CODE||code!==settings.EYWA_SPECIAL_PRICE_CODE))throw Object.assign(Error('Ce code n’est pas valide.'),{code:'CODE_INVALID'});
 const special=Boolean(code),launch=!special&&body.offer===true;
 const travelCents=serviceSpecial?0:Math.round((calculated.travel?.total||0)*100);
 const totalCents=serviceSpecial?100+calculated.personalizationCents+travelCents:special?100:launch?calculated.discountedCents:calculated.normalCents;
 return {special,serviceSpecial,launch,totalCents,payableCents:special||launch?totalCents:Math.round(totalCents/2),normalCents:calculated.normalCents,personalizationCents:calculated.personalizationCents,rushCupsCents:calculated.rushCupsCents||0,travelCents,kind:special?'full_special':launch?'full_launch':'deposit'};
}
