'use strict';
const {Buffer}=require('node:buffer');
const phone=require('./phone-validation.cjs');
function validate(details){
 if(!details||typeof details!=='object')throw Error('Complétez les détails de réservation.');
 const text=(key,required=false,max=2000)=>{const s=String(details[key]||'').trim();if((required&&!s)||s.length>max)throw Error('Complétez les détails de réservation.');return s;};
 const number=phone.normalize(text('phone',true,60),text('phoneCountry')||'FR');
 if(!number)throw Error('Indiquez un numéro de téléphone valide avec son indicatif.');
 const dressCode=text('dressCode',true,100);
 if(!['Tenue barista (tablier)','Formelle','Business casual','Autre','Vêtements fournis par le client'].includes(dressCode))throw Error('Choisissez le code vestimentaire.');
 const dressDetails=text('dressDetails',dressCode==='Autre'||dressCode==='Vêtements fournis par le client');
 if(!['Oui','Non'].includes(details.outdoor)||!['access60','space','power220','cgv'].every(k=>details[k]===true))throw Error('Confirmez les conditions d’accueil, notamment la prise électrique 220 V standard à moins de 10 m du bar.');
 const referencePhoto=text('referencePhoto',false,1100000);
 if(referencePhoto){const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(referencePhoto);if(!match)throw Error('Photo de référence invalide.');const b=Buffer.from(match[2],'base64');const valid=match[1]==='jpeg'?b[0]===255&&b[1]===216&&b[2]===255:match[1]==='png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';if(!valid||b.length>750000)throw Error('Photo trop volumineuse ou invalide.');}
 return {address:text('address',true),contactName:text('contactName',true,150),phone:number,setupLocation:text('setupLocation',true),outdoor:details.outdoor,unloadParking:text('unloadParking',true),eventParking:text('eventParking'),dressCode,dressDetails,referencePhoto,access60:true,space:true,power220:true,cgv:true,billingName:text('billingName',true,200)};
}
module.exports={validate};
