import fs from 'fs-extra';
import path from 'node:path';
import { resolveThemePath } from './lib/paths.ts';
import { parseThemeManifest } from './lib/manifest.ts';

export interface BootstrapOptions {
  name: string;
  targetDir: string;
  themeName: string;
  lang: string;
  pluginDir: string;
  userHome: string;
}

export async function bootstrapProject(opts: BootstrapOptions): Promise<void> {
  if (await fs.pathExists(opts.targetDir)) {
    const entries = await fs.readdir(opts.targetDir);
    if (entries.length > 0) {
      throw new Error(`target directory is non-empty: ${opts.targetDir}`);
    }
  }

  const theme = resolveThemePath(opts.themeName, {
    projectDir: opts.targetDir,
    pluginDir: opts.pluginDir,
    userHome: opts.userHome,
  });
  if (!theme) throw new Error(`theme not found: ${opts.themeName}`);

  const manifest = parseThemeManifest(
    await fs.readFile(path.join(theme.path, 'theme.yaml'), 'utf-8'),
  );
  const samples = manifest.samples as Record<string, string>;
  const samplePath = samples[opts.lang] ?? samples.default;
  if (!samplePath) {
    throw new Error(`theme ${opts.themeName} has no usable sample mapping`);
  }
  const sampleAbs = path.join(theme.path, samplePath);
  if (!(await fs.pathExists(sampleAbs))) {
    throw new Error(`sample file missing: ${sampleAbs}`);
  }

  await fs.ensureDir(opts.targetDir);
  await fs.ensureDir(path.join(opts.targetDir, 'assets', 'diagrams'));
  await fs.ensureDir(path.join(opts.targetDir, 'assets', 'charts'));
  await fs.ensureDir(path.join(opts.targetDir, 'assets', 'images'));

  await fs.writeFile(
    path.join(opts.targetDir, 'deck.yaml'),
    `title: ${opts.name}
theme: ${opts.themeName}
language: ${opts.lang}
formats: [pdf, html]
output:
  basename: deck
plan:
  blueprint: blueprint.md
  assets: assets
`,
  );

  await fs.copyFile(sampleAbs, path.join(opts.targetDir, 'blueprint.md'));

  await fs.writeFile(
    path.join(opts.targetDir, '.gitignore'),
    `build/\n.env\n.env.local\n`,
  );

  await fs.writeFile(
    path.join(opts.targetDir, 'README.md'),
    `# ${opts.name}\n\nslidesmith deck. Run \`/slidesmith:build\` to render.\n`,
  );
}
