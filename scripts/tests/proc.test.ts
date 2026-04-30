import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invokeBackend, type BackendInvocation } from '../src/lib/proc';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-proc-'));
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('invokeBackend (cli)', () => {
  it('runs cli command and returns stdout', async () => {
    const result = await invokeBackend({
      backend: { type: 'cli', cmd: 'node', args: ['-e', 'console.log("hi")'] },
      input: '',
      env: {},
      cwd: tmp,
    } as BackendInvocation);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.stdout.trim()).toBe('hi');
  });

  it('returns error when cli fails', async () => {
    const result = await invokeBackend({
      backend: { type: 'cli', cmd: 'node', args: ['-e', 'process.exit(1)'] },
      input: '',
      env: {},
      cwd: tmp,
    } as BackendInvocation);
    expect(result.kind).toBe('error');
  });
});

describe('invokeBackend (http)', () => {
  it('returns error placeholder for http (full impl in integration)', async () => {
    // Stubbed test: ensure http branch routes correctly even if upstream fails offline
    const result = await invokeBackend({
      backend: { type: 'http', base: 'http://127.0.0.1:1' },
      input: 'q',
      env: {},
      cwd: tmp,
      httpRequestPath: '/search',
    } as BackendInvocation);
    expect(result.kind).toBe('error');
  });
});

describe('invokeBackend (mcp)', () => {
  it('returns not-implemented for mcp until adapter wired (placeholder)', async () => {
    const result = await invokeBackend({
      backend: { type: 'mcp', server: 'excalidraw' },
      input: 'q',
      env: {},
      cwd: tmp,
    } as BackendInvocation);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toMatch(/mcp/i);
  });
});
