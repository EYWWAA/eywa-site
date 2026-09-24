import { PRESETS } from './presets';
import { normalizeBrand, type Branding } from './types';

export type Setting = 'retail' | 'showroom' | 'luxury' | 'event';
type Direction = [Setting, string, string, string, 'line' | 'edge' | 'diagonal' | 'none'];
// EYWA editorial proposals, not a database of official brand guidelines.
const DIRECTIONS: Record<string, Direction> = {
  adidas: ['retail', '#171717', '#FFFFFF', '#C7D0BD', 'diagonal'],
  puma: ['retail', '#F3F0E9', '#151515', '#C42738', 'diagonal'],
  decathlon: ['retail', '#1848AB', '#FFFFFF', '#90D8E8', 'line'],
  uniqlo: ['retail', '#F7F4EE', '#BF252B', '#BF252B', 'none'],
  zara: ['retail', '#E9E5DA', '#242321', '#978D7C', 'none'],
  lacoste: ['retail', '#174E3C', '#FFFFFF', '#C8D1AD', 'line'],
  patagonia: ['retail', '#26384A', '#F8F3E8', '#DD8D55', 'line'],
  chanel: ['luxury', '#171717', '#FFFFFF', '#C8B88E', 'none'],
  hermes: ['luxury', '#C46B32', '#2B231B', '#D6C0A1', 'edge'],
  gucci: ['luxury', '#183D32', '#F4EBDC', '#A4433F', 'line'],
  prada: ['luxury', '#DCE7DE', '#222A24', '#7B8B7F', 'none'],
  celine: ['luxury', '#F1EEE7', '#161616', '#B8A179', 'none'],
  'louis vuitton': ['luxury', '#453527', '#ECD8AF', '#B78D4F', 'edge'],
  sephora: ['luxury', '#191919', '#FFFFFF', '#DC3C4E', 'line'],
  'l oreal': ['luxury', '#F2EAE1', '#222222', '#BAA57E', 'edge'],
  cartier: ['luxury', '#862E36', '#F4E3C2', '#C6A469', 'edge'],
  rolex: ['luxury', '#16473B', '#D8BD7F', '#D8BD7F', 'none'],
  porsche: ['showroom', '#373A3B', '#F3F2EB', '#BD3238', 'line'],
  bmw: ['showroom', '#F0F0EA', '#20272D', '#327EA4', 'diagonal'],
  mercedes: ['showroom', '#202729', '#D7DCDA', '#929F9F', 'none'],
  'mercedes benz': ['showroom', '#202729', '#D7DCDA', '#929F9F', 'none'],
  audi: ['showroom', '#E5E5DF', '#1A1A1A', '#AC383C', 'line'],
  peugeot: ['showroom', '#252D32', '#F0F0E9', '#849594', 'edge'],
  citroen: ['showroom', '#F2EDE3', '#222222', '#B44036', 'line'],
  tesla: ['showroom', '#F5F3EE', '#202222', '#B42C3B', 'none'],
  toyota: ['showroom', '#F1F0EB', '#222222', '#C43034', 'line'],
  volkswagen: ['showroom', '#172D44', '#F5F3ED', '#93B6C7', 'line'],
  mini: ['showroom', '#D5DFB5', '#202621', '#707D58', 'edge'],
  apple: ['event', '#DFE0DC', '#313533', '#B0B5AF', 'none'],
  google: ['event', '#F6F3EC', '#3A4249', '#4276C4', 'diagonal'],
  microsoft: ['event', '#F4F1E8', '#424843', '#2E6B9E', 'edge'],
  netflix: ['event', '#191919', '#D53239', '#D53239', 'line'],
  spotify: ['event', '#1A2420', '#68C286', '#68C286', 'line'],
  orange: ['event', '#F0EBE2', '#2C2926', '#E77824', 'line'],
  ikea: ['retail', '#254A87', '#F1D76A', '#F1D76A', 'line'],
  'coca cola': ['event', '#B62F39', '#FFF8EC', '#FFF8EC', 'none'],
  'red bull': ['event', '#1C3153', '#EEE8DD', '#C44240', 'diagonal'],
};
const keyOf = (name: string) => normalizeBrand(name).normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function hashName(name: string) {
  let h = 2166136261;
  for (const c of normalizeBrand(name)) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
export function settingFor(b: Branding): Setting {
  const known = DIRECTIONS[keyOf(b.brand.name)];
  if (known) return known[0];
  const words = [b.brand.name, b.brand.positioning, b.brand.environment, b.scene.location_type].join(' ').toLowerCase();
  if (/automob|voiture|vehicle|showroom|cupra|renault|concession|motor/.test(words)) return 'showroom';
  if (/luxe|luxury|couture|dior|bijou|jewel|parfum|cosmetic|beauty|cosméti/.test(words)) return 'luxury';
  if (/retail|vêtement|clothing|fashion|sport|mode|celio|nike|textile/.test(words)) return 'retail';
  return 'event';
}
export const settings = {
  retail: { label: 'En boutique', location: 'Une activation en boutique', atmosphere: 'Pierre claire, portants épurés et lumière naturelle.' },
  showroom: { label: 'En showroom', location: 'Une réception en showroom', atmosphere: 'Architecture automobile, métal brossé et lumière de grandes baies vitrées.' },
  luxury: { label: 'Dans un écrin premium', location: 'Une réception de marque', atmosphere: 'Pierre ivoire, détails champagne et lumière douce.' },
  event: { label: 'Lors de votre événement', location: 'Un événement à votre image', atmosphere: 'Un lieu de réception lumineux, du noyer et des matières naturelles.' },
};
export function proposeBrand(name: string, description = '', domain = ''): Branding {
  const clean = name.normalize('NFKC').trim().slice(0, 100);
  if (PRESETS[normalizeBrand(clean)]) return structuredClone(PRESETS[normalizeBrand(clean)]);
  const key = keyOf(clean);
  const fallbackAccents = ['#A38968', '#617E71', '#95634F', '#607587', '#94825F'];
  const direction = DIRECTIONS[key] || ['event', '#E7E4DC', '#23382E', fallbackAccents[parseInt(hashName(clean), 16) % 5], 'line'] as Direction;
  const [setting, front, ink, accent, motif] = direction;
  const b: Branding = {
    brand: { name: clean, domain, positioning: description || 'Proposition de personnalisation EYWA', visual_style: setting === 'luxury' ? 'Composition épurée, contrastes mesurés et matières nobles.' : 'Une signature lisible, des matières chaleureuses et une présence soignée.', primary_colors: [front, ink], secondary_colors: [accent], keywords: [setting, 'Noyer', 'Personnalisation'], environment: settings[setting].atmosphere },
    bar: { front_color: front, side_color: front, logo: '', logo_color: ink, accent_color: accent, accent_elements: [motif], finish: setting === 'showroom' ? 'satin' : 'matte', lighting: 'warm' },
    scene: { location_type: settings[setting].location, lighting: 'Lumière naturelle et chaleureuse', atmosphere: settings[setting].atmosphere, image_prompt: '' },
    rationale: 'Une signature ' + (setting === 'luxury' ? 'discrète' : 'affirmée') + ', une façade lisse et le contraste chaleureux du noyer. Une proposition EYWA pour ' + clean + '.',
    sources: [],
  };
  if (!DIRECTIONS[key] && description) {
    const actual = settingFor(b);
    b.brand.environment = settings[actual].atmosphere;
    b.scene.location_type = settings[actual].location;
    b.scene.atmosphere = settings[actual].atmosphere;
  }
  return b;
}
