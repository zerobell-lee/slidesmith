import { describe, it, expect } from 'vitest';
import { runDoctorChecks } from '../src/doctor';
import type { ProcessorManifest } from '../src/lib/manifest';

describe('runDoctorChecks', () => {
  it('reports missing env requirements as fail', async () => {
    const procs: ProcessorManifest[] = [
      {
        name: 'pexels',
        provides: ['stock.photo'],
        matches: {},
        backend: { type: 'http', base: 'https://api.pexels.com/v1' },
        requires: { env: ['PEXELS_API_KEY'] },
        priority: 50,
      },
    ];
    const report = await runDoctorChecks({
      processors: procs,
      env: {},
      whichBinary: async () => null,
    });
    const envCheck = report.checks.find((c) => c.id.startsWith('env:PEXELS_API_KEY'));
    expect(envCheck?.status).toBe('fail');
  });

  it('reports present env as pass', async () => {
    const procs: ProcessorManifest[] = [
      {
        name: 'pexels',
        provides: ['stock.photo'],
        matches: {},
        backend: { type: 'http', base: 'https://api.pexels.com/v1' },
        requires: { env: ['PEXELS_API_KEY'] },
        priority: 50,
      },
    ];
    const report = await runDoctorChecks({
      processors: procs,
      env: { PEXELS_API_KEY: 'set' },
      whichBinary: async () => null,
    });
    const envCheck = report.checks.find((c) => c.id.startsWith('env:PEXELS_API_KEY'));
    expect(envCheck?.status).toBe('pass');
  });

  it('reports missing binaries as fail', async () => {
    const procs: ProcessorManifest[] = [
      {
        name: 'mermaid-cli',
        provides: ['diagram.mermaid'],
        matches: {},
        backend: { type: 'cli', cmd: 'mmdc' },
        requires: { binaries: ['mmdc'] },
        priority: 50,
      },
    ];
    const report = await runDoctorChecks({
      processors: procs,
      env: {},
      whichBinary: async () => null,
    });
    const check = report.checks.find((c) => c.id === 'binary:mmdc');
    expect(check?.status).toBe('fail');
  });

  it('always checks marp-cli presence', async () => {
    const report = await runDoctorChecks({
      processors: [],
      env: {},
      whichBinary: async (name) => (name === 'marp' ? '/usr/local/bin/marp' : null),
    });
    const check = report.checks.find((c) => c.id === 'binary:marp');
    expect(check?.status).toBe('pass');
  });

  it('aggregates ok=true only when all critical checks pass', async () => {
    const okReport = await runDoctorChecks({
      processors: [],
      env: {},
      whichBinary: async () => '/usr/local/bin/marp',
    });
    expect(okReport.ok).toBe(true);
    const failReport = await runDoctorChecks({
      processors: [],
      env: {},
      whichBinary: async () => null,
    });
    expect(failReport.ok).toBe(false);
  });
});
