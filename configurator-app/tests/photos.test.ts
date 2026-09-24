import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { curatedPhotos } from '../lib/photo-catalog';
import { PRESETS } from '../lib/presets';

test('Curated photographs never leak from Celio into another company proposal', () => {
  assert.ok(curatedPhotos('Celio', 'celio.com')?.scene);
  assert.ok(curatedPhotos(' celio* ', 'www.celio.com')?.latte);
  for (const [name, domain] of [['Adidas', 'adidas.com'], ['EYWA Atelier', ''], ['Celio', 'celio-finance.fr']]) assert.equal(curatedPhotos(name, domain), null);
});

test('Actual photograph orchestration uses Astra references, caches successes and withholds failed quality reviews', async () => {
  const data = await mkdtemp(join(tmpdir(), 'eywa-photo-test-'));
  const previousFetch = globalThis.fetch;
  const keys = ['EYWA_DATA_DIR', 'EYWA_BAR_REFERENCE_FILE', 'OPENAI_API_KEY', 'EYWA_LIVE_ENABLED'];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  process.env.EYWA_DATA_DIR = data;
  process.env.EYWA_BAR_REFERENCE_FILE = join(data, 'bar.png');
  process.env.OPENAI_API_KEY = 'test-only-not-an-api-key';
  process.env.EYWA_LIVE_ENABLED = 'true';
  const image = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: '#a19989' } }).png().toBuffer();
  await writeFile(process.env.EYWA_BAR_REFERENCE_FILE, image);
  let accept = true, generated = 0;
  const requests: any[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(init?.body as string); requests.push(body);
    assert.equal(body.model, 'gpt-6-astra');
    assert.ok(body.input[0].content.some((c: any) => c.type === 'input_image'));
    if (body.tools) { generated++; return Response.json({ output: [{ type: 'image_generation_call', result: image.toString('base64') }] }); }
    const verdict = { product_preserved: accept, logo_faithful: true, photographic: true, no_wrong_brand: true };
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(verdict) }] }] });
  };
  try {
    const { saveCache } = await import('../server/storage');
    const { generateVisuals } = await import('../server/images');
    const brand = { ...PRESETS.nike, bar: { ...PRESETS.nike.bar, logo: 'https://api.example.com/brands/nike.svg' } };
    saveCache(`configuration:${'a'.repeat(40)}`, { branding: brand, logoStatus: 'verified', sourceKey: 'test' });
    const first = await generateVisuals('a'.repeat(40), 'https://api.example.com');
    assert.ok(first.scene && first.cup && first.latte); assert.equal(first.provenance, 'openai'); assert.equal(generated, 3);
    assert.ok(requests.filter(r => r.tools).every(r => r.tools[0].model === 'gpt-image-2.5-sunburst' && r.tools[0].quality === 'high' && r.tool_choice.type === 'image_generation'));
    const cached = await generateVisuals('a'.repeat(40), 'https://api.example.com');
    assert.equal(cached.scene, first.scene); assert.equal(generated, 3);
    accept = false;
    saveCache(`configuration:${'b'.repeat(40)}`, { branding: brand, logoStatus: 'verified', sourceKey: 'test-failure' });
    const rejected = await generateVisuals('b'.repeat(40), 'https://api.example.com');
    assert.equal(rejected.scene, undefined); assert.equal(rejected.cup, undefined); assert.equal(rejected.latte, undefined);
    assert.equal(Object.keys(rejected.errors || {}).length, 3);
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    await rm(data, { recursive: true, force: true });
  }
});
