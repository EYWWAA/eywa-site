import {randomBytes,randomInt,randomUUID,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
const hash=s=>createHash('sha256').update(s).digest('hex');
const sign=(env,s)=>createHmac('sha256',env.EYWA_MAIL_RELAY_SECRET).update('eywa-crm-v1:'+s).digest('hex');
export const ownerEmail='contact.eywa08@gmail.com';
export function cookie(request){return /(?:^|;\s*)__Host-eywa_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie')||'')?.[1]||'';}
export async function crmSession(request,env,now=Date.now()){
 const token=cookie(request);if(!token)return null;
 return env.DB.prepare('SELECT csrf,expires_at FROM eywa_crm_sessions WHERE token_hash=? AND expires_at>?').bind(hash(token),now).first();
}
export async function requestCode(request,env,mailer,now=Date.now()){
 if(!env.EYWA_MAIL_RELAY_SECRET||env.EYWA_AUTOMATION_ENABLED!=='true')throw Object.assign(Error('La connexion par e-mail est momentanément indisponible.'),{status:503});
 const ip=hash(request.headers.get('CF-Connecting-IP')||'local');
 for(const [key,max,window]of [['global',4,900000],[ip,3,900000],['daily',20,86400000]]){
  const bucket=Math.floor(now/window)+':'+key;
  const row=await env.DB.prepare('INSERT INTO eywa_crm_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now+window*2).first();
  if(row.count>max)throw Object.assign(Error('Plusieurs codes ont été demandés. Réessayez dans 15 minutes.'),{status:429});
 }
 const id=randomUUID(),code=String(randomInt(0,100000000)).padStart(8,'0');
 await env.DB.prepare('INSERT INTO eywa_crm_auth(id,code_hash,expires_at) VALUES(?,?,?)').bind(id,sign(env,id+':'+code),now+600000).run();
 await mailer.enqueue('crm-login:'+id,ownerEmail,{subject:'Votre code de connexion à l’espace EYWA',text:'Votre code de connexion EYWA : '+code+'\n\nValable 10 minutes. Ne le communiquez à personne. Si vous n’avez pas demandé cette connexion, ignorez ce message.',html:'<p>Votre code de connexion à l’espace EYWA :</p><p style="font:32px monospace;letter-spacing:5px">'+code+'</p><p>Valable 10 minutes. Ne le communiquez à personne.</p>'},null,'crm-login');
 await mailer.deliver('crm-login:'+id);
 return {challenge:id,message:'Un code a été envoyé à la boîte EYWA. Il est valable 10 minutes.'};
}
export async function verifyCode(env,challenge,code,now=Date.now()){
 if(!/^[a-f0-9-]{36}$/.test(challenge||'')||!/^\d{8}$/.test(code||''))throw Object.assign(Error('Code invalide.'),{status:400});
 // Une seule vérification peut consommer un code. Les tentatives sont incrémentées atomiquement.
 const row=await env.DB.prepare('UPDATE eywa_crm_auth SET attempts=attempts+1 WHERE id=? AND used=0 AND attempts<6 AND expires_at>? RETURNING code_hash').bind(challenge,now).first();
 if(!row||!timingSafeEqual(Buffer.from(row.code_hash),Buffer.from(sign(env,challenge+':'+code))))throw Object.assign(Error('Code incorrect ou expiré.'),{status:401});
 const used=await env.DB.prepare('UPDATE eywa_crm_auth SET used=1 WHERE id=? AND used=0 RETURNING id').bind(challenge).first();
 if(!used)throw Object.assign(Error('Ce code a déjà été utilisé.'),{status:401});
 return createSession(env,now);
}
export async function createSession(env,now=Date.now()){
 const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
 await env.DB.prepare('INSERT INTO eywa_crm_sessions(token_hash,csrf,expires_at) VALUES(?,?,?)').bind(hash(token),csrf,now+8*3600000).run();
 return {csrf,header:'__Host-eywa_session='+token+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'};
}
export async function logout(request,env){await env.DB.prepare('DELETE FROM eywa_crm_sessions WHERE token_hash=?').bind(hash(cookie(request))).run();}
export async function cleanAuth(env,now=Date.now()){
 await env.DB.batch(['eywa_crm_auth','eywa_crm_sessions','eywa_crm_limits','eywa_crm_webauthn'].map(table=>env.DB.prepare('DELETE FROM '+table+' WHERE expires_at<?').bind(now)));
 await env.DB.prepare("DELETE FROM eywa_email_outbox WHERE kind='crm-login' AND created_at<?").bind(now-3600000).run();
}
