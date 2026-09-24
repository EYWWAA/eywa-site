import { asset, BrandingSchema, normalizeBrand, type Analysis, type Branding } from './types';
import { hashName, proposeBrand } from './art-direction';
import { PRESETS } from './presets';

type Ready = Extract<Analysis, { status: 'ready' }>;
type Entity = { id: string; labels?: Record<string, { value: string }>; descriptions?: Record<string, { value: string }>; claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> };
const CACHE = 'eywa-directions-v3';
const TTL = 14 * 86400 * 1000;
const business = /company|brand|business|manufacturer|retailer|fashion|automob|marque|entreprise|constructeur|fabricant|enseigne|société|distribution|telecom|télécom|cosmétique|maison de|industrie|corporation|restaurant|hôtel|hotel|groupe|chaîne|association|agence|banque|bank|university|université/i;
const norm = (s: string) => normalizeBrand(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}]/gu, '');
function first(e: Entity, property: string): string {
  for (const c of e.claims?.[property] || []) {
    const value = c.mainsnak?.datavalue?.value;
    if (typeof value === 'string') return value;
  }
  return '';
}
function domainOf(url: string) {
  try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, '') : ''; } catch { return ''; }
}
function readCache(key: string): Ready | null {
  try {
    const entries = JSON.parse(localStorage.getItem(CACHE) || '{}');
    const entry = entries[key];
    if (entry?.at > Date.now() - TTL && entry?.value?.status === 'ready') {
      BrandingSchema.parse(entry.value.branding);
      return { ...entry.value, cached: true, modelUrl: asset('/models/eywa-bar-v3.glb') };
    }
  } catch {}
  return null;
}
function saveCache(key: string, value: Ready) {
  try {
    const entries = JSON.parse(localStorage.getItem(CACHE) || '{}');
    entries[key] = { at: Date.now(), value };
    const kept = Object.fromEntries(Object.entries(entries).sort((a, b) => (b[1] as { at: number }).at - (a[1] as { at: number }).at).slice(0, 48));
    localStorage.setItem(CACHE, JSON.stringify(kept));
  } catch {}
}
export function readyProposal(b: Branding, mode: Ready['mode'] = 'proposal', sourced = false): Ready {
  return { status: 'ready', id: 'eywa-' + hashName(b.brand.name), branding: b, cached: false, mode, logoStatus: b.bar.logo ? sourced ? 'sourced' : 'verified' : 'wordmark', modelUrl: asset('/models/eywa-bar-v3.glb'), modelApproved: false, imagesReady: false };
}
async function api(host: string, args: Record<string, string>, signal: AbortSignal) {
  const query = new URLSearchParams({ format: 'json', origin: '*', ...args });
  const response = await fetch('https://' + host + '/w/api.php?' + query, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Public brand source unavailable');
  const body = await response.text();
  if (body.length > 1500000) throw new Error('Source too large');
  return JSON.parse(body);
}
async function logoFromCommons(filename: string, signal: AbortSignal): Promise<string> {
  if (!filename || filename.length > 240) return '';
  try {
    const info = await api('commons.wikimedia.org', { action: 'query', titles: 'File:' + filename, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '600', formatversion: '2' }, signal);
    const image = info.query?.pages?.[0]?.imageinfo?.[0];
    const url = image?.thumburl || image?.url || '';
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'upload.wikimedia.org' ? url : '';
  } catch { return ''; }
}
export async function discoverBrand(name: string, signal: AbortSignal, selectedDomain?: string): Promise<Analysis> {
  const key = normalizeBrand(name) + '|' + (selectedDomain || '');
  const cached = readCache(key);
  if (cached) return cached;
  const base = proposeBrand(name);
  if (PRESETS[normalizeBrand(name)]) {
    const result = readyProposal(base, 'example');
    saveCache(key, result);
    return result;
  }
  const timeout = AbortSignal.timeout(6500);
  const limited = AbortSignal.any([signal, timeout]);
  try {
    const found = await api('www.wikidata.org', { action: 'wbsearchentities', search: name, language: 'fr', uselang: 'fr', limit: '7', type: 'item' }, limited);
    const ids = (found.search || []).map((x: { id: string }) => x.id).filter((id: string) => /^Q\d+$/.test(id)).slice(0, 7);
    if (!ids.length) throw new Error('No public match');
    const details = await api('www.wikidata.org', { action: 'wbgetentities', ids: ids.join('|'), props: 'claims|labels|descriptions', languages: 'fr|en' }, limited);
    const options = Object.values(details.entities || {}).map(item => {
      const e = item as Entity, label = e.labels?.fr?.value || e.labels?.en?.value || name;
      const description = e.descriptions?.fr?.value || e.descriptions?.en?.value || '';
      const domain = domainOf(first(e, 'P856'));
      const exact = norm(label) === norm(name);
      const score = (exact ? 50 : norm(label).includes(norm(name)) ? 20 : 0) + (business.test(description) ? 45 : 0) + (domain ? 10 : 0);
      return { e, label, description, domain, score };
    }).filter(x => business.test(x.description) && x.score >= 60).sort((a, b) => b.score - a.score);
    const chosen = selectedDomain ? options.find(x => x.domain === selectedDomain) : options[0];
    if (!chosen) throw new Error('No business match');
    const comparable = options.filter(x => x.score >= chosen.score - 5 && x.domain && x.domain !== chosen.domain);
    if (!selectedDomain && comparable.length) return { status: 'ambiguous', candidates: [chosen, ...comparable].slice(0, 3).map(x => ({ name: x.label, domain: x.domain, description: x.description })) };
    const b = proposeBrand(name, chosen.description, chosen.domain);
    b.sources = [{ title: chosen.label + ' — identité publique', url: 'https://www.wikidata.org/wiki/' + chosen.e.id }];
    const website = first(chosen.e, 'P856');
    if (chosen.domain && /^https?:\/\//.test(website)) b.sources.push({ title: 'Site de la marque', url: website });
    const filename = first(chosen.e, 'P154');
    const logo = await logoFromCommons(filename, limited);
    if (logo) {
      b.bar.logo = logo;
      b.sources.push({ title: 'Source du logo', url: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(filename.replace(/ /g, '_')) });
    }
    const result = readyProposal(BrandingSchema.parse(b), 'public', true);
    saveCache(key, result);
    return result;
  } catch {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const result = readyProposal(base, PRESETS[normalizeBrand(name)] ? 'example' : 'proposal');
    // A temporary unavailable source should not prevent a later lookup.
    return result;
  }
}
