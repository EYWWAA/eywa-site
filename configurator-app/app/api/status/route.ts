import { getMasters } from '@/server/masters';
import { json } from '@/server/http';
export const runtime='nodejs';
export async function GET(request:Request){const masters=await getMasters();return json(request,{liveEnabled:!!process.env.OPENAI_API_KEY&&process.env.EYWA_LIVE_ENABLED==='true',imagesReady:!!masters?.approved});}
