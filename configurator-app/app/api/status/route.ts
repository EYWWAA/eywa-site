import { photoReferencePaths } from '@/server/photo-references';
import { json } from '@/server/http';
export const runtime='nodejs';
export async function GET(request:Request){const references=await photoReferencePaths();return json(request,{liveEnabled:!!process.env.OPENAI_API_KEY&&process.env.EYWA_LIVE_ENABLED==='true',imagesReady:!!references});}
