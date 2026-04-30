import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listThemes, removeTheme } from '../src/theme';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;
let pluginDir: string;
let projectDir: string;
let userHome: string;

async function makeTheme(root: string, name: string): Promise<void> {
  await fs.ensureDir(path.join(root, name));
  await fs.writeFile(
    path.join(root, name, 'theme.yaml'),
    `name: ${name}
displayName: ${name}
version: 0.1.0
description: ''
samples: { default: samples/sample.md }
`,
  );
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-theme-'));
  pluginDir = path.join(tmp, 'plugin');
  projectDir = path.join(tmp, 'project');
  userHome = path.join(tmp, 'home');
  await fs.ensureDir(path.join(pluginDir, 'themes'));
  await fs.ensureDir(path.join(projectDir, '.slidesmith', 'themes'));
  await fs.ensureDir(path.join(userHome, '.slidesmith', 'themes'));
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('listThemes', () => {
  it('returns themes from all sources with metadata', async () => {
    await makeTheme(path.join(pluginDir, 'themes'), 'default');
    await makeTheme(path.join(userHome, '.slidesmith', 'themes'), 'custom');
    const result = await listThemes({ projectDir, userHome, pluginDir });
    expect(result.map((t) => t.name).sort()).toEqual(['custom', 'default']);
  });
});

describe('removeTheme', () => {
  it('removes a user-global theme', async () => {
    await makeTheme(path.join(userHome, '.slidesmith', 'themes'), 'custom');
    await removeTheme('custom', { projectDir, userHome, pluginDir });
    expect(await fs.pathExists(path.join(userHome, '.slidesmith', 'themes', 'custom'))).toBe(false);
  });

  it('refuses to remove a bundled theme', async () => {
    await makeTheme(path.join(pluginDir, 'themes'), 'default');
    await expect(
      removeTheme('default', { projectDir, userHome, pluginDir }),
    ).rejects.toThrow(/bundled/);
  });

  it('refuses to remove project-local theme via this command', async () => {
    await makeTheme(path.join(projectDir, '.slidesmith', 'themes'), 'local');
    await expect(
      removeTheme('local', { projectDir, userHome, pluginDir }),
    ).rejects.toThrow(/project|local/);
  });

  it('throws when theme not found', async () => {
    await expect(
      removeTheme('nonexistent', { projectDir, userHome, pluginDir }),
    ).rejects.toThrow(/not found/);
  });
});
