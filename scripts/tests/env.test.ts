import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEnv } from '../src/lib/env';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-env-'));
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('loadEnv', () => {
  it('reads from process env when no .env present', () => {
    const result = loadEnv(tmp, { FOO: 'bar' });
    expect(result.FOO).toBe('bar');
  });

  it('overrides process env with project .env', () => {
    fs.writeFileSync(path.join(tmp, '.env'), 'FOO=from-dotenv\n');
    const result = loadEnv(tmp, { FOO: 'from-process' });
    expect(result.FOO).toBe('from-dotenv');
  });

  it('merges keys from both sources', () => {
    fs.writeFileSync(path.join(tmp, '.env'), 'A=1\nB=2\n');
    const result = loadEnv(tmp, { C: '3' });
    expect(result).toEqual({ A: '1', B: '2', C: '3' });
  });

  it('ignores comment and empty lines', () => {
    fs.writeFileSync(path.join(tmp, '.env'), '# comment\n\nA=1\n');
    const result = loadEnv(tmp, {});
    expect(result).toEqual({ A: '1' });
  });

  it('strips surrounding quotes', () => {
    fs.writeFileSync(path.join(tmp, '.env'), 'A="quoted"\nB=\'single\'\n');
    const result = loadEnv(tmp, {});
    expect(result.A).toBe('quoted');
    expect(result.B).toBe('single');
  });
});
