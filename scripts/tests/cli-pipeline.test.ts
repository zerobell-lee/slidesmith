import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;
const cliPath = path.resolve(__dirname, '..', 'src', 'cli.ts');

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-pipeline-'));
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('cli detect', () => {
  it('returns placeholders as JSON for a given output.md', async () => {
    const project = path.join(tmp, 'project');
    await fs.ensureDir(project);
    await fs.writeFile(
      path.join(project, 'output.md'),
      '# Title\n\n![hero](assets/images/h.png)\n![flow](assets/diagrams/f.mmd)\n![desc]()\n',
    );
    const { stdout } = await execa('npx', ['tsx', cliPath, 'detect', 'output.md'], {
      cwd: project,
    });
    const arr = JSON.parse(stdout);
    expect(arr).toHaveLength(3);
    expect(arr.map((p: { kind: string }) => p.kind)).toEqual(['image', 'file-ref', 'semantic']);
  });
});

describe('cli dispatch-file-ref', () => {
  it('returns matching processor name for an extension', async () => {
    const pluginDir = path.join(tmp, 'plugin');
    const procDir = path.join(pluginDir, 'prerenders', 'mermaid-cli');
    await fs.ensureDir(procDir);
    await fs.writeFile(
      path.join(procDir, 'manifest.yaml'),
      `name: mermaid-cli
provides: [diagram.mermaid]
matches: { extensions: [.mmd] }
backend: { type: cli, cmd: mmdc }
`,
    );
    const { stdout } = await execa('npx', ['tsx', cliPath, 'dispatch-file-ref', '.mmd'], {
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: tmp, SLIDESMITH_USER_HOME: tmp },
    });
    expect(JSON.parse(stdout).name).toBe('mermaid-cli');
  });

  it('returns null when no match and exits 0', async () => {
    const pluginDir = path.join(tmp, 'plugin');
    await fs.ensureDir(path.join(pluginDir, 'prerenders'));
    const { stdout } = await execa('npx', ['tsx', cliPath, 'dispatch-file-ref', '.xyz'], {
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: tmp, SLIDESMITH_USER_HOME: tmp },
    });
    expect(JSON.parse(stdout)).toBeNull();
  });
});

describe('cli inject', () => {
  it('writes prerendered.md with substitutions applied', async () => {
    const project = path.join(tmp, 'project');
    await fs.ensureDir(path.join(project, 'build', '.cache'));
    await fs.writeFile(path.join(project, 'output.md'), '![a]() ![b]()\n');
    const replacements = [
      { id: 'p1', original: '![a]()', replacement: '![a](r1.png)' },
      { id: 'p2', original: '![b]()', replacement: '![b](r2.png)' },
    ];
    await fs.writeFile(path.join(tmp, 'r.json'), JSON.stringify(replacements));
    await execa('npx', ['tsx', cliPath, 'inject', 'output.md', '--replacements', path.join(tmp, 'r.json'), '--out', 'build/.cache/prerendered.md'], { cwd: project });
    const result = await fs.readFile(path.join(project, 'build', '.cache', 'prerendered.md'), 'utf-8');
    expect(result).toBe('![a](r1.png) ![b](r2.png)\n');
  });
});

describe('cli run-processor (cli backend with token args)', () => {
  it('substitutes {output} token in args', async () => {
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-rp-'));
    const pluginDir = path.join(tmp2, 'plugin');
    const procDir = path.join(pluginDir, 'prerenders', 'echoer');
    await fs.ensureDir(procDir);
    await fs.writeFile(
      path.join(procDir, 'manifest.yaml'),
      `name: echoer
provides: [test.echo]
matches: {}
backend:
  type: cli
  cmd: node
  args: ["-e", "require('fs').writeFileSync(process.argv[1], 'hello')", "{output}"]
priority: 50
`,
    );
    const outFile = path.join(tmp2, 'out.txt');
    await execa('npx', ['tsx', cliPath, 'run-processor', '--name', 'echoer', '--out', outFile], {
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: tmp2, SLIDESMITH_USER_HOME: tmp2 },
    });
    const content = await fs.readFile(outFile, 'utf-8');
    expect(content).toBe('hello');
    await fs.remove(tmp2);
  });
});
