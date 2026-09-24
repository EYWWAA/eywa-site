import { asset, type Branding, type Visuals } from './types';
import { settingFor } from './art-direction';

const W = 1536, H = 1024;
const images = new Map<string, Promise<HTMLImageElement>>();
function load(url: string) {
  if (!images.has(url)) images.set(url, new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { images.delete(url); reject(new Error('Image unavailable')); }, 9000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); images.delete(url); reject(new Error('Image unavailable')); };
    img.src = url;
  }));
  return images.get(url)!;
}
function canvas(w = W, h = H) {
  const element = document.createElement('canvas');
  element.width = w; element.height = h;
  return element;
}
const context = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function photo(image: HTMLImageElement) {
  const c = canvas(); context(c).drawImage(image, 0, 0, W, H); return c;
}
function tint(c: HTMLCanvasElement, path: Path2D, color: string, bounds: [number, number, number, number]) {
  const ctx = context(c), mask = canvas();
  context(mask).fill(path);
  const [x, y, w, h] = bounds, data = ctx.getImageData(x, y, w, h), alpha = context(mask).getImageData(x, y, w, h).data;
  const target = rgb(color);
  for (let i = 0; i < data.data.length; i += 4) {
    const coverage = alpha[i + 3] / 255;
    if (!coverage) continue;
    const d = data.data;
    const lum = (d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722) / 255;
    const shade = Math.min(1.10, Math.max(.67, 1 + (lum - .86) * .85));
    for (let k = 0; k < 3; k++) d[i + k] = d[i + k] * (1 - coverage) + Math.min(255, target[k] * shade) * coverage;
    // Original alpha, edge and silhouette stay untouched.
  }
  ctx.putImageData(data, x, y);
}
function makeMark(b: Branding, logo: HTMLImageElement | null, ink = b.bar.logo_color) {
  const c = canvas(900, 300), ctx = context(c);
  if (logo) {
    const scale = Math.min(820 / logo.naturalWidth, 250 / logo.naturalHeight);
    const width = logo.naturalWidth * scale, height = logo.naturalHeight * scale;
    ctx.drawImage(logo, (900 - width) / 2, (300 - height) / 2, width, height);
    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = ink; ctx.fillRect(0, 0, 900, 300);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    const luxury = settingFor(b) === 'luxury';
    const family = luxury ? 'Georgia, serif' : '"DM Sans Variable", Arial, sans-serif';
    ctx.font = (luxury ? '400 ' : '600 ') + '140px ' + family;
    const measured = ctx.measureText(b.brand.name).width;
    if (measured > 820) ctx.font = (luxury ? '400 ' : '600 ') + Math.floor(140 * 820 / measured) + 'px ' + family;
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.brand.name, 450, 157, 820);
  }
  return c;
}
function dressedBar(master: HTMLImageElement, b: Branding, mark: HTMLCanvasElement) {
  const c = photo(master), ctx = context(c), front = new Path2D();
  front.rect(256, 521, 1027, 438);
  tint(c, front, b.bar.front_color, [256, 521, 1027, 438]);
  ctx.save(); ctx.clip(front);
  ctx.globalAlpha = .94;
  ctx.drawImage(mark, 488, 630, 560, 187);
  ctx.fillStyle = b.bar.accent_color;
  if (b.bar.accent_elements.includes('line')) ctx.fillRect(329, 887, 880, 4);
  if (b.bar.accent_elements.includes('edge')) { ctx.fillRect(286, 554, 3, 370); ctx.fillRect(1250, 554, 3, 370); }
  if (b.bar.accent_elements.includes('diagonal')) {
    ctx.beginPath(); ctx.moveTo(1120, 959); ctx.lineTo(1283, 820); ctx.lineTo(1283, 959); ctx.fill();
  }
  ctx.restore();
  return c;
}
function scenePhoto(background: HTMLImageElement, bar: HTMLCanvasElement) {
  const c = photo(background), ctx = context(c);
  ctx.save();
  ctx.filter = 'blur(20px)'; ctx.fillStyle = 'rgba(27,22,17,.24)';
  ctx.beginPath(); ctx.ellipse(770, 902, 415, 27, 0, 0, Math.PI * 2); ctx.fill();
  ctx.filter = 'blur(5px)'; ctx.fillStyle = 'rgba(27,22,17,.19)';
  for (const x of [438, 1070]) { ctx.beginPath(); ctx.ellipse(x, 900, 30, 9, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // One immutable cutout, uniformly scaled. Only its wrap changes.
  ctx.drawImage(bar, 173, 108, 1190, 793.333);
  return c;
}
function cupPhoto(master: HTMLImageElement, b: Branding, mark: HTMLCanvasElement) {
  const c = photo(master), ctx = context(c), surface = new Path2D();
  surface.moveTo(450, 207);
  surface.bezierCurveTo(625, 249, 927, 247, 1077, 205);
  surface.lineTo(980, 863);
  surface.bezierCurveTo(952, 938, 568, 940, 531, 863);
  surface.closePath();
  tint(c, surface, b.bar.front_color, [448, 204, 632, 729]);
  ctx.save(); ctx.clip(surface); ctx.globalAlpha = .96;
  const width = 386, height = 160, left = 566, top = 440;
  for (let x = 0; x < width; x += 2) {
    const n = (x / width - .5) * 2;
    const source = (Math.asin(n * .7) / Math.asin(.7) + 1) / 2;
    ctx.drawImage(mark, Math.max(0, Math.min(898, source * 898)), 0, 2.5, 300, left + x, top + n * n * 9, 2.2, height);
  }
  if (!b.bar.accent_elements.includes('none')) {
    ctx.strokeStyle = b.bar.accent_color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(522, 770); ctx.quadraticCurveTo(754, 815, 1000, 770); ctx.stroke();
  }
  ctx.restore();
  return c;
}
function lattePhoto(master: HTMLImageElement, mark: HTMLCanvasElement) {
  const c = photo(master), ctx = context(c), layer = canvas();
  context(layer).drawImage(mark, 468, 365, 560, 187);
  const ink = context(layer).getImageData(0, 0, W, H).data, data = ctx.getImageData(0, 0, W, H);
  for (let y = 365; y < 553; y++) for (let x = 468; x < 1029; x++) {
    const i = (y * W + x) * 4, coverage = ink[i + 3] / 255;
    if (!coverage) continue;
    const d = data.data, lum = (d[i] + d[i + 1] + d[i + 2]) / 765;
    const grain = (((Math.imul(x + 31, 1103515245) ^ Math.imul(y + 7, 12345)) >>> 17) % 101) / 100;
    const opacity = coverage * .82 * (.78 + .22 * grain) * (.74 + .26 * lum);
    const cocoa = [102, 57, 29];
    for (let k = 0; k < 3; k++) d[i + k] = d[i + k] * (1 - opacity) + cocoa[k] * (.8 + lum * .2) * opacity;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}
async function output(c: HTMLCanvasElement) {
  const scaled = canvas(1200, 800);
  context(scaled).drawImage(c, 0, 0, 1200, 800);
  return new Promise<string>((resolve, reject) => scaled.toBlob(blob => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Image export failed')), 'image/webp', .9));
}
export function releaseVisuals(v: Visuals) {
  for (const key of ['scene', 'cup', 'latte'] as const) if (v[key]?.startsWith('blob:')) URL.revokeObjectURL(v[key]!);
}
export async function renderVisuals(b: Branding): Promise<Visuals> {
  const category = settingFor(b);
  const logoURL = b.bar.logo.startsWith('/brands/') ? asset(b.bar.logo) : b.bar.logo;
  const [bar, cup, latte, background, logo] = await Promise.all([
    load(asset('/visuals/bar-v1.webp')), load(asset('/visuals/cup-v1.webp')),
    load(asset('/visuals/latte-v1.webp')), load(asset('/visuals/' + category + '-v1.webp')),
    logoURL ? load(logoURL).catch(() => null) : Promise.resolve(null),
    document.fonts.ready,
  ]);
  const mark = makeMark(b, logo), coffeeMark = makeMark(b, logo, '#6D3F26');
  const results: Visuals = {};
  try {
    results.scene = await output(scenePhoto(background, dressedBar(bar, b, mark)));
    // Yield between full-resolution compositions on mobile.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    results.cup = await output(cupPhoto(cup, b, mark));
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    results.latte = await output(lattePhoto(latte, coffeeMark));
    return results;
  } catch (error) { releaseVisuals(results); throw error; }
}
