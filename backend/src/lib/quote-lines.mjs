export function quoteLines(q,c){
 const days=Number(q.dy||1),guests=Number(q.g),hours=Number(q.h),staff=Math.max(1,Math.ceil(guests/(hours*50)));
 const lines=[{title:'Coffee bar — formule de base',description:'50 invités, 1 h 30 de service par jour',normalCents:25000*days}];
 if(guests>50)lines.push({title:'Invités supplémentaires',description:(guests-50)+' × 1,90 € × '+days+' jour(s)',normalCents:(guests-50)*190*days});
 if(hours>1.5)lines.push({title:'Temps de service supplémentaire',description:(hours-1.5)+' h × 55 € × '+days+' jour(s)',normalCents:Math.round((hours-1.5)*5500)*days});
 if(staff>1)lines.push({title:'Renfort barista',description:(staff-1)+' × 150 € × '+days+' jour(s)',normalCents:(staff-1)*15000*days});
 let opts=typeof q.options==='string'?JSON.parse(q.options):q.options||[];
 for(const title of new Set(opts))lines.push({title,description:days+' jour(s)',normalCents:{'Habillage du bar':20000,'Gobelets sur mesure':20000,'Logo sur les boissons':15000}[title]*days,personalization:true});
 if(c.rushCupsCents)lines.push({title:'Impression accélérée des gobelets',description:'Supplément unique, événement à moins de 14 jours',normalCents:c.rushCupsCents,personalization:true});
 lines.push({title:'Déplacement aller-retour',description:c.travel.total?'Selon le lieu validé au devis':'Zone locale gratuite',normalCents:Math.round(c.travel.total*100)});
 if(lines.reduce((n,l)=>n+l.normalCents,0)!==c.normalCents)throw Error('QUOTE_LINES_MISMATCH');
 return {lineItems:lines,staff};
}
