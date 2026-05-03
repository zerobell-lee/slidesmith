import { execa } from 'execa';
import { request } from 'undici';
import type { ProcessorManifest } from './manifest';
import type { Env } from './env';

type Backend = ProcessorManifest['backend'];

export interface BackendInvocation {
  backend: Backend;
  input: string;
  env: Env;
  cwd: string;
  pluginDir?: string;
  inputFile?: string;
  outputFile?: string;
  httpRequestPath?: string;
  httpMethod?: 'GET' | 'POST';
  httpHeaders?: Record<string, string>;
}

export type BackendResult =
  | { kind: 'ok'; stdout: string; bytes?: Buffer }
  | { kind: 'error'; message: string };

export async function invokeBackend(invocation: BackendInvocation): Promise<BackendResult> {
  const { backend } = invocation;
  switch (backend.type) {
    case 'cli':
      return runCli(invocation, backend);
    case 'http':
      return runHttp(invocation, backend);
    case 'mcp':
      return {
        kind: 'error',
        message: 'mcp backend not yet wired in this adapter; orchestrate via Claude Code MCP tools.',
      };
    case 'internal':
      return runInternal(invocation, backend);
  }
}

async function runInternal(
  inv: BackendInvocation,
  backend: Extract<Backend, { type: 'internal' }>,
): Promise<BackendResult> {
  if (!inv.pluginDir) {
    return { kind: 'error', message: 'internal backend requires pluginDir' };
  }
  if (!inv.inputFile || !inv.outputFile) {
    return { kind: 'error', message: 'internal backend requires inputFile and outputFile' };
  }
  try {
    const path = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const moduleFile = path.join(inv.pluginDir, 'scripts', 'src', 'processors', `${backend.module}.ts`);
    const mod = (await import(pathToFileURL(moduleFile).href)) as {
      run: (input: string, output: string, env: Env) => Promise<void>;
    };
    await mod.run(inv.inputFile, inv.outputFile, inv.env);
    return { kind: 'ok', stdout: '' };
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runCli(
  inv: BackendInvocation,
  backend: Extract<Backend, { type: 'cli' }>,
): Promise<BackendResult> {
  try {
    const { stdout } = await execa(backend.cmd, backend.args ?? [], {
      cwd: inv.cwd,
      env: inv.env,
      input: inv.input || undefined,
      reject: true,
    });
    return { kind: 'ok', stdout };
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runHttp(
  inv: BackendInvocation,
  backend: Extract<Backend, { type: 'http' }>,
): Promise<BackendResult> {
  try {
    const url = backend.base + (inv.httpRequestPath ?? '');
    const headers: Record<string, string> = { ...(inv.httpHeaders ?? {}) };
    if (backend.auth) {
      const expanded = expandEnvRefs(backend.auth, inv.env);
      const m = /^header:([^:]+):(.+)$/.exec(expanded);
      if (m) headers[m[1]] = m[2];
    }
    const res = await request(url, {
      method: inv.httpMethod ?? 'GET',
      headers,
      body: inv.httpMethod === 'POST' ? inv.input : undefined,
    });
    if (res.statusCode >= 400) {
      return { kind: 'error', message: `http ${res.statusCode}` };
    }
    const buf = Buffer.from(await res.body.arrayBuffer());
    return { kind: 'ok', stdout: buf.toString('utf-8'), bytes: buf };
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function expandEnvRefs(template: string, env: Env): string {
  return template.replace(/\{env\.([A-Z0-9_]+)\}/g, (_, key) => env[key] ?? '');
}
