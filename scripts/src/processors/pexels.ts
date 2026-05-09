import fs from 'node:fs/promises';
import { request } from 'undici';
import type { InternalRunOpts } from '../lib/proc.ts';

const DEFAULT_BASE = 'https://api.pexels.com/v1';

interface PexelsPhoto {
  src?: { large?: string; large2x?: string; original?: string; medium?: string };
}
interface PexelsSearchResponse {
  photos?: PexelsPhoto[];
}

async function readPrompt(opts: InternalRunOpts): Promise<string> {
  if (opts.rawInput && opts.rawInput.trim().length > 0) return opts.rawInput.trim();
  if (opts.inputFile) {
    const content = await fs.readFile(opts.inputFile, 'utf-8');
    return content.trim();
  }
  throw new Error('pexels: provide --input "<query>" or --input-file');
}

export async function run(opts: InternalRunOpts): Promise<void> {
  const apiKey = opts.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error('pexels: PEXELS_API_KEY not set');
  const base = opts.env.PEXELS_BASE_URL ?? DEFAULT_BASE;
  const query = await readPrompt(opts);
  const params = new URLSearchParams({ query, per_page: '1' });
  const searchUrl = `${base}/search?${params.toString()}`;
  const searchRes = await request(searchUrl, {
    method: 'GET',
    headers: { Authorization: apiKey },
  });
  if (searchRes.statusCode >= 400) {
    throw new Error(`pexels: search failed http ${searchRes.statusCode}`);
  }
  const body = (await searchRes.body.json()) as PexelsSearchResponse;
  const photo = body.photos?.[0];
  const photoUrl = photo?.src?.large ?? photo?.src?.large2x ?? photo?.src?.original ?? photo?.src?.medium;
  if (!photoUrl) {
    throw new Error(`pexels: no photo found for query "${query}"`);
  }
  const dlRes = await request(photoUrl, { method: 'GET' });
  if (dlRes.statusCode >= 400) {
    throw new Error(`pexels: download failed http ${dlRes.statusCode}`);
  }
  const buf = Buffer.from(await dlRes.body.arrayBuffer());
  await fs.writeFile(opts.outputFile, buf);
}
