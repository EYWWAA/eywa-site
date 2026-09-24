import { boundary,requireAdmin,json,readJson } from '@/server/http';
import { getMasters,saveMasters,MasterSchema } from '@/server/masters';
export const runtime='nodejs';
export function GET(request:Request){return boundary(request,async()=>{requireAdmin(request);return json(request,{masters:await getMasters()});});}
export function POST(request:Request){return boundary(request,async()=>{requireAdmin(request);const value=MasterSchema.parse(await readJson(request,20000));await saveMasters(value);return json(request,{saved:true,version:value.version,approved:value.approved});});}
