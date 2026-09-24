import { analyzeBrand,BrandInput } from '@/server/brand';
import { boundary,json,headersFor,readJson,rateLimit,publicOrigin } from '@/server/http';
export const runtime='nodejs';export const maxDuration=240;
export function OPTIONS(request:Request){return new Response(null,{status:204,headers:headersFor(request)});}
export function POST(request:Request){return boundary(request,async()=>{rateLimit(request,'analysis',20);const input=BrandInput.parse(await readJson(request));return json(request,await analyzeBrand(input,publicOrigin(request)));});}
