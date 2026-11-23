(function(){
 'use strict';
 document.body.classList.add('booking-revised');
 // Ce parcours remplace l'ancien habillage mobile général des cartes.
 document.documentElement.classList.remove('m-cartes');
 var card=document.querySelector('.card'),dock=document.createElement('div'),actions=document.createElement('div');
 dock.className='booking-dock';actions.className='booking-actions';
 var total=document.querySelector('.total-bar'),footer=document.querySelector('.legal-site-footer');
 dock.append(total,actions,footer);document.body.append(dock);
 var note=document.createElement('div');note.className='booking-total-note';total.firstElementChild.append(note);
 var progress=document.createElement('div');progress.className='booking-progress';
 progress.innerHTML='<div class="booking-progress-row"><span id="booking-section">Votre événement</span><strong id="booking-step-number"></strong></div><div class="booking-progress-track" aria-hidden="true">'+Array(7).fill('<i></i>').join('')+'</div><div class="booking-availability"></div>';
 document.querySelector('.main').before(progress);progress.querySelector('.booking-availability').append(document.getElementById('booking-status'));
 var cue=document.createElement('div');cue.className='booking-scroll-cue';cue.textContent='La suite de cette question se trouve plus bas ↓';cue.hidden=true;card.append(cue);
 document.querySelectorAll('.step .btn-row').forEach(function(row){row.dataset.step=row.closest('.step').id;});
 var current=null;
 function scrollState(){var el=current&&current.querySelector('.booking-content');cue.hidden=!el||el.scrollHeight-el.clientHeight<8||el.scrollTop+el.clientHeight>=el.scrollHeight-8;}
 function size(){if(window.visualViewport)document.documentElement.style.setProperty('--booking-height',window.visualViewport.height+'px');requestAnimationFrame(scrollState);}
 function refresh(){
  current=Array.from(document.querySelectorAll('.step')).find(function(s){return s.style.display!=='none';});if(!current)return;
  var n=Number(current.id.slice(1)),old=actions.querySelector('.btn-row');
  if(old&&old.dataset.step!==current.id)document.getElementById(old.dataset.step).append(old);
  var row=current.querySelector('.btn-row');if(row)actions.append(row);
  document.getElementById('booking-section').textContent=n===8?'Votre réservation':n===9?'Facturation':n===7?'Conditions d’accueil':'Votre événement';
  document.getElementById('booking-step-number').textContent=n===1?'Récapitulatif':n===8?'Dernière étape':String(n===9?7:n-1).padStart(2,'0')+' / 07';
  progress.querySelectorAll('.booking-progress-track i').forEach(function(i,index){i.classList.toggle('done',index<(n===8?7:n===9?7:Math.min(7,n-1)));});
  document.getElementById('total-label').textContent='Total de votre devis';
  // Toujours le total de la commande, jamais un acompte présenté comme le total.
  var full=specialPrice||EywaLaunchOffer.state.active;
  document.getElementById('total-display').textContent=formatMoney(totalCents);
  note.textContent=full?'Paiement intégral : '+formatMoney(depositCents):'Acompte à la réservation : '+formatMoney(depositCents);
  progress.querySelector('.booking-availability').hidden=n!==2&&document.getElementById('booking-status').dataset.error!=='true';
  requestAnimationFrame(scrollState);
 }
 document.querySelectorAll('.booking-content').forEach(function(el){el.addEventListener('scroll',scrollState,{passive:true});if(window.ResizeObserver)new ResizeObserver(scrollState).observe(el);});
 var originalGoTo=window.goTo;window.goTo=function(n){originalGoTo(n);refresh();};
 var originalPrice=window.applyOfferPrice;window.applyOfferPrice=function(){originalPrice();refresh();};
 var originalError=window.showErr;window.showErr=function(id,show){originalError(id,show);if(show){requestAnimationFrame(function(){document.getElementById(id).scrollIntoView({block:'nearest',behavior:'smooth'});});}};
 window.addEventListener('resize',size);if(window.visualViewport)window.visualViewport.addEventListener('resize',size);
 size();window.goTo(2);
})();
