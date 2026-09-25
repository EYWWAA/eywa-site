// Local publishing only: this script has no API key, paid endpoint or generation code.
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public'), exported = resolve(root, '../configurateur');
const catalogFile = join(publicDir, 'editorial/catalog.json');
const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
const kinds = ['scene', 'cup', 'latte'];
if (catalog.version !== 1 || !Array.isArray(catalog.entries)) throw Error('Invalid catalog');
const slugs = new Set();
for (const entry of catalog.entries) {
  if (!/^[a-z0-9-]+$/.test(entry.slug) || slugs.has(entry.slug)) throw Error('Invalid or duplicate slug');
  slugs.add(entry.slug);
  if (!entry.name || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(entry.domain) || !entry.visuals) throw Error('Invalid brand');
  for (const [kind, path] of Object.entries(entry.visuals)) {
    if (!kinds.includes(kind) || !new RegExp(`^/editorial/${entry.slug}/[a-z0-9-]+\\.(webp|png|jpg)$`).test(path)) throw Error('Invalid image path');
    const meta = await sharp(join(publicDir, path)).metadata();
    if ((meta.width || 0) < 512 || (meta.height || 0) < 512) throw Error('Image too small');
  }
}
const [command, slug, kind, source, review] = process.argv.slice(2);
if (command === 'pending') {
  // Prioritize scenes for every brand, then the matching cup/latte details.
  const pending = kinds.flatMap(kind => catalog.entries.filter(e => !e.visuals[kind]).map(e => ({ slug: e.slug, name: e.name, domain: e.domain, kind })));
  console.log(JSON.stringify(pending, null, 2));
} else if (command === 'check') {
  const published = JSON.parse(await readFile(join(exported, 'editorial/catalog.json'), 'utf8'));
  if (JSON.stringify(published) !== JSON.stringify(catalog)) throw Error('Source/export catalogs differ');
  for (const entry of catalog.entries) for (const path of Object.values(entry.visuals)) {
    const a = await readFile(join(publicDir, path)), b = await readFile(join(exported, path));
    if (!a.equals(b)) throw Error(`Source/export image differs: ${path}`);
  }
  console.log(`Catalog verified: ${catalog.entries.length} brands, source and exported images identical.`);
} else if (command === 'add') {
  const entry = catalog.entries.find(e => e.slug === slug);
  if (!entry || !kinds.includes(kind) || !source || review !== '--reviewed') throw Error('Usage: add <existing-slug> <scene|cup|latte> <local-image> --reviewed');
  if (entry.visuals[kind]) throw Error('Image already published; replacement requires a separate reviewed change.');
  const data = await readFile(resolve(source));
  const meta = await sharp(data).metadata();
  if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.width || 0) < 1024 || (meta.height || 0) < 768) throw Error('Expected a high-resolution generated image');
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 12);
  const path = `/editorial/${slug}/${kind}-${hash}.webp`;
  await mkdir(join(publicDir, 'editorial', slug), { recursive: true });
  await mkdir(join(exported, 'editorial', slug), { recursive: true });
  await sharp(data).webp({ quality: 90 }).toFile(join(publicDir, path));
  await copyFile(join(publicDir, path), join(exported, path));
  entry.visuals[kind] = path;
  catalog.updatedAt = new Date().toISOString();
  const output = JSON.stringify(catalog, null, 2) + '\n';
  // Publish asset first, then its index; never advertise a missing image.
  for (const file of [catalogFile, join(exported, 'editorial/catalog.json')]) {
    await writeFile(`${file}.tmp`, output); await rename(`${file}.tmp`, file);
  }
  console.log(`Added reviewed ${entry.name} ${kind}: ${path}`);
} else throw Error('Choose pending, check, or add.');
