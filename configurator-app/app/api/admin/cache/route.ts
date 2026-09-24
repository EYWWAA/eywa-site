import { boundary,requireAdmin,json,readJson } from '@/server/http';
import { getConfiguration } from '@/server/brand';
import { removeCache,prune } from '@/server/storage';
import { z } from 'zod';
export const runtime='nodejs';
export function POST(request:Request){return boundary(request,async()=>{requireAdmin(request);const {id}=z.object({id:z.string().regex(/^[a-f0-9]{40}$/)}).parse(await readJson(request));const c=getConfiguration(id);if(c)removeCache(c.sourceKey);removeCache(`configuration:${id}`);prune();return json(request,{invalidated:true});});}
