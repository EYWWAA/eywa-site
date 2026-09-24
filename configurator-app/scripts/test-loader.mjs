import { registerHooks } from 'node:module';
import { readFileSync,existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const base=new URL(specifier,context.parentURL);if(existsSync(fileURLToPath(base)+'.ts'))return next(base.href+'.ts',context);}return next(specifier,context);},load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,shortCircuit:true};return next(url,context);}});
