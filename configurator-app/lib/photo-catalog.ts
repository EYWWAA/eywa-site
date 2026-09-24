import { asset, normalizeBrand, type Visuals } from './types';

// Only complete photographs belong here. Never synthesize a photo in the browser.
// An unknown brand must not inherit another company's campaign image.
export function curatedPhotos(name: string, domain = ''): Visuals | null {
  const exactName = normalizeBrand(name).replace(/[®*]/g, '').trim();
  const exactDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  if (exactName !== 'celio' || (exactDomain && exactDomain !== 'celio.com')) return null;
  return {
    scene: asset('/editorial/celio/scene-v1.webp'),
    cup: asset('/editorial/celio/cup-v1.webp'),
    latte: asset('/editorial/celio/latte-v1.webp'),
    provenance: 'curated',
  };
}
