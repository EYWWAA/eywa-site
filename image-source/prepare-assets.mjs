import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('../configurator-app/node_modules/sharp');
const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'image-source/manifest.json'), 'utf8'));
for (const item of manifest.images) {
  const dir = path.join(root, 'assets/gallery-v4');
  await fs.mkdir(dir, { recursive: true });
  const output = path.join(dir, item.slug + '.webp');
  const thumb = path.join(dir, item.slug + '-thumb.webp');
  const source = path.resolve(root, item.source);
  await sharp(source).webp({ quality: 87, effort: 6 }).toFile(output);
  await sharp(source).resize({ width: 160 }).webp({ quality: 75 }).toFile(thumb);
  const info = await sharp(output).metadata();
  item.file = 'assets/gallery-v4/' + item.slug + '.webp';
  item.width = info.width;
  item.height = info.height;
  console.log(item.slug + ': ' + info.width + ' × ' + info.height);
}
await fs.writeFile(path.join(root, 'image-source/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
