import { readFile } from 'node:fs/promises';
import { filePath } from '@/server/masters';
import { boundary,ApiError,headersFor } from '@/server/http';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{name:string}>}){return boundary(request,async()=>{const {name}=await params;if(!/^[a-f0-9]{64}\.(png|webp|glb)$/.test(name))throw new ApiError(404,'Fichier introuvable.');let bytes;try{bytes=await readFile(filePath(name));}catch{throw new ApiError(404,'Fichier introuvable.');}const h=headersFor(request);h.set('Content-Type',name.endsWith('.glb')?'model/gltf-binary':name.endsWith('.webp')?'image/webp':'image/png');h.set('Cache-Control','public,max-age=31536000,immutable');h.set('Cross-Origin-Resource-Policy','cross-origin');return new Response(new Uint8Array(bytes),{headers:h});});}
