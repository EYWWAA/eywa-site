import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const files={html:'admin/index.html',css:'admin/style.css',js:'admin/app.js'};
fs.writeFileSync(new URL('src/lib/crm-assets.mjs',root),'// Généré par node tools/build-crm.mjs. Modifier les fichiers admin/, puis reconstruire.\n'+Object.entries(files).map(([key,path])=>'export const '+key+'='+JSON.stringify(fs.readFileSync(new URL(path,root),'utf8'))+';\n').join(''));
fs.appendFileSync(new URL('src/lib/crm-assets.mjs',root),'export const icon='+JSON.stringify(fs.readFileSync(new URL('../favicon.svg',root),'utf8'))+';\nexport const touchIcon='+JSON.stringify(fs.readFileSync(new URL('../apple-touch-icon.png',root)).toString('base64'))+';\n');
