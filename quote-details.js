/* Devis détaillé : données du formulaire, options et lien de réservation. */
(function () {
  'use strict';
  const p = new URLSearchParams(location.search || location.hash.replace(/^#/, '?'));
  const money = n => new Intl.NumberFormat('fr-FR', {style:'currency',currency:'EUR'}).format(n);
  const number = (key, fallback, max) => { const n = Number(p.get(key)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback; };
  const guests = Math.round(number('g',50,2000)), hours = number('h',1.5,24), days = Math.round(number('dy',1,365));
  const staff = Math.max(1,Math.ceil(guests/(hours*50)));
  const options = [
    {id:'bar',name:'Habillage du bar',price:250,img:'assets/gallery-v4/08-dior-boutique.webp',description:'Le coffee bar reprend votre logo, vos couleurs ou le visuel de votre événement. Nous préparons l’habillage avec vous pour une présentation cohérente avec votre identité. Les visuels et modalités de production sont validés ensemble avant fabrication.'},
    {id:'cups',name:'Gobelets sur mesure',price:100,img:'assets/gallery-v4/17-nike-gobelet.webp',description:'Prolongez votre identité jusque dans les mains de vos invités avec des gobelets personnalisés. Transmettez votre logo ou votre message : le rendu, les quantités et les délais sont à confirmer avec EYWA avant production.'},
    {id:'logo',name:'Logo sur les boissons',price:100,img:'assets/gallery-v4/01-bar-personnalisable.webp',description:'Apportez une signature visuelle à vos boissons avec votre logo ou un motif personnalisé. Nous validons avec vous le visuel et les boissons adaptées pour que le résultat reste soigné pendant le service.'}
  ];
  let selected = [];
  try { selected = JSON.parse(p.get('options') || '[]'); } catch (_) {}
  if (!Array.isArray(selected)) selected = [];
  options.forEach(o => o.selected = selected.includes(o.name));
  const service = (650 + Math.max(0,guests-50)*5 + Math.round(Math.max(0,hours-1.5)*70) + (staff-1)*200)*days;
  const initialOptions = options.filter(o=>o.selected).reduce((sum,o)=>sum+o.price*days,0);
  const supplied = number('pr',service+initialOptions,10000000);
  // Un ancien lien peut contenir un forfait ajusté sans le détail des options.
  const adjustment = supplied-service-initialOptions;
  const text = (id,value) => document.getElementById(id).textContent=value;
  text('card-title',p.get('p') ? 'Organisons votre événement, '+p.get('p')+'.' : 'Organisons votre événement.');
  text('meta-lieu',p.get('l') || 'Lieu à préciser');
  let date = 'Date à préciser';
  if (/^\d{4}-\d{2}-\d{2}$/.test(p.get('d')||'')) { const d=new Date(p.get('d')+'T12:00:00'); if(!isNaN(d))date=d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }
  const duration = Math.floor(hours)+' h'+(hours%1 ? ' '+String(Math.round(hours%1*60)).padStart(2,'0') : '');
  text('meta-dt',date+(p.get('ti') ? ' · '+p.get('ti') : '')+' · '+duration+' de service');
  text('inc-guests','Service pour '+guests+' invités');
  text('inc-hrs',duration+' de service'+(days>1?' par jour · '+days+' jours':''));
  text('inc-staff',staff+' barista'+(staff>1?'s':'')+' professionnel'+(staff>1?'s':'')+' EYWA');
  const list=document.querySelector('.incl');
  const more=document.createElement('details');more.className='included-more';
  const summary=document.createElement('summary');summary.textContent='Voir tout ce qui est inclus';more.append(summary);
  const moreList=document.createElement('ul');moreList.className='incl';Array.from(list.children).slice(3).forEach(li=>moreList.append(li));more.append(moreList);list.after(more);
  const gallery=Array.from(document.querySelectorAll('.thumb'));
  window.swapHero=src=>{document.getElementById('hero-img').src=src;};
  gallery.forEach((img,i)=>{img.tabIndex=0;img.setAttribute('role','button');img.alt='Voir la photo du coffee bar '+(i+1);img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.swapHero(img.src);}});});
  const makeLine=(title,amount,description)=>{
    const row=document.createElement('article');row.className='quote-line';
    const head=document.createElement('div');head.className='quote-line-head';const h=document.createElement('h3');h.textContent=title;const value=document.createElement('strong');value.textContent=amount;head.append(h,value);row.append(head);
    const detail=document.createElement('details');const label=document.createElement('summary');label.textContent='Voir les détails';const copy=document.createElement('p');copy.textContent=description;detail.append(label,copy);row.append(detail);return row;
  };
  function render(){
    const lines=document.getElementById('line-items');lines.replaceChildren();
    lines.append(makeLine('Coffee bar · '+duration+' de service',money(650*days),'Forfait de base : jusqu’à 50 invités et 1 h 30 de service par jour. Bar mobile, machine à espresso, service barista et carte de boissons EYWA. Installation et rangement réalisés en dehors de la durée de service réservée.'+(days>1?' Prestation sur '+days+' jours.':'')));
    if(guests>50)lines.append(makeLine('Invités supplémentaires',money((guests-50)*5*days),(guests-50)+' invités au-delà du forfait de base, par jour.'));
    if(hours>1.5)lines.append(makeLine('Prolongation du service',money(Math.round((hours-1.5)*70)*days),'Le créneau de service est porté à '+duration+' par jour.'));
    if(staff>1)lines.append(makeLine('Renfort barista',money((staff-1)*200*days),(staff-1)+' barista(s) supplémentaire(s) pour adapter l’équipe au nombre d’invités et à la durée du service.'));
    if(adjustment)lines.append(makeLine('Ajustement du devis initial',money(adjustment),'Montant déjà compris dans votre estimation transmise. Le détail de cet ajustement sera confirmé avec EYWA.'));
    options.filter(o=>o.selected).forEach(o=>lines.append(makeLine(o.name,money(o.price*days),o.description)));
    lines.append(makeLine('Déplacement et logistique','À confirmer','Intervention partout en France. Le déplacement est établi selon la distance aller-retour et le temps de conduite depuis Charleville-Mézières. Il sera détaillé dans votre devis final avant confirmation.'));
    const total=service+adjustment+options.filter(o=>o.selected).reduce((n,o)=>n+o.price*days,0);
    text('price-main',money(total));text('dock-total',money(total));
    const next=new URLSearchParams(p);next.set('pr',total);next.set('options',JSON.stringify(options.filter(o=>o.selected).map(o=>o.name)));next.set('dy',days);
    history.replaceState(null,'',location.pathname+'?'+next.toString()+location.hash);
    ['main','bottom','dock'].forEach(id=>document.getElementById('btn-reserve-'+id).href='reservation.html?'+next.toString());
  }
  options.forEach(o=>{
    const card=document.createElement('article');card.className='upsell-item'+(o.selected?' on':'');
    const img=document.createElement('img');img.className='upsell-thumb';img.src=o.img;img.alt='';
    const info=document.createElement('div');info.className='upsell-info';const name=document.createElement('h3');name.className='upsell-name';name.textContent=o.name;
    const price=document.createElement('p');price.className='upsell-price';price.textContent=money(o.price*days)+(days>1?' pour '+days+' jours':'');
    const details=document.createElement('details');const label=document.createElement('summary');label.textContent='En savoir plus';const copy=document.createElement('p');copy.textContent=o.description;details.append(label,copy);info.append(name,price,details);
    const toggle=document.createElement('label');toggle.className='toggle';const input=document.createElement('input');input.type='checkbox';input.checked=o.selected;input.setAttribute('aria-label','Ajouter : '+o.name);const slider=document.createElement('span');slider.className='slider';toggle.append(input,slider);
    input.addEventListener('change',()=>{o.selected=input.checked;card.classList.toggle('on',o.selected);render();});card.append(img,info,toggle);document.getElementById('quote-options').append(card);
  });
  render();
  window.addEventListener('pageshow',()=>{
    document.querySelectorAll('#quote-options input').forEach((input,i)=>{input.checked=options[i].selected;});
    render();
  });
})();
