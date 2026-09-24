import { readFile,mkdir,writeFile,rename } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { DATA_DIR,hash } from './storage';
const point=z.tuple([z.number().min(0).max(1),z.number().min(0).max(1)]);
const quadrilateral=z.tuple([point,point,point,point]);
const area=(points:Array<[number,number]>)=>Math.abs(points.reduce((sum,p,i)=>{const next=points[(i+1)%points.length];return sum+p[0]*next[1]-next[0]*p[1];},0))/2;
export const MasterSchema=z.object({version:z.string().min(1).max(80),approved:z.boolean(),model:z.string().regex(/^[a-f0-9]{64}\.glb$/),bar:z.object({image:z.string().regex(/^[a-f0-9]{64}\.png$/),cutout:z.string().regex(/^[a-f0-9]{64}\.png$/),front:quadrilateral,side:quadrilateral.nullable(),placement:z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().min(.1).max(.95)})}),cup:z.object({image:z.string().regex(/^[a-f0-9]{64}\.png$/),surface:quadrilateral}),latte:z.object({image:z.string().regex(/^[a-f0-9]{64}\.png$/),foam:z.object({cx:z.number().min(0).max(1),cy:z.number().min(0).max(1),rx:z.number().min(.02).max(.5),ry:z.number().min(.02).max(.5),rotation:z.number().min(-180).max(180)})})}).superRefine((value,ctx)=>{
 for(const [label,points] of [['bar.front',value.bar.front],['cup.surface',value.cup.surface],...(value.bar.side?[['bar.side',value.bar.side]]:[])] as Array<[string,Array<[number,number]>]>)if(area(points)<0.001)ctx.addIssue({code:z.ZodIssueCode.custom,path:label.split('.'),message:'Calibration quadrilateral is degenerate'});
});
export type Masters=z.infer<typeof MasterSchema>;
export const filePath=(name:string)=>{if(!/^[a-f0-9]{64}\.(png|glb|webp)$/.test(name))throw new Error('Invalid asset');return join(DATA_DIR,'files',name);};
export async function putFile(bytes:Buffer,ext:'png'|'glb'|'webp'){const name=`${hash(bytes.toString('base64'))}.${ext}`;await mkdir(join(DATA_DIR,'files'),{recursive:true,mode:0o700});await writeFile(filePath(name),bytes,{mode:0o600});return name;}
export async function getMasters(){try{return MasterSchema.parse(JSON.parse(await readFile(join(DATA_DIR,'masters.json'),'utf8')));}catch{return null;}}
export async function saveMasters(data:Masters){await mkdir(DATA_DIR,{recursive:true,mode:0o700});const checked=MasterSchema.parse(data);await Promise.all([checked.model,checked.bar.image,checked.bar.cutout,checked.cup.image,checked.latte.image].map(f=>readFile(filePath(f))));const tmp=join(DATA_DIR,`masters-${Date.now()}.tmp`);await writeFile(tmp,JSON.stringify(checked,null,2),{mode:0o600});await rename(tmp,join(DATA_DIR,'masters.json'));}
