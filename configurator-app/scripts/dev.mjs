import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require=createRequire(import.meta.url);
const args=process.argv.slice(2);const port=args.includes('--port')?args[args.indexOf('--port')+1]:'4173';
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--webpack','--hostname','0.0.0.0','--port',port],{stdio:'inherit',env:process.env});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>child.kill(sig));child.on('exit',c=>process.exit(c??1));
