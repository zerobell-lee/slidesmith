import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { run as runPexels } from '../src/processors/pexels';
import { run as runGemini } from '../src/processors/gemini-image';

interface RecordedRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

interface RouteHandler {
  (req: IncomingMessage, res: ServerResponse, body: string): void;
}

async function startServer(routes: Record<string, RouteHandler>, recorded: RecordedRequest[]): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8');
      recorded.push({ method: req.method, url: req.url, headers: req.headers, body });
      const key = `${req.method} ${(req.url ?? '').split('?')[0]}`;
      const handler = routes[key];
      if (!handler) {
        res.writeHead(404).end('not found');
        return;
      }
      handler(req, res, body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

let tmp: string;
let recorded: RecordedRequest[];

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-procnet-'));
  recorded = [];
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('pexels processor', () => {
  it('searches with query, downloads photo, writes JPG', async () => {
    const jpgBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]); // JPEG magic
    const photoUrlPath = '/photo/large.jpg';
    const server = await startServer(
      {
        'GET /search': (_req, res) => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ photos: [{ src: { large: '__BASE__' + photoUrlPath } }] }).replace('__BASE__', currentBase));
        },
        [`GET ${photoUrlPath}`]: (_req, res) => {
          res.writeHead(200, { 'content-type': 'image/jpeg' });
          res.end(jpgBytes);
        },
      },
      recorded,
    );
    const currentBase = server.url;
    try {
      const out = path.join(tmp, 'photo.jpg');
      await runPexels({
        rawInput: 'misty forest',
        outputFile: out,
        env: { PEXELS_API_KEY: 'test-key', PEXELS_BASE_URL: currentBase },
      });
      const written = await fs.readFile(out);
      expect(written.equals(jpgBytes)).toBe(true);
      const search = recorded.find((r) => r.url?.startsWith('/search'));
      expect(search?.url).toContain('query=misty+forest');
      expect(search?.headers.authorization).toBe('test-key');
    } finally {
      await server.close();
    }
  });

  it('throws when no photo found', async () => {
    const server = await startServer(
      {
        'GET /search': (_req, res) => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ photos: [] }));
        },
      },
      recorded,
    );
    try {
      await expect(
        runPexels({
          rawInput: 'nothing matches',
          outputFile: path.join(tmp, 'p.jpg'),
          env: { PEXELS_API_KEY: 'k', PEXELS_BASE_URL: server.url },
        }),
      ).rejects.toThrow(/no photo/i);
    } finally {
      await server.close();
    }
  });

  it('throws when PEXELS_API_KEY missing', async () => {
    await expect(
      runPexels({ rawInput: 'x', outputFile: path.join(tmp, 'p.jpg'), env: {} }),
    ).rejects.toThrow(/PEXELS_API_KEY/);
  });
});

describe('gemini-image processor', () => {
  it('POSTs prompt, decodes inlineData base64, writes PNG', async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG magic
    const b64 = pngBytes.toString('base64');
    const server = await startServer(
      {
        'POST /models/gemini-2.5-flash-image:generateContent': (_req, res, body) => {
          // round-trip to verify we sent the prompt
          const parsed = JSON.parse(body);
          expect(parsed.contents[0].parts[0].text).toBe('cinematic forest');
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: b64 } }] } }],
          }));
        },
      },
      recorded,
    );
    try {
      const out = path.join(tmp, 'gen.png');
      await runGemini({
        rawInput: 'cinematic forest',
        outputFile: out,
        env: { GEMINI_API_KEY: 'g-key', GEMINI_BASE_URL: server.url },
      });
      const written = await fs.readFile(out);
      expect(written.equals(pngBytes)).toBe(true);
      const r = recorded[0];
      expect(r.headers['x-goog-api-key']).toBe('g-key');
    } finally {
      await server.close();
    }
  });

  it('honors GEMINI_IMAGE_MODEL override', async () => {
    const server = await startServer(
      {
        'POST /models/imagen-test:generateContent': (_req, res) => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({
            candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('x').toString('base64') } }] } }],
          }));
        },
      },
      recorded,
    );
    try {
      await runGemini({
        rawInput: 'p',
        outputFile: path.join(tmp, 'g.png'),
        env: { GEMINI_API_KEY: 'k', GEMINI_BASE_URL: server.url, GEMINI_IMAGE_MODEL: 'imagen-test' },
      });
      expect(recorded[0].url).toContain('/models/imagen-test:generateContent');
    } finally {
      await server.close();
    }
  });

  it('throws when response has no inlineData', async () => {
    const server = await startServer(
      {
        'POST /models/gemini-2.5-flash-image:generateContent': (_req, res) => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'just text' }] } }] }));
        },
      },
      recorded,
    );
    try {
      await expect(
        runGemini({ rawInput: 'p', outputFile: path.join(tmp, 'g.png'), env: { GEMINI_API_KEY: 'k', GEMINI_BASE_URL: server.url } }),
      ).rejects.toThrow(/inlineData/);
    } finally {
      await server.close();
    }
  });

  it('throws when GEMINI_API_KEY missing', async () => {
    await expect(
      runGemini({ rawInput: 'x', outputFile: path.join(tmp, 'g.png'), env: {} }),
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });
});
