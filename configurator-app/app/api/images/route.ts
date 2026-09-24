import { z } from 'zod';
import { generateVisuals } from '@/server/images';
import { boundary,json,headersFor,readJson,rateLimit,publicOrigin } from '@/server/http';
export const runtime='nodejs';export const maxDuration=240;
export function OPTIONS(request:Request){return new Response(null,{status:204,headers:headersFor(request)});}
export function POST(request:Request){return boundary(request,async()=>{rateLimit(request,'images',30);const {configurationId}=z.object({configurationId:z.string().regex(/^[a-f0-9]{40}$/)}).parse(await readJson(request));return json(request,await generateVisuals(configurationId,publicOrigin(request)));});}
