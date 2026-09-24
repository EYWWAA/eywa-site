import { mkdir,cp,rm,readFile,writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname,join,resolve as resolvePath,relative,isAbsolute } from 'node:path';
const root=dirname(dirname(fileURLToPath(import.meta.url))),stage=join(root,'.export-stage');
const basePath=process.env.EYWA_BASE_PATH ?? '/configurateur';
if(!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(basePath))throw new Error('EYWA_BASE_PATH must be an absolute URL path without trailing slash.');
const target=resolvePath(process.env.EYWA_EXPORT_DIR || join(root,'..','configurateur'));
// This script replaces its destination. Never accept a source directory or its ancestor.
const fromTarget=relative(target,root);
if(target===root||(!fromTarget.startsWith('..')&&!isAbsolute(fromTarget))||target.startsWith(root+'/'))throw new Error('Export destination overlaps the application source.');
await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
for(const folder of ['app','components','lib','public'])await cp(join(root,folder),join(stage,folder),{recursive:true});
await rm(join(stage,'app','api'),{recursive:true,force:true});await rm(join(stage,'app','qa'),{recursive:true,force:true});
for(const file of ['package.json','tsconfig.json','next.config.ts'])await cp(join(root,file),join(stage,file));
// Resolution walks to the parent node_modules, so no external symlinks are required.
await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:stage,stdio:'inherit',env:{...process.env,EYWA_STATIC_EXPORT:'1',EYWA_BASE_PATH:basePath,NEXT_TELEMETRY_DISABLED:'1'}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Export failed (${code})`)));});
// Keep hashed assets available while an older HTML page remains cached by Pages or a browser.
const previousStatic=join(stage,'previous-static');
let hasPrevious=false;
try{await cp(join(target,'_next','static'),previousStatic,{recursive:true});hasPrevious=true;}catch(error){if(error.code!=='ENOENT')throw error;}
await rm(target,{recursive:true,force:true});await cp(join(stage,'out'),target,{recursive:true});
if(hasPrevious)await cp(previousStatic,join(target,'_next','static'),{recursive:true,force:false});
await writeFile(join(dirname(target),'.nojekyll'),'');console.log('GitHub Pages export:',target);
