'use strict';
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
function addDays(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function today(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(now);}
function minimumDate(now){return addDays(today(now),3);}
function eventDays(date,days=1,now){days=Number(days);if(!validDate(date)||date<minimumDate(now))throw Object.assign(Error('Réservez au moins 3 jours à l’avance.'),{code:'DATE_TOO_SOON'});if(!Number.isInteger(days)||days<1||days>365)throw Error('Nombre de jours invalide');return Array.from({length:days},(_,i)=>addDays(date,i));}
function occupiedDays(q,now){const base=eventDays(String(q.d||''),Number(q.dy||1),now);if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(q.ti||''))throw Error('Heure de début invalide');const [h,m]=q.ti.split(':').map(Number),hours=Number(q.h);if(!Number.isFinite(hours)||hours<.5||hours>24)throw Error('Durée invalide');const extra=Math.floor((h*60+m+Math.round(hours*60)-1)/1440);if(extra>0)base.push(addDays(base.at(-1),1));return base;}
module.exports={validDate,addDays,today,minimumDate,eventDays,occupiedDays};
