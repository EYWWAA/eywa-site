/* Recherche explicite d’adresse et calcul avant progression dans le devis. */
(function(){
  'use strict';
  var input=document.getElementById('lieu-input'), status=document.getElementById('travel-status'), results=document.getElementById('travel-results');
  var version=0;
  window.eywaTravel=null;

  function suivant(actif){
    var next=document.getElementById('btn2');
    if(!next)return;
    next.disabled=!actif;next.classList.toggle('disabled',!actif);
  }
  /* Déplacement non calculé : le devis reste possible, le trajet est chiffré
     ensuite avec Louis. C'est l'état par défaut dès que le champ est rempli. */
  function deplacementAConfirmer(){
    return {total:0,localFree:false,roundTripKm:0,roundTripMinutes:0,
      outwardKm:0,outwardMinutes:0,lodgingRequired:false,coordinates:null,
      country:'FR',label:input.value.trim(),approximate:true,pending:true};
  }
  /* Le lieu ne doit jamais bloquer le devis : dès trois caractères saisis, on
     peut continuer. Une recherche réussie remplace ensuite cet état par le
     trajet réel. Si les scripts de recherche ou le réseau sont en panne, le
     visiteur passe quand même. */
  window.checkS2=function(){
    version++;results.replaceChildren();status.textContent='';
    if(input.value.trim().length>=3){window.eywaTravel=deplacementAConfirmer();suivant(true);}
    else{window.eywaTravel=null;suivant(false);}
  };

  /* Si la recherche ou le trajet échouent, le devis ne doit pas être bloqué :
     on laisse continuer avec un déplacement « à confirmer », chiffré avec
     Louis plus tard. Le prix de la prestation, lui, reste exact. */
  function proposerSansDeplacement(message){
    results.replaceChildren();
    status.textContent=message;
    var bouton=document.createElement('button');
    bouton.type='button';bouton.className='travel-result travel-result-fallback';
    bouton.textContent='Continuer sans le déplacement';
    bouton.addEventListener('click',function(){
      version++;
      window.eywaTravel=deplacementAConfirmer();
      results.replaceChildren();
      status.textContent='Déplacement à confirmer. Votre devis affiche le prix de la prestation ; nous chiffrons le trajet avec vous.';
      suivant(true);
    });
    results.append(bouton);
  }

  /* Les autres résultats, repliés : on ne les montre que pour corriger. */
  function proposerAutresLieux(autres){
    var bloc=document.createElement('details');bloc.className='travel-others';
    var titre=document.createElement('summary');titre.textContent='Ce n’est pas le bon lieu ?';
    bloc.append(titre);
    autres.forEach(function(feature){
      var b=document.createElement('button');b.type='button';b.className='travel-result';
      b.textContent=feature.properties.label;
      b.addEventListener('click',function(){version++;selectAddress(feature,version);});
      bloc.append(b);
    });
    results.append(bloc);
  }
  window.findEventAddress=async function(){
    window.checkS2();var ticket=version,query=input.value.trim();
    if(query.length<3){status.textContent='Indiquez une adresse ou une ville pour rechercher le lieu.';return;}
    if(typeof EywaTravelPlaces==='undefined'){
      proposerSansDeplacement('La recherche de lieu n’a pas pu être chargée.');return;}
    status.textContent='Recherche de votre lieu…';
    var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},15000);
    try{
      var features=await EywaTravelPlaces.search(query,{signal:controller.signal});if(ticket!==version)return;
      if(!features.length){proposerSansDeplacement('Lieu introuvable. Réessayez avec la ville ou le code postal, ou continuez sans.');return;}
      /* Le lieu ne sert qu'à estimer le déplacement : l'adresse exacte est
         demandée à la réservation. On retient donc le premier résultat sans
         rien faire cliquer, et on laisse les autres accessibles au cas où la
         ville trouvée ne serait pas la bonne. */
      selectAddress(features[0],ticket);
      if(features.length>1)proposerAutresLieux(features.slice(1));
    }catch(e){if(ticket===version)proposerSansDeplacement('La recherche d’adresse est momentanément indisponible.');}
    finally{clearTimeout(timeout);}
  };
  async function selectAddress(feature,ticket){
    if(ticket!==version)return;ticket=++version;
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
      var trip=await EywaTravelRoute.eventTrip(window.EYWA_TRAVEL_ORIGIN,feature.geometry.coordinates,feature.properties.countrycode);
      if(ticket!==version)return;
      var cost=EywaTravelPricing.calculate(trip.roundTripKm,trip.roundTripMinutes,trip.outwardKm);
      window.eywaTravel=Object.assign(cost,{localFree:trip.localFree===true,coordinates:feature.geometry.coordinates,country:feature.properties.countrycode,outwardMinutes:trip.outwardMinutes,lodgingRequired:trip.lodgingRequired,label:input.value,approximate:feature.properties.type!=='housenumber'});
      status.textContent=trip.localFree?'Lieu reconnu. Déplacement gratuit dans le rayon de 20 km.':'';
      
      suivant(true);
    }catch(e){if(ticket===version)proposerSansDeplacement('Le lieu est reconnu, mais le trajet n’a pas pu être calculé.');}
  }
  window.checkS2();
})();
