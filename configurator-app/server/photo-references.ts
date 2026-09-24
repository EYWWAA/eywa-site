import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { filePath, getMasters } from './masters';

export async function photoReferencePaths() {
  const masters = await getMasters();
  const bar = masters?.approved ? filePath(masters.bar.image)
    : process.env.EYWA_BAR_REFERENCE_FILE ? resolve(process.env.EYWA_BAR_REFERENCE_FILE) : null;
  if (!bar) return null;
  const paths = {
    bar,
    quality: join(process.cwd(), 'public/editorial/celio/scene-v1.webp'),
    cup: masters?.approved ? filePath(masters.cup.image) : join(process.cwd(), 'public/editorial/celio/cup-v1.webp'),
    latte: masters?.approved ? filePath(masters.latte.image) : join(process.cwd(), 'public/editorial/celio/latte-v1.webp'),
  };
  try { await Promise.all(Object.values(paths).map(p => access(p))); return paths; } catch { return null; }
}

// Private original photo stays on the server; it is never bundled with the website.
export async function photoDataUrl(path: string) {
  const bytes = await sharp(await readFile(path)).rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 95 }).toBuffer();
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}
