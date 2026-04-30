import fs from 'fs-extra';
import path from 'node:path';
import { execa } from 'execa';
import { listThemePaths, resolveThemePath, type PathContext } from './lib/paths.ts';
import { parseThemeManifest, type ThemeManifest } from './lib/manifest.ts';

export interface ThemeListEntry {
  name: string;
  location: 'project' | 'user' | 'bundled';
  path: string;
  manifest: ThemeManifest | null;
}

export async function listThemes(ctx: PathContext): Promise<ThemeListEntry[]> {
  const found = listThemePaths(ctx);
  const out: ThemeListEntry[] = [];
  for (const t of found) {
    let manifest: ThemeManifest | null = null;
    try {
      manifest = parseThemeManifest(
        await fs.readFile(path.join(t.path, 'theme.yaml'), 'utf-8'),
      );
    } catch {
      // ignore broken manifests; show entry without metadata
    }
    out.push({ name: t.name, location: t.location, path: t.path, manifest });
  }
  return out;
}

export async function addTheme(
  gitUrl: string,
  ctx: PathContext,
  options: { name?: string } = {},
): Promise<string> {
  const userThemes = path.join(ctx.userHome, '.slidesmith', 'themes');
  await fs.ensureDir(userThemes);
  const name = options.name ?? gitUrlToName(gitUrl);
  const target = path.join(userThemes, name);
  if (await fs.pathExists(target)) {
    throw new Error(`theme already exists at ${target}`);
  }
  await execa('git', ['clone', '--depth', '1', gitUrl, target], { stdio: 'inherit' });
  if (!(await fs.pathExists(path.join(target, 'theme.yaml')))) {
    await fs.remove(target);
    throw new Error('cloned repo has no theme.yaml at its root');
  }
  return target;
}

export async function updateTheme(name: string, ctx: PathContext): Promise<void> {
  const userPath = path.join(ctx.userHome, '.slidesmith', 'themes', name);
  if (!(await fs.pathExists(userPath))) {
    throw new Error(`user-global theme not found: ${name}`);
  }
  await execa('git', ['-C', userPath, 'pull', '--ff-only'], { stdio: 'inherit' });
}

export async function removeTheme(name: string, ctx: PathContext): Promise<void> {
  const found = resolveThemePath(name, ctx);
  if (!found) throw new Error(`theme not found: ${name}`);
  if (found.location === 'bundled') {
    throw new Error('cannot remove bundled theme; uninstall the plugin or use a different name');
  }
  if (found.location === 'project') {
    throw new Error('refusing to remove project-local theme via this command (delete the directory manually)');
  }
  await fs.remove(found.path);
}

function gitUrlToName(url: string): string {
  const m = /([^/:]+?)(?:\.git)?$/.exec(url.replace(/\/+$/, ''));
  if (!m) throw new Error(`cannot derive theme name from url: ${url}`);
  return m[1];
}
