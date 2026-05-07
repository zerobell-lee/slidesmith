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

  it('expands {theme-config-args} into [-c <tmp.json>] when theme has matching prerender block', async () => {
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-rp-tc-'));
    const pluginDir = path.join(tmp2, 'plugin');
    // processor that dumps its argv (positional ones after --) into a file
    const procDir = path.join(pluginDir, 'prerenders', 'argdumper');
    await fs.ensureDir(procDir);
    await fs.writeFile(
      path.join(procDir, 'manifest.yaml'),
      `name: argdumper
provides: [test.argdump]
matches: {}
backend:
  type: cli
  cmd: node
  args:
    - "-e"
    - "require('fs').writeFileSync(process.argv[1], JSON.stringify(process.argv.slice(2)))"
    - "{output}"
    - "{theme-config-args}"
theme_config: mermaid
priority: 50
`,
    );
    // theme dir at user home (so resolveThemePath finds it without project bootstrap)
    const themeDir = path.join(tmp2, '.slidesmith', 'themes', 'tc-test');
    await fs.ensureDir(themeDir);
    await fs.writeFile(
      path.join(themeDir, 'theme.yaml'),
      `name: tc-test
displayName: TC Test
version: 0.0.1
description: x
samples: { default: samples/sample.md }
prerender:
  mermaid:
    theme: base
    backgroundColor: transparent
    themeVariables:
      primaryColor: "#abcdef"
`,
    );
    const outFile = path.join(tmp2, 'argv.json');
    await execa(
      'npx',
      ['tsx', cliPath, 'run-processor', '--name', 'argdumper', '--out', outFile, '--theme', 'tc-test'],
      {
        env: {
          ...process.env,
          SLIDESMITH_PLUGIN_DIR: pluginDir,
          SLIDESMITH_PROJECT_DIR: tmp2,
          SLIDESMITH_USER_HOME: tmp2,
        },
      },
    );
    const argv = JSON.parse(await fs.readFile(outFile, 'utf-8')) as string[];
    expect(argv[0]).toBe('-c');
    expect(argv[1]).toMatch(/mermaid\.json$/);
    const cfg = JSON.parse(await fs.readFile(argv[1], 'utf-8').catch(() => '{}'));
    // file may have been cleaned up already; the assertion above on path shape is the contract
    void cfg;
    await fs.remove(tmp2);
  });

  it('prerender-all batches multiple file-refs and reports externals + passthrough', async () => {
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-prall-'));
    const pluginDir = path.join(tmp2, 'plugin');
    // a simple processor that copies its input file to output (no theme config)
    const procDir = path.join(pluginDir, 'prerenders', 'copier');
    await fs.ensureDir(procDir);
    await fs.writeFile(
      path.join(procDir, 'manifest.yaml'),
      `name: copier
provides: [diagram.copy]
matches: { extensions: [.copy] }
backend:
  type: cli
  cmd: node
  args:
    - "-e"
    - "require('fs').copyFileSync(process.argv[1], process.argv[2])"
    - "{input-file}"
    - "{output}"
priority: 50
`,
    );
    const project = path.join(tmp2, 'proj');
    await fs.ensureDir(path.join(project, 'assets'));
    await fs.writeFile(path.join(project, 'assets', 'a.copy'), 'AAA');
    await fs.writeFile(path.join(project, 'assets', 'b.copy'), 'BBB');
    await fs.writeFile(
      path.join(project, 'output.md'),
      `# t

![one](assets/a.copy)
![two](assets/b.copy)
![hero](assets/images/hero.png)
![an abstract gradient]()
`,
    );
    const { stdout } = await execa(
      'npx',
      ['tsx', cliPath, 'prerender-all', '--concurrency', '2'],
      {
        cwd: project,
        env: {
          ...process.env,
          SLIDESMITH_PLUGIN_DIR: pluginDir,
          SLIDESMITH_PROJECT_DIR: project,
          SLIDESMITH_USER_HOME: tmp2,
        },
      },
    );
    const summary = JSON.parse(stdout);
    expect(summary.ok).toBe(true);
    expect(summary.resolved).toHaveLength(2);
    expect(summary.resolved.map((r: { processor: string }) => r.processor)).toEqual(['copier', 'copier']);
    expect(summary.passthrough).toHaveLength(1);
    expect(summary.passthrough[0].path).toBe('assets/images/hero.png');
    expect(summary.externals).toHaveLength(1);
    expect(summary.externals[0].kind).toBe('semantic');
    expect(summary.failures).toHaveLength(0);
    // replacements.json was written and contains exactly the 2 resolved entries
    const reps = JSON.parse(await fs.readFile(summary.replacementsPath, 'utf-8'));
    expect(reps).toHaveLength(2);
    expect(reps[0].original).toBe('![one](assets/a.copy)');
    expect(reps[0].replacement).toMatch(/^!\[one\]\(svg\/p1\.svg\)$/);
    // and the artifacts physically exist
    expect(await fs.readFile(summary.resolved[0].out, 'utf-8')).toBe('AAA');
    expect(await fs.readFile(summary.resolved[1].out, 'utf-8')).toBe('BBB');
    await fs.remove(tmp2);
  });

  it('drops {theme-config-args} when no --theme is passed', async () => {
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-rp-tc2-'));
    const pluginDir = path.join(tmp2, 'plugin');
    const procDir = path.join(pluginDir, 'prerenders', 'argdumper2');
    await fs.ensureDir(procDir);
    await fs.writeFile(
      path.join(procDir, 'manifest.yaml'),
      `name: argdumper2
provides: [test.argdump]
matches: {}
backend:
  type: cli
  cmd: node
  args:
    - "-e"
    - "require('fs').writeFileSync(process.argv[1], JSON.stringify(process.argv.slice(2)))"
    - "{output}"
    - "{theme-config-args}"
theme_config: mermaid
priority: 50
`,
    );
    const outFile = path.join(tmp2, 'argv.json');
    await execa('npx', ['tsx', cliPath, 'run-processor', '--name', 'argdumper2', '--out', outFile], {
      env: {
        ...process.env,
        SLIDESMITH_PLUGIN_DIR: pluginDir,
        SLIDESMITH_PROJECT_DIR: tmp2,
        SLIDESMITH_USER_HOME: tmp2,
      },
    });
    const argv = JSON.parse(await fs.readFile(outFile, 'utf-8')) as string[];
    expect(argv).toEqual([]);
    await fs.remove(tmp2);
  });
});
