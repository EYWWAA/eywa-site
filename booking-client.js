(function(root){
 'use strict';
 var api='https://eywa-booking.eywa-booking-cloudflare.workers.dev';
 async function availability(params){
  var response=await fetch(api+'/availability?'+new URLSearchParams(params),{cache:'no-store',signal:AbortSignal.timeout(10000)}),result=await response.json();
  if(!response.ok)throw Error(result.error||'Le calendrier est indisponible. Réessayez.');return result;
 }
 function phoneCountry(id){var select=document.getElementById(id+'-country');return select?select.value:'FR';}
 function phoneValue(id){return EywaPhone.normalize(document.getElementById(id).value,phoneCountry(id));}
 function phoneValid(id,show){var input=document.getElementById(id),valid=Boolean(phoneValue(id)),message=document.getElementById(id+'-error');input.setAttribute('aria-invalid',String(!valid&&Boolean(input.value)));if(message)message.hidden=valid||!show;return valid;}
 function mountPhone(id,onChange){
  var input=document.getElementById(id);if(!input)return;
  var wrap=document.createElement('div');wrap.className='phone-control';input.before(wrap);
  var select=document.createElement('select');select.id=id+'-country';select.setAttribute('aria-label','Pays et indicatif téléphonique');
  var names=new Intl.DisplayNames(['fr'],{type:'region'});
  EywaPhone.countries.slice().sort(function(a,b){if(a.country==='FR')return -1;if(b.country==='FR')return 1;return names.of(a.country).localeCompare(names.of(b.country),'fr');}).forEach(function(row){select.add(new Option(names.of(row.country)+' +'+row.code,row.country));});
  select.value='FR';input.autocomplete='tel-national';input.inputMode='tel';input.placeholder='06 12 34 56 78';input.setAttribute('aria-describedby',id+'-error');wrap.append(select,input);
  var hint=document.createElement('p');hint.id=id+'-error';hint.className='field-error';hint.hidden=true;hint.textContent='Indiquez un numéro valide. Choisissez son pays ou saisissez-le avec son indicatif international.';wrap.after(hint);
  function changed(){phoneValid(id,Boolean(input.value));if(onChange)onChange();}
  input.addEventListener('input',changed);select.addEventListener('change',changed);input.addEventListener('blur',changed);
 }
 root.EywaBooking={api:api,availability:availability,mountPhone:mountPhone,phoneValue:phoneValue,phoneValid:phoneValid,phoneCountry:phoneCountry};
})(window);
