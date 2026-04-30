import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveThemePath, listThemePaths, type ThemeLocation } from '../src/lib/paths';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmpRoot: string;
let userHome: string;
let projectDir: string;
let pluginDir: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-paths-'));
  userHome = path.join(tmpRoot, 'home');
  projectDir = path.join(tmpRoot, 'project');
  pluginDir = path.join(tmpRoot, 'plugin');
  await fs.ensureDir(path.join(userHome, '.slidesmith', 'themes'));
  await fs.ensureDir(path.join(projectDir, '.slidesmith', 'themes'));
  await fs.ensureDir(path.join(pluginDir, 'themes'));
});

afterEach(async () => {
  await fs.remove(tmpRoot);
});

function makeTheme(root: string, name: string): void {
  fs.ensureDirSync(path.join(root, name));
  fs.writeFileSync(path.join(root, name, 'theme.yaml'), `name: ${name}`);
}

describe('resolveThemePath', () => {
  it('returns project local when present', () => {
    makeTheme(path.join(projectDir, '.slidesmith', 'themes'), 'midnight');
    makeTheme(path.join(userHome, '.slidesmith', 'themes'), 'midnight');
    makeTheme(path.join(pluginDir, 'themes'), 'midnight');
    const result = resolveThemePath('midnight', { projectDir, userHome, pluginDir });
    expect(result?.location).toBe<ThemeLocation>('project');
    expect(result?.path).toBe(path.join(projectDir, '.slidesmith', 'themes', 'midnight'));
  });

  it('falls back to user when project absent', () => {
    makeTheme(path.join(userHome, '.slidesmith', 'themes'), 'midnight');
    makeTheme(path.join(pluginDir, 'themes'), 'midnight');
    const result = resolveThemePath('midnight', { projectDir, userHome, pluginDir });
    expect(result?.location).toBe<ThemeLocation>('user');
  });

  it('falls back to bundled when neither project nor user', () => {
    makeTheme(path.join(pluginDir, 'themes'), 'midnight');
    const result = resolveThemePath('midnight', { projectDir, userHome, pluginDir });
    expect(result?.location).toBe<ThemeLocation>('bundled');
  });

  it('returns null when theme not found anywhere', () => {
    const result = resolveThemePath('nonexistent', { projectDir, userHome, pluginDir });
    expect(result).toBeNull();
  });
});

describe('listThemePaths', () => {
  it('returns all themes deduped by name with project taking precedence', () => {
    makeTheme(path.join(projectDir, '.slidesmith', 'themes'), 'midnight');
    makeTheme(path.join(userHome, '.slidesmith', 'themes'), 'midnight');
    makeTheme(path.join(userHome, '.slidesmith', 'themes'), 'editorial');
    makeTheme(path.join(pluginDir, 'themes'), 'default');
    const result = listThemePaths({ projectDir, userHome, pluginDir });
    expect(result.length).toBe(3);
    const midnight = result.find((t) => t.name === 'midnight');
    expect(midnight?.location).toBe<ThemeLocation>('project');
  });
});
