import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const app = dirname(dirname(fileURLToPath(import.meta.url)));
const site = dirname(app);
const [domain, destination] = process.argv.slice(2);
if (!domain || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain) || !destination) {
  throw new Error('Usage: node scripts/prepare-domain.mjs eywacoffeecatering.com /absolute/path/to/new-directory');
}
const output = resolve(destination);
const overlap = relative(site, output);
const inverse = relative(output, site);
if ((!overlap.startsWith('..') && !isAbsolute(overlap)) || (!inverse.startsWith('..') && !isAbsolute(inverse))) {
  throw new Error('Choose a destination outside the source repository.');
}
// A new directory is required: existing user files are never replaced.
await mkdir(output, { recursive: false });
const oldUrl = 'https://eywwaa.github.io/eywa-site/';
const newUrl = `https://${domain}/`;
for (const entry of await readdir(site, { withFileTypes: true })) {
  if (entry.isFile() && /\.(?:html|css|js|xml|txt)$/.test(entry.name)) {
    const source = await readFile(join(site, entry.name), 'utf8');
    await writeFile(join(output, entry.name), source.split(oldUrl).join(newUrl));
  }
}
for (const folder of ['assets', 'content', 'models']) await cp(join(site, folder), join(output, folder), { recursive: true });
await new Promise((resolveRun, reject) => {
  const child = spawn(process.execPath, [join(app, 'scripts/export-pages.mjs')], {
    cwd: app, stdio: 'inherit', env: { ...process.env, EYWA_BASE_PATH: '/configurateur', EYWA_SITE_URL: newUrl, EYWA_EXPORT_DIR: join(output, 'configurateur') },
  });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolveRun() : reject(new Error(`Domain build failed (${code})`)));
});
await writeFile(join(output, 'CNAME'), `${domain}\n`);
console.log(`Prepared ${newUrl} in ${output}. No DNS, GitHub Pages settings or live files were changed.`);
