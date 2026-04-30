import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadProcessors, matchFileRef, listCapabilities } from '../src/dispatch';
import type { ProcessorManifest } from '../src/lib/manifest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-disp-'));
  await fs.ensureDir(path.join(tmp, 'mermaid-cli'));
  fs.writeFileSync(
    path.join(tmp, 'mermaid-cli', 'manifest.yaml'),
    `name: mermaid-cli
provides: [diagram.mermaid]
matches:
  extensions: [.mmd, .mermaid]
backend: { type: cli, cmd: mmdc }
priority: 50
`,
  );
  await fs.ensureDir(path.join(tmp, 'pexels'));
  fs.writeFileSync(
    path.join(tmp, 'pexels', 'manifest.yaml'),
    `name: pexels
provides: [stock.photo]
matches: {}
backend: { type: http, base: https://api.pexels.com/v1 }
requires: { env: [PEXELS_API_KEY] }
priority: 60
`,
  );
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('loadProcessors', () => {
  it('loads all manifests in a directory', () => {
    const result = loadProcessors([tmp]);
    expect(result).toHaveLength(2);
    const names = result.map((m) => m.name).sort();
    expect(names).toEqual(['mermaid-cli', 'pexels']);
  });

  it('returns empty array for missing directory', () => {
    expect(loadProcessors([path.join(tmp, 'nonexistent')])).toEqual([]);
  });
});

describe('matchFileRef', () => {
  const procs: ProcessorManifest[] = [
    {
      name: 'mermaid-cli',
      provides: ['diagram.mermaid'],
      matches: { extensions: ['.mmd', '.mermaid'] },
      backend: { type: 'cli', cmd: 'mmdc' },
      priority: 50,
    },
    {
      name: 'mermaid-other',
      provides: ['diagram.mermaid'],
      matches: { extensions: ['.mmd'] },
      backend: { type: 'cli', cmd: 'other' },
      priority: 30,
    },
  ];

  it('returns highest priority match for an extension', () => {
    const result = matchFileRef('.mmd', procs);
    expect(result?.name).toBe('mermaid-cli');
  });

  it('returns null when no processor matches extension', () => {
    expect(matchFileRef('.xyz', procs)).toBeNull();
  });

  it('honors user preference override over priority', () => {
    const result = matchFileRef('.mmd', procs, {
      preferred: { 'diagram.mermaid': 'mermaid-other' },
    });
    expect(result?.name).toBe('mermaid-other');
  });
});

describe('listCapabilities', () => {
  it('returns unique capability names with provider counts', () => {
    const result = listCapabilities([
      { name: 'a', provides: ['stock.photo'], matches: {}, backend: { type: 'cli', cmd: 'a' }, priority: 50 },
      { name: 'b', provides: ['stock.photo'], matches: {}, backend: { type: 'cli', cmd: 'b' }, priority: 60 },
      { name: 'c', provides: ['diagram.mermaid'], matches: {}, backend: { type: 'cli', cmd: 'c' }, priority: 50 },
    ]);
    expect(result.find((c) => c.capability === 'stock.photo')?.providers).toEqual(['b', 'a']);
    expect(result.find((c) => c.capability === 'diagram.mermaid')?.providers).toEqual(['c']);
  });
});
