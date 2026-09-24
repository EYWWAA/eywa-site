import type { NextConfig } from 'next';
const exporting = process.env.EYWA_STATIC_EXPORT === '1';
const config: NextConfig = {
  output: exporting ? 'export' : 'standalone',
  basePath: process.env.EYWA_BASE_PATH || '',
  trailingSlash: exporting,
  images: { unoptimized: true },
  serverExternalPackages: ['sharp', 'node:sqlite'],
  allowedDevOrigins: ['terminal.local'],
  env: { NEXT_PUBLIC_BASE_PATH: process.env.EYWA_BASE_PATH || '', NEXT_PUBLIC_STATIC_EXPORT: exporting ? '1' : '0', NEXT_PUBLIC_SITE_URL: process.env.EYWA_SITE_URL || 'https://eywwaa.github.io/eywa-site/' },
};
export default config;
