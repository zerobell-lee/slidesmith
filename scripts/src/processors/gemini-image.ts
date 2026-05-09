import fs from 'node:fs/promises';
import { request } from 'undici';
import type { InternalRunOpts } from '../lib/proc.ts';

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash-image';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data: string };
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { message?: string; code?: number };
}

async function readPrompt(opts: InternalRunOpts): Promise<string> {
  if (opts.rawInput && opts.rawInput.trim().length > 0) return opts.rawInput.trim();
  if (opts.inputFile) {
    const content = await fs.readFile(opts.inputFile, 'utf-8');
    return content.trim();
  }
  throw new Error('gemini-image: provide --input "<prompt>" or --input-file');
}

export async function run(opts: InternalRunOpts): Promise<void> {
  const apiKey = opts.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('gemini-image: GEMINI_API_KEY not set');
  const model = opts.env.GEMINI_IMAGE_MODEL ?? DEFAULT_MODEL;
  const base = opts.env.GEMINI_BASE_URL ?? DEFAULT_BASE;
  const prompt = await readPrompt(opts);
  const url = `${base}/models/${model}:generateContent`;
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
  });
  const res = await request(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: payload,
  });
  if (res.statusCode >= 400) {
    const errBody = await res.body.text().catch(() => '');
    throw new Error(`gemini-image: http ${res.statusCode} ${errBody.slice(0, 200)}`);
  }
  const body = (await res.body.json()) as GeminiResponse;
  if (body.error) {
    throw new Error(`gemini-image: ${body.error.message ?? 'unknown error'}`);
  }
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart || !imagePart.inlineData) {
    throw new Error('gemini-image: response had no inlineData image');
  }
  const buf = Buffer.from(imagePart.inlineData.data, 'base64');
  await fs.writeFile(opts.outputFile, buf);
}
