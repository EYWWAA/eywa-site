import { access, mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const exists = async path => { try { await access(path); return true; } catch { return false; } };
const httpsOrigin = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && u.pathname === '/'; } catch { return false; } };
const data = resolve(process.env.EYWA_DATA_DIR || 'data');
const checks = {
  nodeCompatible: Number(process.versions.node.split('.')[0]) >= 24,
  openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
  privateBarReferencePresent: Boolean(process.env.EYWA_BAR_REFERENCE_FILE) && await exists(resolve(process.env.EYWA_BAR_REFERENCE_FILE)),
  photoReferencesPresent: (await Promise.all(['scene', 'cup', 'latte'].map(name => exists(join('public/editorial/celio', `${name}-v1.webp`))))).every(Boolean),
  publicApiOriginConfigured: httpsOrigin(process.env.EYWA_PUBLIC_API_ORIGIN),
  adminTokenConfigured: (process.env.EYWA_ADMIN_TOKEN || '').length >= 32,
  persistentRuntimeCompatible: !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME,
  dataWritable: false,
};
const probe = join(data, `.preflight-${randomUUID()}`);
try { await mkdir(data, { recursive: true, mode: 0o700 }); await writeFile(probe, '', { mode: 0o600 }); checks.dataWritable = true; } finally { await unlink(probe).catch(() => {}); }
const ready = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ready, checks, note: 'No credential values are printed. A writable directory does not prove that a host preserves it across restarts. Verify the persistent volume and make one real API test before enabling live generation.' }, null, 2));
process.exitCode = ready ? 0 : 1;
