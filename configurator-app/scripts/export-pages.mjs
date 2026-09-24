import { mkdir,cp,rm,readFile,writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname,join } from 'node:path';
const root=dirname(dirname(fileURLToPath(import.meta.url))),stage=join(root,'.export-stage');
await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
for(const folder of ['app','components','lib','public'])await cp(join(root,folder),join(stage,folder),{recursive:true});
await rm(join(stage,'app','api'),{recursive:true,force:true});await rm(join(stage,'app','qa'),{recursive:true,force:true});
for(const file of ['package.json','tsconfig.json','next.config.ts'])await cp(join(root,file),join(stage,file));
// Resolution walks to the parent node_modules, so no external symlinks are required.
await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:stage,stdio:'inherit',env:{...process.env,EYWA_STATIC_EXPORT:'1',EYWA_BASE_PATH:'/eywa-site/configurateur',NEXT_TELEMETRY_DISABLED:'1'}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Export failed (${code})`)));});
const target=join(root,'..','configurateur');await rm(target,{recursive:true,force:true});await cp(join(stage,'out'),target,{recursive:true});await writeFile(join(root,'..','.nojekyll'),'');console.log('GitHub Pages export:',target);
