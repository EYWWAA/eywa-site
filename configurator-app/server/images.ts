import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from './http';
import { cached,saveCache,claim,release,consume,hash } from './storage';
import { getConfiguration } from './brand';
import { getMasters,filePath,putFile } from './masters';
import { composeCup,composeLatte,composeScene } from './compositor';
import type { Visuals } from '../lib/types';
import sharp from 'sharp';
async function localLogo(url:string){const path=new URL(url).pathname;if(/^\/api\/files\/[a-f0-9]{64}\.png$/.test(path))return readFile(filePath(path.split('/').pop()!));const packaged=path.match(/^\/brands\/(nike|dior|renault)\.svg$/);if(packaged)return sharp(await readFile(join(process.cwd(),'public','brands',`${packaged[1]}.svg`))).resize(900).trim().png().toBuffer();throw new ApiError(422,'Le logo officiel doit être confirmé avant les photos.','LOGO_REQUIRED');}
export async function generateVisuals(id:string,origin:string):Promise<Visuals>{const configuration=getConfiguration(id);if(!configuration)throw new ApiError(404,'Cette proposition a expiré. Recréez votre bar.','EXPIRED');const masters=await getMasters();if(!masters?.approved)throw new ApiError(409,'Les photos de référence EYWA sont en cours de préparation.','MASTERS_REQUIRED');if(configuration.logoStatus!=='verified')throw new ApiError(422,'Le logo officiel n’a pas pu être récupéré. Notre équipe pourra finaliser votre proposition.','LOGO_REQUIRED');
 const {branding}=configuration;const version=hash(JSON.stringify(masters)+JSON.stringify(branding)+'compositor-v1');const key=`visuals:${id}:${version}`;const saved=cached<Visuals>(key)||{};if(saved.scene&&saved.cup&&saved.latte)return saved;
 const token=claim(key,300000);if(!token)throw new ApiError(409,'Les images de cette proposition sont déjà en cours de préparation.','IN_PROGRESS');const result:Visuals={...saved,errors:{}};
 try{const logo=await localLogo(branding.bar.logo);const work=(['cup','latte','scene'] as const).map(async kind=>{if(result[kind])return;try{let bytes:Buffer;if(kind==='cup')bytes=await composeCup(masters,branding,logo);else if(kind==='latte')bytes=await composeLatte(masters,logo);else{
     if(!process.env.OPENAI_API_KEY)throw new ApiError(503,'La mise en situation sera disponible prochainement.');const daily=Math.max(1,Math.min(500,Number(process.env.EYWA_DAILY_GENERATION_LIMIT)||20));if(!consume('image-budget',daily,86400000))throw new ApiError(429,'Les mises en situation reprendront prochainement. Votre aperçu est conservé.');
     const master=await readFile(filePath(masters.bar.image));
     // A reference-aware image edit produces a backdrop only. The original bar
     // cutout is deterministically composited afterward; AI never paints the bar.
     const form=new FormData();form.set('model',process.env.OPENAI_IMAGE_MODEL||'gpt-image-2');form.set('image',new Blob([new Uint8Array(master)],{type:'image/png'}),'eywa-reference.png');form.set('prompt',`Use the attached real EYWA bar photo ONLY to match camera angle, scale, perspective and lighting. Return a photorealistic EMPTY ENVIRONMENT plate: remove the bar and all coffee equipment from this output. Leave the central foreground floor empty for later compositing of the exact original bar. Do NOT generate a coffee bar, cup, machine or counter. ${branding.scene.image_prompt}. Brand context: ${branding.brand.name}, ${branding.scene.location_type}, ${branding.scene.atmosphere}. Premium event photography, believable retail architecture, realistic floor contact lighting. No extra graphic overlays.`);form.set('size','1536x1024');form.set('quality','high');const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),180000);let ai;try{const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form,signal:controller.signal});if(!response.ok)throw new Error('Image generation failed');ai=await response.json();}finally{clearTimeout(timer);}const base64=ai.data?.[0]?.b64_json;if(typeof base64!=='string'||base64.length>32*1024*1024)throw new Error('No image returned');bytes=await composeScene(masters,branding,logo,Buffer.from(base64,'base64'));}
    const filename=await putFile(bytes,'png');result[kind]=`${origin}/api/files/${filename}`;
   }catch(e){result.errors![kind]=e instanceof ApiError?e.message:kind==='scene'?'La mise en situation n’a pas pu être terminée. Réessayez.':'Le détail photo n’a pas pu être préparé. Réessayez.';}});
  await Promise.allSettled(work);saveCache(key,result);return result;
 }finally{release(key,token);}
}
