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
      var response=await fetch('https://data.geopf.fr/geocodage/search?limit=5&q='+encodeURIComponent(query),{signal:controller.signal});
      if(!response.ok)throw new Error();
      var data=await response.json();if(ticket!==version)return;
      var features=(data.features||[]).filter(function(f){return f.geometry&&f.geometry.type==='Point'&&f.properties&&f.properties.label;});
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
    input.value=feature.properties.label;status.textContent='Calcul du trajet aller-retour…';
    try{
      if(!window.EYWA_TRAVEL_ORIGIN)throw new Error();
      var trip=await EywaTravelRoute.roundTrip(window.EYWA_TRAVEL_ORIGIN,feature.geometry.coordinates);
      if(ticket!==version)return;
      var cost=EywaTravelPricing.calculate(trip.roundTripKm,trip.roundTripMinutes);
      window.eywaTravel=Object.assign(cost,{outwardMinutes:trip.outwardMinutes,lodgingRequired:trip.lodgingRequired,label:input.value,approximate:feature.properties.type!=='housenumber'});
      status.textContent=(window.eywaTravel.approximate?'Estimation depuis le lieu sélectionné. ':'')+cost.roundTripKm.toFixed(1)+' km aller-retour · '+Math.round(cost.roundTripMinutes)+' min de conduite · '+cost.total.toFixed(2)+' € de déplacement. Un aller-retour est compté ; hébergement éventuel et trajets supplémentaires à préciser.';
      if(trip.lodgingRequired)status.textContent+=' Le trajet aller dépasse 4 h : un hébergement sur place est à prévoir, avec un montant à confirmer avant réservation.';
      var next=document.getElementById('btn2');next.disabled=false;next.classList.remove('disabled');
    }catch(e){if(ticket===version)status.textContent='Impossible de calculer ce trajet routier. Réessayez ou contactez-nous pour un devis adapté ; aucun trajet gratuit ne sera ajouté par défaut.';}
  }
  window.checkS2();
})();
