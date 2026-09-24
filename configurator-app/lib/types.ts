import { z } from 'zod';
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const bounded = z.string().max(1600);
export const BrandingSchema = z.object({
  brand: z.object({ name: z.string().min(1).max(100), domain: z.string().max(250), positioning: bounded, visual_style: bounded, primary_colors: z.array(hex).min(1).max(5), secondary_colors: z.array(hex).max(5), keywords: z.array(z.string().max(80)).max(10), environment: bounded }),
  bar: z.object({ front_color: hex, side_color: hex, logo: z.string().max(2000), logo_color: hex, accent_color: hex, accent_elements: z.array(z.enum(['line', 'edge', 'diagonal', 'none'])).max(3), lighting: z.enum(['warm', 'neutral', 'none']), finish: z.enum(['matte', 'satin']) }),
  scene: z.object({ location_type: bounded, lighting: bounded, atmosphere: bounded, image_prompt: bounded }),
  rationale: bounded,
  sources: z.array(z.object({ title: z.string().max(200), url: z.string().url().max(2000) })).max(12),
});
export type Branding = z.infer<typeof BrandingSchema>;
export type Candidate = { name: string; domain: string; description: string };
export type Analysis = { status: 'ready'; id: string; branding: Branding; cached: boolean; mode: 'live' | 'example' | 'public' | 'proposal'; logoStatus: 'verified' | 'sourced' | 'wordmark'; modelUrl: string; modelApproved: boolean; imagesReady: boolean } | { status: 'ambiguous'; candidates: Candidate[] } | { status: 'not_found'; message: string };
export type Visuals = { scene?: string; cup?: string; latte?: string; errors?: Record<string, string>; provenance?: 'curated' | 'openai'; directorModel?: string; imageModel?: string };
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const asset = (p: string) => `${BASE_PATH}${p}`;
export const normalizeBrand = (s: string) => s.normalize('NFKC').trim().toLocaleLowerCase('fr').replace(/\s+/g, ' ');
