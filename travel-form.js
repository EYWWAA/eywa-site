/* Recherche explicite d’adresse et calcul avant progression dans le devis. */
(function(){
  'use strict';
  var input=document.getElementById('lieu-input'), status=document.getElementById('travel-status'), results=document.getElementById('travel-results');
  var version=0;
  window.eywaTravel=null;
  window.checkS2=function(){
    version++;window.eywaTravel=null;results.replaceChildren();status.textContent='';
    var next=document.getElementById('btn2');next.disabled=true;next.classList.add('disabled');
  };
  window.findEventAddress=async function(){
    window.checkS2();var ticket=version,query=input.value.trim();
    if(query.length<3){status.textContent='Indiquez une adresse ou une ville pour rechercher le lieu.';return;}
    status.textContent='Recherche de votre lieu…';
    var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},15000);
    try{
      var features=await EywaTravelPlaces.search(query,{signal:controller.signal});if(ticket!==version)return;
      if(!features.length){status.textContent='Adresse introuvable. Essayez avec la rue, le code postal et la ville.';return;}
      status.textContent='Sélectionnez le lieu correspondant à votre événement :';
      features.forEach(function(feature){
        var button=document.createElement('button');button.type='button';button.className='travel-result';button.textContent=feature.properties.label;
        button.addEventListener('click',function(){selectAddress(feature,ticket);});results.append(button);
      });
    }catch(e){if(ticket===version)status.textContent='La recherche est indisponible. Réessayez dans un instant ou contactez-nous pour votre devis.';}
    finally{clearTimeout(timeout);}
  };
  async function selectAddress(feature,ticket){
    if(ticket!==version)return;ticket=++version;results.replaceChildren();
    input.value=feature.properties.label;status.textContent='Vérification du lieu…';
    try{
      if(!window.EywaServiceArea)throw new Error();
      if(!EywaServiceArea.contains(feature.geometry.coordinates)){
        status.textContent='Votre lieu se situe au-delà de notre rayon de 300 km. Contactez-nous pour une demande spécifique.';
        return;
      }
    }catch(e){status.textContent='Ce lieu n’a pas pu être vérifié. Sélectionnez un autre résultat ou contactez-nous.';return;}
    try{
      if(!window.EYWA_TRAVEL_ORIGIN)throw new Error();
      var route=feature.properties.countrycode==='FR'?EywaTravelRoute.roundTrip:EywaTravelRoute.internationalRoundTrip;
      var trip=await route(window.EYWA_TRAVEL_ORIGIN,feature.geometry.coordinates);
      if(ticket!==version)return;
      var cost=EywaTravelPricing.calculate(trip.roundTripKm,trip.roundTripMinutes);
      window.eywaTravel=Object.assign(cost,{outwardMinutes:trip.outwardMinutes,lodgingRequired:trip.lodgingRequired,label:input.value,approximate:feature.properties.type!=='housenumber'});
      status.textContent='';
      
      var next=document.getElementById('btn2');next.disabled=false;next.classList.remove('disabled');
    }catch(e){if(ticket===version)status.textContent='Impossible de calculer ce trajet routier. Réessayez ou contactez-nous pour un devis adapté ; aucun trajet gratuit ne sera ajouté par défaut.';}
  }
  window.checkS2();
})();
