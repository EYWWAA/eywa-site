import {crmSession,requestCode,verifyCode,logout,cleanAuth} from './crm-auth.mjs';
import {createCRM} from './crm.mjs';
import {createMailer} from './mail-delivery.mjs';
import {createCorrespondence} from './crm-correspondence.mjs';
import {createCalendar} from './crm-calendar.mjs';
import {stopQuote} from './followups.mjs';
import {html,css,js,icon,touchIcon} from './crm-assets.mjs';
import {createPasskeys} from './crm-passkeys.mjs';
import {createProspects} from './crm-prospects.mjs';
const headers={'Cache-Control':'private, no-store','Pragma':'no-cache','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https://eywacoffeecatering.com data:; connect-src 'self'; manifest-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const json=(status,data,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8',...extra}});
export async function crmHTTP(request,env,ctx){
 const u=new URL(request.url),path=u.pathname;
 if(path==='/espace'||path==='/espace/')return new Response(html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 if(path==='/espace/style.css')return new Response(css,{headers:{...headers,'Content-Type':'text/css; charset=utf-8'}});
 if(path==='/espace/app.js')return new Response(js,{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
 if(path==='/espace/icon.svg')return new Response(icon,{headers:{...headers,'Content-Type':'image/svg+xml'}});
 if(path==='/espace/apple-touch-icon.png')return new Response(Uint8Array.from(atob(touchIcon),c=>c.charCodeAt(0)),{headers:{...headers,'Content-Type':'image/png'}});
 if(path==='/espace/manifest.webmanifest')return new Response(JSON.stringify({id:'/espace/',name:'EYWA · Mon espace',short_name:'EYWA',start_url:'/espace/',scope:'/espace/',display:'standalone',lang:'fr',theme_color:'#243d32',background_color:'#f6f3ec',icons:[{src:'/espace/icon.svg',sizes:'any',type:'image/svg+xml'}]}),{headers:{...headers,'Content-Type':'application/manifest+json'}});
 if(!path.startsWith('/espace/api/'))return json(404,{error:'Page introuvable.'});
 try{
  if(!['GET','POST'].includes(request.method))return json(405,{error:'Méthode non autorisée.'});
  if(request.method==='POST'&&(request.headers.get('Origin')!==u.origin||!request.headers.get('Content-Type')?.startsWith('application/json')))return json(403,{error:'Origine non autorisée.'});
  let body={};if(request.method==='POST'){const raw=await request.text();if(raw.length>25000)return json(413,{error:'Demande trop volumineuse.'});try{body=JSON.parse(raw);}catch{return json(400,{error:'Demande invalide.'});}if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'Demande invalide.'});}
  if(path==='/espace/api/login'&&request.method==='POST')return json(200,await requestCode(request,env,createMailer(env)));
  if(path==='/espace/api/verify'&&request.method==='POST'){const session=await verifyCode(env,body.challenge,body.code);return json(200,{csrf:session.csrf},{'Set-Cookie':session.header});}
  const passkeys=createPasskeys(env,{origin:u.origin,rpId:u.hostname});
  if(path==='/espace/api/passkey-login-options'&&request.method==='POST')return json(200,await passkeys.loginOptions());
  if(path==='/espace/api/passkey-login'&&request.method==='POST'){const session=await passkeys.login(body);return json(200,{csrf:session.csrf},{'Set-Cookie':session.header});}
  const session=await crmSession(request,env);if(!session)return json(401,{error:'Connectez-vous à votre espace EYWA.'});
  if(request.method==='POST'&&request.headers.get('X-EYWA-CSRF')!==session.csrf)return json(403,{error:'Rechargez la page avant de recommencer.'});
  if(path==='/espace/api/session')return json(200,{csrf:session.csrf,passkeys:await passkeys.count()});
  if(path==='/espace/api/passkey-register-options'&&request.method==='POST')return json(200,await passkeys.registerOptions());
  if(path==='/espace/api/passkey-register'&&request.method==='POST')return json(200,await passkeys.register(body));
  if(path==='/espace/api/logout'&&request.method==='POST'){await logout(request,env);return json(200,{ok:true},{'Set-Cookie':'__Host-eywa_session=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
  const crm=createCRM(env);
  if(path==='/espace/api/overview'&&request.method==='GET'){await crm.sync();return json(200,await crm.overview());}
  if(path==='/espace/api/prospect'&&request.method==='GET')return json(200,await createProspects(env).details(u.searchParams.get('id')||''));
  if(path==='/espace/api/event'&&request.method==='GET')return json(200,await crm.details(u.searchParams.get('id')||''));
  if(path==='/espace/api/draft-preview'&&request.method==='GET'){
   const mail=await createCorrespondence(env).preview(u.searchParams.get('id')||'');
   return new Response(mail.html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src https://eywacoffeecatering.com; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
  }
  if(path==='/espace/api/action'&&request.method==='POST'){
   const correspondence=createCorrespondence(env);
   if(body.action==='calendar-refresh')return json(200,await createCalendar(env).sync(true));
   if(body.action==='quote-tracking')return json(200,await correspondence.saveTracking(body));
   if(body.action==='mail-draft')return json(200,await correspondence.saveDraft(body));
   if(body.action==='mail-send')return json(200,await correspondence.send(body,createMailer(env)));
   if(body.action==='stop-followups'){const qid=String(body.id||'');if(!/^[a-f0-9-]{36}$/.test(qid))return json(400,{error:'Devis invalide.'});await stopQuote(env,qid);return json(200,{ok:true});}
   return json(200,await crm.mutate(body.action,body));
  }
  return json(404,{error:'Action introuvable.'});
 }catch(e){return json(e.status||503,{error:e.status?e.message:'L’espace est temporairement indisponible. Réessayez.'});}
}
export async function crmAutomation(env){
 const crm=createCRM(env),mailer=createMailer(env);await createCalendar(env).sync();await crm.sync();await crm.reviewQueue(mailer);await crm.alerts(mailer);try{await createProspects(env).syncMail();}catch{/* Nouvel essai au prochain passage. */}await cleanAuth(env);
}
