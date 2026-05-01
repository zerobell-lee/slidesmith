import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { bootstrapProject } from '../src/new';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;
let pluginDir: string;

async function makeBundledTheme(name: string): Promise<void> {
  const dir = path.join(pluginDir, 'themes', name);
  await fs.ensureDir(path.join(dir, 'samples'));
  await fs.writeFile(
    path.join(dir, 'theme.yaml'),
    `name: ${name}
displayName: ${name}
version: 0.1.0
description: ''
samples:
  default: samples/sample.md
  en: samples/sample.en.md
`,
  );
  await fs.writeFile(path.join(dir, 'theme.css'), `/* @theme ${name} */`);
  await fs.writeFile(path.join(dir, 'samples', 'sample.md'), '# default sample');
  await fs.writeFile(path.join(dir, 'samples', 'sample.en.md'), '# english sample');
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-new-'));
  pluginDir = path.join(tmp, 'plugin');
  await makeBundledTheme('default');
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('bootstrapProject', () => {
  it('creates the standard project structure', async () => {
    const projectPath = path.join(tmp, 'mydeck');
    await bootstrapProject({
      name: 'mydeck',
      targetDir: projectPath,
      themeName: 'default',
      lang: 'ko',
      pluginDir,
      userHome: tmp,
    });
    expect(await fs.pathExists(path.join(projectPath, 'deck.yaml'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'blueprint.md'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'assets', 'diagrams'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'assets', 'charts'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'assets', 'images'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, '.gitignore'))).toBe(true);
  });

  it('seeds blueprint.md as a spec template carrying the project name', async () => {
    const projectPath = path.join(tmp, 'mydeck');
    await bootstrapProject({
      name: 'mydeck',
      targetDir: projectPath,
      themeName: 'default',
      lang: 'en',
      pluginDir,
      userHome: tmp,
    });
    const blueprint = await fs.readFile(path.join(projectPath, 'blueprint.md'), 'utf-8');
    // Spec template, not a Marp file.
    expect(blueprint).toMatch(/^# mydeck — deck spec/m);
    expect(blueprint).toMatch(/spec, not slides/);
    expect(blueprint).toMatch(/## Topic/);
    expect(blueprint).toMatch(/## Key messages/);
    expect(blueprint).not.toMatch(/^marp:\s*true/m);
  });

  it('points the README at the theme sample for style reference', async () => {
    const projectPath = path.join(tmp, 'mydeck');
    await bootstrapProject({
      name: 'mydeck',
      targetDir: projectPath,
      themeName: 'default',
      lang: 'en',
      pluginDir,
      userHome: tmp,
    });
    const readme = await fs.readFile(path.join(projectPath, 'README.md'), 'utf-8');
    expect(readme).toMatch(/Theme: default/);
    expect(readme).toMatch(/sample\.en\.md/);
  });

  it('falls back to default sample reference when lang key missing', async () => {
    const projectPath = path.join(tmp, 'mydeck');
    await bootstrapProject({
      name: 'mydeck',
      targetDir: projectPath,
      themeName: 'default',
      lang: 'jp',
      pluginDir,
      userHome: tmp,
    });
    const readme = await fs.readFile(path.join(projectPath, 'README.md'), 'utf-8');
    expect(readme).toMatch(/sample\.md/);
  });

  it('writes deck.yaml with the requested theme and lang', async () => {
    const projectPath = path.join(tmp, 'mydeck');
    await bootstrapProject({
      name: 'mydeck',
      targetDir: projectPath,
      themeName: 'default',
      lang: 'en',
      pluginDir,
      userHome: tmp,
    });
    const deck = await fs.readFile(path.join(projectPath, 'deck.yaml'), 'utf-8');
    expect(deck).toMatch(/theme:\s*default/);
    expect(deck).toMatch(/language:\s*en/);
  });

  it('refuses to overwrite an existing non-empty directory', async () => {
    const projectPath = path.join(tmp, 'existing');
    await fs.ensureDir(projectPath);
    await fs.writeFile(path.join(projectPath, 'thing.txt'), 'x');
    await expect(
      bootstrapProject({
        name: 'existing',
        targetDir: projectPath,
        themeName: 'default',
        lang: 'ko',
        pluginDir,
        userHome: tmp,
      }),
    ).rejects.toThrow(/non-empty/);
  });

  it('throws when theme not found', async () => {
    await expect(
      bootstrapProject({
        name: 'mydeck',
        targetDir: path.join(tmp, 'mydeck'),
        themeName: 'nonexistent',
        lang: 'ko',
        pluginDir,
        userHome: tmp,
      }),
    ).rejects.toThrow(/theme not found/);
  });
});
