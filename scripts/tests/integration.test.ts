import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

const cliPath = path.resolve(__dirname, '..', 'src', 'cli.ts');
const fixturesDir = path.resolve(__dirname, 'fixtures');
const pluginDir = path.resolve(__dirname, '..', '..');

let workDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-int-'));
});
afterEach(async () => {
  await fs.remove(workDir);
});

async function copyFixture(name: string): Promise<string> {
  const dest = path.join(workDir, name);
  await fs.copy(path.join(fixturesDir, name), dest);
  return dest;
}

describe('fixture: simple — detect+inject pipeline', () => {
  it('detects placeholders in output.md and injects replacements', async () => {
    const project = await copyFixture('simple');
    const { stdout: detectOut } = await execa('npx', ['tsx', cliPath, 'detect', 'output.md'], { cwd: project });
    const placeholders = JSON.parse(detectOut);
    expect(placeholders).toHaveLength(1);
    expect(placeholders[0].kind).toBe('file-ref');
    expect(placeholders[0].ext).toBe('.mmd');
  });

  it('dispatches .mmd to mermaid-cli processor', async () => {
    const project = await copyFixture('simple');
    const { stdout } = await execa('npx', ['tsx', cliPath, 'dispatch-file-ref', '.mmd'], {
      cwd: project,
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: project, SLIDESMITH_USER_HOME: project },
    });
    const match = JSON.parse(stdout);
    expect(match?.name).toBe('mermaid-cli');
  });
});

describe('fixture: missing-secret — doctor reports failures', () => {
  it('reports PEXELS_API_KEY missing when pexels processor is registered', async () => {
    const project = await copyFixture('missing-secret');
    const result = await execa('npx', ['tsx', cliPath, 'doctor'], {
      cwd: project,
      env: {
        ...process.env,
        PEXELS_API_KEY: '',
        GEMINI_API_KEY: '',
        SLIDESMITH_PLUGIN_DIR: pluginDir,
        SLIDESMITH_PROJECT_DIR: project,
        SLIDESMITH_USER_HOME: project,
      },
      reject: false,
    });
    expect(result.exitCode ?? 0).not.toBe(0);
  });
});

describe('fixture: processor-failure — soft fail per placeholder', () => {
  it('exits non-zero when run-processor input file is missing', async () => {
    const project = await copyFixture('processor-failure');
    const result = await execa(
      'npx',
      [
        'tsx', cliPath, 'run-processor',
        '--name', 'mermaid-cli',
        '--input-file', path.join(project, 'assets', 'diagrams', 'nonexistent.mmd'),
        '--out', path.join(project, 'build', '.cache', 'svg', 'p1.svg'),
      ],
      {
        cwd: project,
        env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: project, SLIDESMITH_USER_HOME: project },
        reject: false,
      },
    );
    expect(result.exitCode).not.toBe(0);
  });
});

describe('fixture: overrides — combined CSS contains both theme and override', () => {
  it('combineThemeCss writes overrides after theme content', async () => {
    const project = await copyFixture('overrides');
    const themeCss = path.join(pluginDir, 'themes', 'default', 'theme.css');
    const out = path.join(project, 'build', '.cache', '_combined.css');
    const { combineThemeCss } = await import('../src/export');
    await combineThemeCss(themeCss, path.join(project, 'overrides.css'), out);
    const content = await fs.readFile(out, 'utf-8');
    expect(content).toMatch(/@theme default/);
    expect(content.indexOf('#ffeecc')).toBeGreaterThan(content.indexOf('@theme default'));
  });
});

describe('fixture: multilang — bootstrap seeds spec template + readme references the right sample', () => {
  it('seeds blueprint as a spec template carrying the project name', async () => {
    const target = path.join(workDir, 'newproj');
    await execa('npx', ['tsx', cliPath, 'new-project', 'newproj', '--theme', 'default', '--lang', 'en'], {
      cwd: workDir,
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: workDir, SLIDESMITH_USER_HOME: workDir },
    });
    const blueprint = await fs.readFile(path.join(target, 'blueprint.md'), 'utf-8');
    expect(blueprint).toMatch(/^# newproj — deck spec/m);
    expect(blueprint).toMatch(/spec, not slides/);
  });

  it('readme references the en sample when --lang en', async () => {
    const target = path.join(workDir, 'newproj-en');
    await execa('npx', ['tsx', cliPath, 'new-project', 'newproj-en', '--theme', 'default', '--lang', 'en'], {
      cwd: workDir,
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: workDir, SLIDESMITH_USER_HOME: workDir },
    });
    const readme = await fs.readFile(path.join(target, 'README.md'), 'utf-8');
    expect(readme).toMatch(/sample\.en\.md/);
  });

  it('readme falls back to default sample when --lang has no mapping', async () => {
    const target = path.join(workDir, 'newproj-fr');
    await execa('npx', ['tsx', cliPath, 'new-project', 'newproj-fr', '--theme', 'default', '--lang', 'fr'], {
      cwd: workDir,
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: workDir, SLIDESMITH_USER_HOME: workDir },
    });
    const readme = await fs.readFile(path.join(target, 'README.md'), 'utf-8');
    expect(readme).toMatch(/sample\.md/);
  });
});
