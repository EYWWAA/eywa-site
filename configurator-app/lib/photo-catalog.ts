import { z } from 'zod';
import { asset, normalizeBrand, type Visuals } from './types';

const imagePath = z.string().regex(/^\/editorial\/[a-z0-9-]+\/[a-z0-9-]+\.(?:webp|png|jpg)$/);
export const PhotoCatalogSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  entries: z.array(z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(100),
    domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
    visuals: z.object({ scene: imagePath.optional(), cup: imagePath.optional(), latte: imagePath.optional() }),
  })).max(200),
});
export type PhotoCatalog = z.infer<typeof PhotoCatalogSchema>;
const cleanName = (name: string) => normalizeBrand(name).replace(/[®*]/g, '').trim();
const cleanDomain = (domain: string) => domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

export function catalogPhotos(catalog: PhotoCatalog | null, name: string, domain = ''): Visuals | null {
  const entry = catalog?.entries.find(item => cleanName(item.name) === cleanName(name) && (!domain || item.domain === cleanDomain(domain)));
  if (!entry || !Object.values(entry.visuals).some(Boolean)) return curatedPhotos(name, domain);
  return { ...Object.fromEntries(Object.entries(entry.visuals).map(([kind, path]) => [kind, asset(path)])), provenance: 'curated' };
}

export async function loadPhotoCatalog(signal?: AbortSignal): Promise<PhotoCatalog | null> {
  try {
    const response = await fetch(asset('/editorial/catalog.json'), { cache: 'no-store', signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(5000)]) });
    if (!response.ok) return null;
    const parsed = PhotoCatalogSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

// Only complete photographs belong here. Never synthesize a photo in the browser.
// An unknown brand must not inherit another company's campaign image.
export function curatedPhotos(name: string, domain = ''): Visuals | null {
  const exactName = cleanName(name);
  const exactDomain = cleanDomain(domain);
  if (exactName !== 'celio' || (exactDomain && exactDomain !== 'celio.com')) return null;
  return {
    scene: asset('/editorial/celio/scene-v4.webp'),
    cup: asset('/editorial/celio/cup-v4.webp'),
    latte: asset('/editorial/celio/latte-v4.webp'),
    provenance: 'curated',
  };
}
