import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { combineThemeCss, buildExportArgs } from '../src/export';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-export-'));
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('combineThemeCss', () => {
  it('writes theme.css when no overrides', async () => {
    const themeCss = path.join(tmp, 'theme.css');
    await fs.writeFile(themeCss, '/* @theme x */\n.body { color: blue; }');
    const out = path.join(tmp, '_combined.css');
    await combineThemeCss(themeCss, null, out);
    const result = await fs.readFile(out, 'utf-8');
    expect(result).toContain('color: blue');
  });

  it('appends overrides after theme', async () => {
    const themeCss = path.join(tmp, 'theme.css');
    const overrides = path.join(tmp, 'overrides.css');
    await fs.writeFile(themeCss, '/* @theme x */\n.a { color: red; }');
    await fs.writeFile(overrides, '.a { color: green; }');
    const out = path.join(tmp, '_combined.css');
    await combineThemeCss(themeCss, overrides, out);
    const result = await fs.readFile(out, 'utf-8');
    const redIdx = result.indexOf('color: red');
    const greenIdx = result.indexOf('color: green');
    expect(redIdx).toBeGreaterThanOrEqual(0);
    expect(greenIdx).toBeGreaterThan(redIdx);
  });
});

describe('buildExportArgs', () => {
  it('produces one invocation per requested format', () => {
    const result = buildExportArgs({
      input: 'build/html/prerendered.md',
      themeCss: 'build/.cache/_theme.css',
      outBasename: 'build/deck',
      formats: ['pdf', 'html', 'pptx'],
    });
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual([
      'build/html/prerendered.md',
      '--theme',
      'build/.cache/_theme.css',
      '--pdf',
      '--allow-local-files',
      '-o',
      'build/deck.pdf',
    ]);
    expect(result[1][3]).toBe('--html');
    // HTML output goes into a subfolder so its relative asset paths resolve.
    expect(result[1][6]).toBe(path.join('build', 'html', 'deck.html'));
    expect(result[2][3]).toBe('--pptx');
    expect(result[2][6]).toBe('build/deck.pptx');
  });
});
