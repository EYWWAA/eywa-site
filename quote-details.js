/* Devis détaillé : données du formulaire, options et lien de réservation. */
(function () {
  'use strict';
  const p = new URLSearchParams(location.search || location.hash.replace(/^#/, '?'));
  const money = n => new Intl.NumberFormat('fr-FR', {style:'currency',currency:'EUR'}).format(n);
  const number = (key, fallback, max) => { const n = Number(p.get(key)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback; };
  const guests = Math.round(number('g',50,2000)), hours = number('h',1.5,24), days = Math.round(number('dy',1,365));
  const staff = Math.max(1,Math.ceil(guests/(hours*50)));
  const options = [
    {id:'bar',name:'Habillage du bar',price:250,img:'assets/gallery-v4/08-dior-boutique.webp',description:'Signalétique personnalisée et habillage du coffee bar avec votre logo, vos couleurs ou le visuel de votre campagne. Un élément visuel fort qui harmonise votre événement et rend votre marque immédiatement reconnaissable. Nous validons ensemble les fichiers graphiques et le rendu avant production.'},
    {id:'cups',name:'Gobelets sur mesure',price:100,img:'assets/gallery-v4/17-nike-gobelet.webp',description:'Votre logo, votre slogan ou un QR code sur les gobelets : nous nous chargeons de la personnalisation. Le type de gobelet, la finition, le design et la quantité sont définis avec vous. Transmettez votre fichier graphique au format vectoriel ou PDF haute définition. Les délais de production et tout ajustement de prix sont confirmés avant fabrication.'},
    {id:'logo',name:'Logo sur les boissons',price:100,img:'assets/gallery-v4/01-bar-personnalisable.webp',description:'Transformez vos boissons en support de communication avec votre logo, un message ou un motif personnalisé sur la mousse. Une attention qui prolonge votre identité jusque dans la tasse et invite vos invités à partager leur expérience. Le visuel et les boissons compatibles sont validés avec vous avant l’événement.'}
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
  let disclosureId=0;
  const makeDescription=(description,title)=>{
    const wrapper=document.createElement('div');wrapper.className='quote-description';
    const copy=document.createElement('p');copy.className='quote-description-copy';copy.id='quote-description-'+(++disclosureId);copy.textContent=description;
    const button=document.createElement('button');button.type='button';button.className='quote-description-toggle';button.textContent='…';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',copy.id);button.setAttribute('aria-label','Afficher la description complète : '+title);
    button.addEventListener('click',()=>{const expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));wrapper.classList.toggle('expanded',expanded);button.setAttribute('aria-label',(expanded?'Réduire la description : ':'Afficher la description complète : ')+title);});
    wrapper.append(copy,button);return wrapper;
  };
  let serviceTime='Horaire à préciser';
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(p.get('ti')||'')) {
    const [hh,mm]=p.get('ti').split(':').map(Number), end=hh*60+mm+Math.round(hours*60);
    const clock=n=>Math.floor((n%1440)/60)+'h'+String(n%60).padStart(2,'0');
    serviceTime=clock(hh*60+mm)+' – '+clock(end)+(end>=1440?' (le lendemain)':'');
  }
  const makeLine=(title,amount,description,schedule)=>{
    const row=document.createElement('article');row.className='quote-line';
    const head=document.createElement('div');head.className='quote-line-head';const h=document.createElement('h3');h.textContent=title;const value=document.createElement('strong');value.textContent=amount;head.append(h,value);row.append(head);
    if(schedule){const time=document.createElement('p');time.className='quote-line-time';time.textContent=schedule;row.append(time);}
    row.append(makeDescription(description,title));return row;
  };
  function render(){
    const lines=document.getElementById('line-items');lines.replaceChildren();
    lines.append(makeLine('Formule classique'+(date!=='Date à préciser'?' · '+date:''),money(650*days),'Forfait de base de 1 h 30 pour jusqu’à 50 invités. Votre événement : '+guests+' invités, '+duration+' de service'+(days>1?' par jour, sur '+days+' jours':'')+'. Comprend : une dégustation de cafés de spécialité, chauds ou glacés — espressos, americanos, cappuccinos, lattes et flat whites — préparés sur place par un barista professionnel. Café bio torréfié localement. Retrouvez l’expérience d’un coffee shop directement sur le lieu de votre événement : des espressos intenses, des cappuccinos crémeux et des boissons préparées à la demande. Le coffee bar, la machine à espresso, le matériel et les gobelets sont inclus. Nous arrivons une heure avant le début du service pour installer le bar ; l’installation et le rangement sont hors du temps de service. Les recettes nécessitant des ingrédients spécifiques sont à convenir en amont.',serviceTime));
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
    info.append(name,price,makeDescription(o.description,o.name));
    const toggle=document.createElement('label');toggle.className='toggle';const input=document.createElement('input');input.type='checkbox';input.checked=o.selected;input.setAttribute('aria-label','Ajouter : '+o.name);const slider=document.createElement('span');slider.className='slider';toggle.append(input,slider);
    input.addEventListener('change',()=>{o.selected=input.checked;card.classList.toggle('on',o.selected);render();});card.append(img,info,toggle);document.getElementById('quote-options').append(card);
  });
  render();
  window.addEventListener('pageshow',()=>{
    document.querySelectorAll('#quote-options input').forEach((input,i)=>{input.checked=options[i].selected;});
    render();
  });
})();
