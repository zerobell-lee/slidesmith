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

  // Validate the theme has a usable sample (we don't seed it, but we do reference
  // it in the README so the user knows where to look for the theme's style).
  const manifest = parseThemeManifest(
    await fs.readFile(path.join(theme.path, 'theme.yaml'), 'utf-8'),
  );
  const samples = manifest.samples as Record<string, string>;
  const samplePath = samples[opts.lang] ?? samples.default;
  if (!samplePath) {
    throw new Error(`theme ${opts.themeName} has no usable sample mapping`);
  }
  if (!(await fs.pathExists(path.join(theme.path, samplePath)))) {
    throw new Error(`sample file missing: ${path.join(theme.path, samplePath)}`);
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

  await fs.writeFile(
    path.join(opts.targetDir, 'blueprint.md'),
    blueprintTemplate(opts.name, opts.themeName, samplePath, theme.path),
  );

  await fs.writeFile(
    path.join(opts.targetDir, '.gitignore'),
    `build/\n.env\n.env.local\n`,
  );

  await fs.writeFile(
    path.join(opts.targetDir, 'README.md'),
    `# ${opts.name}\n\nslidesmith deck. Edit \`blueprint.md\` to describe what you want, then run \`/slidesmith:build\` to render.\n\nTheme: ${opts.themeName} (style reference: ${path.join(theme.path, samplePath)})\n`,
  );
}

/**
 * The seed for `blueprint.md`. This is a SPEC document the user fills in — not
 * a finished slide deck. Slidesmith reads it and generates `output.md` (the
 * actual Marp source) during the plan stage.
 */
function blueprintTemplate(
  name: string,
  themeName: string,
  samplePath: string,
  themeDir: string,
): string {
  return `# ${name} — deck spec

> This file is a **spec, not slides**. Describe what you want here. Run \`/slidesmith:plan\` for an interactive Q&A that refines this spec, then \`/slidesmith:build\` to render the actual Marp slides.

## Topic

<One or two sentences: what is this deck about?>

## Audience

<Who is listening? What do they already know?>

## Key messages

<The 3–5 things the audience should walk away with. One bullet each.>

-
-
-

## Source material

<Links, files in \`assets/\`, prior decks, references the writer should pull from.>

## Tone

<Formal · casual · persuasive · didactic · etc. Any do/don't notes.>

## Slide outline (optional)

<If you already know the rough sequence, sketch it. Otherwise leave blank and let plan propose one.>

1.
2.
3.

---

Theme reference (\`${themeName}\`): see \`${path.join(themeDir, samplePath)}\` for the style this theme produces.
`;
}
