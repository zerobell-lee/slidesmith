import fs from 'fs-extra';
import path from 'node:path';

export type ThemeLocation = 'project' | 'user' | 'bundled';

export interface ThemeInfo {
  name: string;
  path: string;
  location: ThemeLocation;
}

export interface PathContext {
  projectDir: string;
  userHome: string;
  pluginDir: string;
}

function projectThemesDir(ctx: PathContext): string {
  return path.join(ctx.projectDir, '.slidesmith', 'themes');
}
function userThemesDir(ctx: PathContext): string {
  return path.join(ctx.userHome, '.slidesmith', 'themes');
}
function bundledThemesDir(ctx: PathContext): string {
  return path.join(ctx.pluginDir, 'themes');
}

function isTheme(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'theme.yaml'));
}

export function resolveThemePath(name: string, ctx: PathContext): ThemeInfo | null {
  const candidates: Array<[string, ThemeLocation]> = [
    [path.join(projectThemesDir(ctx), name), 'project'],
    [path.join(userThemesDir(ctx), name), 'user'],
    [path.join(bundledThemesDir(ctx), name), 'bundled'],
  ];
  for (const [p, location] of candidates) {
    if (isTheme(p)) return { name, path: p, location };
  }
  return null;
}

function listInDir(dir: string, location: ThemeLocation): ThemeInfo[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, path: path.join(dir, e.name), location }))
    .filter((t) => isTheme(t.path));
}

export function listThemePaths(ctx: PathContext): ThemeInfo[] {
  const all = [
    ...listInDir(projectThemesDir(ctx), 'project'),
    ...listInDir(userThemesDir(ctx), 'user'),
    ...listInDir(bundledThemesDir(ctx), 'bundled'),
  ];
  const seen = new Set<string>();
  return all.filter((t) => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });
}

export function defaultPathContext(projectDir: string, pluginDir: string): PathContext {
  return {
    projectDir,
    pluginDir,
    userHome: process.env.HOME ?? process.env.USERPROFILE ?? '',
  };
}
