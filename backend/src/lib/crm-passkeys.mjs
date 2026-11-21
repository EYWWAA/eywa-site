// Connexion à l'espace EYWA par clé d'accès (WebAuthn) : Touch ID, Face ID ou empreinte.
// Seules les clés ES256 (P-256) sont acceptées ; la vérification utilise WebCrypto, sans dépendance.
import {randomBytes,createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {ownerEmail,createSession} from './crm-auth.mjs';

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const b64u=buf=>Buffer.from(buf).toString('base64url');
const fromB64u=s=>{if(typeof s!=='string'||!/^[A-Za-z0-9_-]{1,4000}$/.test(s))fail('Clé d’accès invalide.');return Buffer.from(s,'base64url');};
const sha256=buf=>createHash('sha256').update(buf).digest();
const TTL=300000,MAX_KEYS=10;

async function issue(env,kind,now){
 const challenge=b64u(randomBytes(32));
 await env.DB.prepare('DELETE FROM eywa_crm_webauthn WHERE expires_at<?').bind(now).run();
 const open=await env.DB.prepare('SELECT COUNT(*) AS n FROM eywa_crm_webauthn WHERE used=0').bind().first();
 if(open.n>=30)fail('Trop de tentatives. Réessayez dans 5 minutes.',429);
 await env.DB.prepare('INSERT INTO eywa_crm_webauthn(challenge,kind,expires_at) VALUES(?,?,?)').bind(challenge,kind,now+TTL).run();
 return challenge;
}
// Lit clientDataJSON, vérifie type, origine, et consomme le défi une seule fois.
async function consume(env,clientDataJSON,type,origin,now){
 let data;try{data=JSON.parse(Buffer.from(clientDataJSON).toString('utf8'));}catch{fail('Clé d’accès invalide.');}
 if(data.type!==type||data.origin!==origin||typeof data.challenge!=='string')fail('Clé d’accès refusée.',401);
 const kind=type==='webauthn.create'?'register':'login';
 const row=await env.DB.prepare('UPDATE eywa_crm_webauthn SET used=1 WHERE challenge=? AND kind=? AND used=0 AND expires_at>? RETURNING challenge').bind(data.challenge,kind,now).first();
 if(!row)fail('Demande expirée. Réessayez.',401);
}
// authenticatorData : 32 octets de hachage de l'identifiant du site, 1 octet de drapeaux, 4 octets de compteur.
function checkAuthData(authData,rpId){
 if(authData.length<37)fail('Clé d’accès invalide.');
 if(!authData.subarray(0,32).equals(sha256(Buffer.from(rpId))))fail('Clé d’accès refusée.',401);
 const flags=authData[32];if(!(flags&0x01)||!(flags&0x04))fail('Confirmez avec votre empreinte.',401);
 return authData.readUInt32BE(33);
}
// Signature ECDSA au format DER, convertie en r||s (64 octets) pour WebCrypto.
export function derToRaw(der){
 const d=Buffer.from(der);if(d[0]!==0x30)fail('Signature invalide.',401);
 let i=2;const part=()=>{if(d[i]!==0x02)fail('Signature invalide.',401);const len=d[i+1];let v=d.subarray(i+2,i+2+len);i+=2+len;while(v.length>32&&v[0]===0)v=v.subarray(1);if(v.length>32)fail('Signature invalide.',401);return Buffer.concat([Buffer.alloc(32-v.length),v]);};
 return Buffer.concat([part(),part()]);
}
async function importKey(spki){
 try{return await crypto.subtle.importKey('spki',spki,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);}catch{fail('Cet appareil n’est pas compatible.');}
}

export function createPasskeys(env,{origin,rpId}){
 const list=async()=>(await env.DB.prepare('SELECT id FROM eywa_crm_passkeys ORDER BY created_at').bind().all()).results;
 return {
  async count(){return (await list()).length;},
  async registerOptions(now=Date.now()){
   const keys=await list();if(keys.length>=MAX_KEYS)fail('Trop d’appareils enregistrés.');
   return {challenge:await issue(env,'register',now),rp:{id:rpId,name:'EYWA'},user:{id:b64u(Buffer.from('eywa-owner')),name:ownerEmail,displayName:'EYWA'},pubKeyCredParams:[{type:'public-key',alg:-7}],timeout:TTL,attestation:'none',authenticatorSelection:{residentKey:'preferred',userVerification:'required'},excludeCredentials:keys.map(k=>({type:'public-key',id:k.id}))};
  },
  async register(body,now=Date.now()){
   if(body.alg!==-7)fail('Cet appareil n’est pas compatible.');
   const id=fromB64u(body.id),clientDataJSON=fromB64u(body.clientDataJSON),authData=fromB64u(body.authenticatorData),spki=fromB64u(body.publicKey);
   await consume(env,clientDataJSON,'webauthn.create',origin,now);
   checkAuthData(authData,rpId);await importKey(spki);
   if((await list()).length>=MAX_KEYS)fail('Trop d’appareils enregistrés.');
   const label=String(body.label||'').slice(0,80);
   await env.DB.prepare('INSERT INTO eywa_crm_passkeys(id,public_key,sign_count,label,created_at) VALUES(?,?,0,?,?) ON CONFLICT(id) DO NOTHING').bind(b64u(id),b64u(spki),label,now).run();
   return {ok:true};
  },
  async loginOptions(now=Date.now()){
   const keys=await list();if(!keys.length)fail('Aucune empreinte n’est encore enregistrée. Connectez-vous avec le code, puis activez Touch ID.',404);
   return {challenge:await issue(env,'login',now),rpId,timeout:TTL,userVerification:'required',allowCredentials:keys.map(k=>({type:'public-key',id:k.id}))};
  },
  async login(body,now=Date.now()){
   const id=b64u(fromB64u(body.id)),clientDataJSON=fromB64u(body.clientDataJSON),authData=fromB64u(body.authenticatorData),signature=fromB64u(body.signature);
   const key=await env.DB.prepare('SELECT * FROM eywa_crm_passkeys WHERE id=?').bind(id).first();if(!key)fail('Cette empreinte n’est pas reconnue.',401);
   await consume(env,clientDataJSON,'webauthn.get',origin,now);
   const counter=checkAuthData(authData,rpId);
   const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},await importKey(fromB64u(key.public_key)),derToRaw(signature),Buffer.concat([authData,sha256(clientDataJSON)]));
   if(!ok)fail('Cette empreinte n’est pas reconnue.',401);
   if(key.sign_count>0&&counter<=key.sign_count)fail('Clé d’accès refusée.',401);
   await env.DB.prepare('UPDATE eywa_crm_passkeys SET sign_count=?,last_used_at=? WHERE id=?').bind(counter,now,id).run();
   return createSession(env,now);
  }
 };
}
