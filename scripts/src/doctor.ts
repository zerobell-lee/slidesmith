import { execa } from 'execa';
import type { ProcessorManifest } from './lib/manifest.ts';
import type { Env } from './lib/env.ts';

export type CheckStatus = 'pass' | 'fail' | 'warn';

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: Check[];
}

export interface DoctorContext {
  processors: ProcessorManifest[];
  env: Env;
  whichBinary: (name: string) => Promise<string | null>;
}

export async function defaultWhich(name: string): Promise<string | null> {
  try {
    const { stdout } = await execa(process.platform === 'win32' ? 'where' : 'which', [name]);
    return stdout.trim().split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

export async function runDoctorChecks(ctx: DoctorContext): Promise<DoctorReport> {
  const checks: Check[] = [];

  const marpPath = await ctx.whichBinary('marp');
  checks.push({
    id: 'binary:marp',
    label: 'marp-cli installed',
    status: marpPath ? 'pass' : 'fail',
    detail: marpPath ?? 'install with: npm i -g @marp-team/marp-cli',
  });

  const seenBinaries = new Set<string>(['marp']);
  for (const proc of ctx.processors) {
    for (const bin of proc.requires?.binaries ?? []) {
      if (seenBinaries.has(bin)) continue;
      seenBinaries.add(bin);
      const found = await ctx.whichBinary(bin);
      checks.push({
        id: `binary:${bin}`,
        label: `${bin} (required by ${proc.name})`,
        status: found ? 'pass' : 'fail',
        detail: found ?? `not found in PATH; required by processor ${proc.name}`,
      });
    }
  }

  const seenEnv = new Set<string>();
  for (const proc of ctx.processors) {
    for (const key of proc.requires?.env ?? []) {
      const id = `env:${key}@${proc.name}`;
      if (seenEnv.has(id)) continue;
      seenEnv.add(id);
      const present = typeof ctx.env[key] === 'string' && ctx.env[key].length > 0;
      checks.push({
        id,
        label: `${key} (required by ${proc.name})`,
        status: present ? 'pass' : 'fail',
        detail: present ? '(redacted)' : `set ${key} in environment or project .env`,
      });
    }
  }

  for (const proc of ctx.processors) {
    if (proc.backend.type === 'mcp') {
      checks.push({
        id: `mcp:${proc.backend.server}@${proc.name}`,
        label: `MCP server "${proc.backend.server}" (required by ${proc.name})`,
        status: 'warn',
        detail: 'MCP availability is determined by Claude Code session at runtime.',
      });
    }
  }

  const ok = checks.every((c) => c.status !== 'fail');
  return { ok, checks };
}
