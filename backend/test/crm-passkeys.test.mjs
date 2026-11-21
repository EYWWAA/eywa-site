import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {crmDatabase} from './crm.test.mjs';
import {createPasskeys,derToRaw} from '../src/lib/crm-passkeys.mjs';
import {crmSession} from '../src/lib/crm-auth.mjs';

const origin='https://espace.example',rpId='espace.example';
const env=DB=>({DB,EYWA_AUTOMATION_ENABLED:'true',EYWA_MAIL_RELAY_SECRET:'local-test-only'});
const sha=b=>createHash('sha256').update(b).digest();
const b64u=b=>Buffer.from(b).toString('base64url');
// Authentificateur simulé : même format que Touch ID (ES256, signature DER, compteur à 0).
async function device(){
 const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const spki=Buffer.from(await webcrypto.subtle.exportKey('spki',keys.publicKey)),id=Buffer.from('credential-'+Math.random());
 const authData=(flags=0x05,count=0,rp=rpId)=>{const b=Buffer.alloc(37);sha(Buffer.from(rp)).copy(b);b[32]=flags;b.writeUInt32BE(count,33);return b;};
 const client=(type,challenge,o=origin)=>Buffer.from(JSON.stringify({type,challenge,origin:o}));
 const toDer=raw=>{const int=v=>{v=Buffer.from(v);while(v.length>1&&v[0]===0&&!(v[1]&0x80))v=v.subarray(1);if(v[0]&0x80)v=Buffer.concat([Buffer.from([0]),v]);return Buffer.concat([Buffer.from([2,v.length]),v]);};const r=int(raw.subarray(0,32)),s=int(raw.subarray(32));return Buffer.concat([Buffer.from([0x30,r.length+s.length]),r,s]);};
 return {
  register:(challenge,o)=>({id:b64u(id),alg:-7,publicKey:b64u(spki),clientDataJSON:b64u(client('webauthn.create',challenge,o)),authenticatorData:b64u(authData())}),
  async login(challenge,{flags,count,rp,o,tamper}={}){const cd=client('webauthn.get',challenge,o),ad=authData(flags,count,rp);const raw=Buffer.from(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,Buffer.concat([ad,sha(cd)])));if(tamper)raw[5]^=1;return {id:b64u(id),clientDataJSON:b64u(cd),authenticatorData:b64u(ad),signature:b64u(toDer(raw))};}
 };
}

test('Passkeys: Touch ID registration then login opens a hashed session',async()=>{
 const DB=crmDatabase(),e=env(DB),p=createPasskeys(e,{origin,rpId});try{
  await assert.rejects(()=>p.loginOptions(),/Aucune empreinte/);
  const d=await device(),reg=await p.registerOptions();
  assert.equal(reg.rp.id,rpId);assert.equal(reg.authenticatorSelection.userVerification,'required');
  await p.register(d.register(reg.challenge));assert.equal(await p.count(),1);
  await assert.rejects(()=>p.register(d.register(reg.challenge)),/expirée/);
  const opt=await p.loginOptions();assert.equal(opt.allowCredentials.length,1);
  const session=await p.login(await d.login(opt.challenge));
  const token=session.header.split(';')[0];
  assert(await crmSession(new Request(origin+'/espace/api/session',{headers:{Cookie:token}}),e));
  assert(!JSON.stringify(DB.raw.prepare('SELECT * FROM eywa_crm_sessions').all()).includes(token.split('=')[1]));
 }finally{DB.raw.close();}
});

test('Passkeys: refuses replays, other sites, missing fingerprint, wrong key and forged signatures',async()=>{
 const DB=crmDatabase(),e=env(DB),p=createPasskeys(e,{origin,rpId});try{
  const d=await device(),other=await device();
  await p.register(d.register((await p.registerOptions()).challenge));
  let c=(await p.loginOptions()).challenge;const ok=await d.login(c);await p.login(ok);
  await assert.rejects(()=>p.login(ok),/expirée/);
  c=(await p.loginOptions()).challenge;await assert.rejects(async()=>p.login(await d.login(c,{o:'https://pirate.example'})),/refusée/);
  c=(await p.loginOptions()).challenge;await assert.rejects(async()=>p.login(await d.login(c,{rp:'pirate.example'})),/refusée/);
  c=(await p.loginOptions()).challenge;await assert.rejects(async()=>p.login(await d.login(c,{flags:0x01})),/empreinte/);
  c=(await p.loginOptions()).challenge;await assert.rejects(async()=>p.login(await d.login(c,{tamper:true})),/pas reconnue/);
  c=(await p.loginOptions()).challenge;await assert.rejects(async()=>p.login(await other.login(c)),/pas reconnue/);
  await assert.rejects(()=>p.register({...d.register('x'),alg:-257}),/compatible/);
  await assert.rejects(()=>p.loginOptions(Date.now()).then(()=>p.login({id:'%%%'})),/invalide/);
 }finally{DB.raw.close();}
});

test('Passkeys: a counter that goes backwards is refused',async()=>{
 const DB=crmDatabase(),e=env(DB),p=createPasskeys(e,{origin,rpId});try{
  const d=await device();await p.register(d.register((await p.registerOptions()).challenge));
  await p.login(await d.login((await p.loginOptions()).challenge,{count:5}));
  await assert.rejects(async()=>p.login(await d.login((await p.loginOptions()).challenge,{count:5})),/refusée/);
  await p.login(await d.login((await p.loginOptions()).challenge,{count:6}));
 }finally{DB.raw.close();}
});

test('Passkeys: DER signatures with leading zeros convert to 64 bytes',()=>{
 const der=Buffer.from('3045022100'+'00'.repeat(1)+'ff'.repeat(31)+'0220'+'01'.repeat(32),'hex');
 assert.equal(derToRaw(Buffer.from([0x30,0x44,0x02,0x20,...Buffer.alloc(32,1),0x02,0x20,...Buffer.alloc(32,2)])).length,64);
 assert.equal(derToRaw(der).length,64);
});
