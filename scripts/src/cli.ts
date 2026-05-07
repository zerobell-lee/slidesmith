#!/usr/bin/env tsx
import { argv, env, exit, cwd } from 'node:process';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { execa } from 'execa';
import { listCapabilities, loadProcessors, matchFileRef, type UserConfig } from './dispatch.ts';
import { parseThemeManifest, type ProcessorManifest } from './lib/manifest.ts';
import { resolveThemePath, type PathContext } from './lib/paths.ts';
import { runDoctorChecks, defaultWhich } from './doctor.ts';
import { loadEnv } from './lib/env.ts';
import { bootstrapProject } from './new.ts';
import { listThemes, addTheme, updateTheme, removeTheme } from './theme.ts';
import { detectPlaceholders } from './detect.ts';
import { injectReplacements, type Replacement } from './inject.ts';
import { invokeBackend } from './lib/proc.ts';
import { combineThemeCss, buildExportArgs, runMarpExports, type ExportFormat } from './export.ts';

function context(): { paths: PathContext; pluginDir: string } {
  const projectDir = env.SLIDESMITH_PROJECT_DIR ?? cwd();
  const pluginDir = env.SLIDESMITH_PLUGIN_DIR ?? path.resolve(import.meta.dirname, '..', '..');
  const userHome = env.SLIDESMITH_USER_HOME ?? env.HOME ?? env.USERPROFILE ?? '';
  return {
    paths: { projectDir, pluginDir, userHome },
    pluginDir,
  };
}

function parseFlags(args: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = 'true';
      }
    }
  }
  return out;
}

interface ThemeConfigArgs {
  args: string[];
  cleanup?: () => Promise<void>;
}

async function resolveThemeConfigArgs(
  proc: ProcessorManifest,
  themeName: string | undefined,
  paths: PathContext,
): Promise<ThemeConfigArgs> {
  if (!proc.theme_config || !themeName) return { args: [] };
  const info = resolveThemePath(themeName, paths);
  if (!info) return { args: [] };
  const yamlPath = path.join(info.path, 'theme.yaml');
  if (!(await fs.pathExists(yamlPath))) return { args: [] };
  const manifest = parseThemeManifest(await fs.readFile(yamlPath, 'utf-8'));
  const config = manifest.prerender?.[proc.theme_config];
  if (!config || typeof config !== 'object') return { args: [] };
  // backgroundColor is a CLI-only flag in mmdc; the JSON config field is
  // ignored. Strip it from the JSON and emit `-b <color>` instead.
  const { backgroundColor, ...rest } = config as Record<string, unknown>;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-themecfg-'));
  const tmpFile = path.join(tmpDir, `${proc.theme_config}.json`);
  await fs.writeFile(tmpFile, JSON.stringify(rest));
  const args = ['-c', tmpFile];
  if (typeof backgroundColor === 'string' && backgroundColor.length > 0) {
    args.push('-b', backgroundColor);
  }
  return {
    args,
    cleanup: async () => {
      try {
        await fs.remove(tmpDir);
      } catch {
        /* best-effort */
      }
    },
  };
}

function processorRoots(ctx: PathContext, pluginDir: string): string[] {
  return [
    path.join(ctx.projectDir, '.slidesmith', 'prerenders'),
    path.join(ctx.userHome, '.slidesmith', 'prerenders'),
    path.join(pluginDir, 'prerenders'),
  ];
}

interface RunOneArgs {
  proc: ProcessorManifest;
  inputFile?: string;
  rawInput?: string;
  outputFile: string;
  themeName?: string;
  paths: PathContext;
  pluginDir: string;
  envValues: ReturnType<typeof loadEnv>;
  httpPath?: string;
  httpMethod?: 'GET' | 'POST';
}

async function runOneProcessor(opts: RunOneArgs): Promise<{ ok: true; out: string } | { ok: false; error: string }> {
  const themeConfigArgs = await resolveThemeConfigArgs(opts.proc, opts.themeName, opts.paths);
  let backend = opts.proc.backend;
  let outputTokenUsed = false;
  if (backend.type === 'cli' && backend.args) {
    const singleTokens: Record<string, string> = {
      '{input-file}': opts.inputFile ?? '',
      '{output}': opts.outputFile,
      '{input}': opts.rawInput ?? '',
    };
    const listTokens: Record<string, string[]> = {
      '{theme-config-args}': themeConfigArgs.args,
    };
    outputTokenUsed = backend.args.includes('{output}');
    backend = {
      ...backend,
      args: backend.args.flatMap((a) => {
        if (listTokens[a] !== undefined) return listTokens[a];
        if (singleTokens[a] !== undefined) return [singleTokens[a]];
        return [a];
      }),
    };
  }
  await fs.ensureDir(path.dirname(opts.outputFile));
  let inputForBackend = '';
  if (opts.inputFile) inputForBackend = await fs.readFile(opts.inputFile, 'utf-8');
  else if (opts.rawInput) inputForBackend = opts.rawInput;
  try {
    const result = await invokeBackend({
      backend,
      input: inputForBackend,
      env: opts.envValues,
      cwd: opts.paths.projectDir,
      pluginDir: opts.pluginDir,
      inputFile: opts.inputFile,
      outputFile: opts.outputFile,
      httpRequestPath: opts.httpPath,
      httpMethod: opts.httpMethod ?? 'GET',
    });
    if (result.kind === 'error') return { ok: false, error: result.message };
    if (outputTokenUsed || backend.type === 'internal') {
      // backend wrote file
    } else if (result.bytes) {
      await fs.writeFile(opts.outputFile, result.bytes);
    } else {
      await fs.writeFile(opts.outputFile, result.stdout);
    }
    return { ok: true, out: opts.outputFile };
  } finally {
    if (themeConfigArgs.cleanup) await themeConfigArgs.cleanup();
  }
}

async function loadUserConfig(paths: PathContext): Promise<UserConfig> {
  const userConfigPath = path.join(paths.userHome, '.slidesmith', 'config.yaml');
  if (!(await fs.pathExists(userConfigPath))) return {};
  const { parse } = await import('yaml');
  return (parse(await fs.readFile(userConfigPath, 'utf-8')) ?? {}) as UserConfig;
}

const commands: Record<string, (args: string[]) => Promise<void>> = {
  'list-capabilities': async () => {
    const { paths, pluginDir } = context();
    const procs = loadProcessors(processorRoots(paths, pluginDir));
    console.log(JSON.stringify(listCapabilities(procs), null, 2));
  },
  'theme-info': async (args) => {
    const themeName = args[0];
    if (!themeName) throw new Error('theme-info requires a theme name');
    const { paths } = context();
    const info = resolveThemePath(themeName, paths);
    if (!info) throw new Error(`theme not found: ${themeName}`);
    const manifest = parseThemeManifest(fs.readFileSync(path.join(info.path, 'theme.yaml'), 'utf-8'));
    console.log(
      JSON.stringify(
        { manifest, location: info.location, path: info.path },
        null,
        2,
      ),
    );
  },
  'new-project': async (args) => {
    const name = args[0];
    const flags = parseFlags(args.slice(1));
    if (!name) throw new Error('new-project requires <name>');
    const { paths, pluginDir } = context();
    const targetDir = path.resolve(paths.projectDir, name);
    await bootstrapProject({
      name,
      targetDir,
      themeName: flags.theme ?? 'default',
      lang: flags.lang ?? 'ko',
      pluginDir,
      userHome: paths.userHome,
    });
    console.log(JSON.stringify({ created: targetDir }));
  },
  theme: async (args) => {
    const sub = args[0];
    const rest = args.slice(1);
    const { paths } = context();
    switch (sub) {
      case 'list': {
        const result = await listThemes(paths);
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      case 'add': {
        const url = rest[0];
        const flags = parseFlags(rest.slice(1));
        if (!url) throw new Error('theme add requires <git-url>');
        const target = await addTheme(url, paths, { name: flags.name });
        console.log(JSON.stringify({ added: target }));
        return;
      }
      case 'update': {
        const name = rest[0];
        if (!name) throw new Error('theme update requires <name>');
        await updateTheme(name, paths);
        console.log(JSON.stringify({ updated: name }));
        return;
      }
      case 'remove': {
        const name = rest[0];
        if (!name) throw new Error('theme remove requires <name>');
        await removeTheme(name, paths);
        console.log(JSON.stringify({ removed: name }));
        return;
      }
      case 'info': {
        const name = rest[0];
        if (!name) throw new Error('theme info requires <name>');
        // delegate to existing theme-info handler
        await commands['theme-info']([name]);
        return;
      }
      default:
        throw new Error(`unknown theme subcommand: ${sub}`);
    }
  },
  gallery: async (args) => {
    const flags = parseFlags(args);
    const { paths, pluginDir } = context();
    const galleryDir = flags.out ?? path.join(pluginDir, 'gallery');
    const samplePath = path.join(pluginDir, 'gallery', 'sample.md');

    if (!(await fs.pathExists(samplePath))) {
      throw new Error(`gallery sample missing: ${samplePath}`);
    }

    const themesDir = path.join(pluginDir, 'themes');
    const themeNames: string[] = [];
    for (const entry of await fs.readdir(themesDir)) {
      if (entry.startsWith('_')) continue;
      const themeDir = path.join(themesDir, entry);
      const stat = await fs.stat(themeDir);
      if (!stat.isDirectory()) continue;
      if (!(await fs.pathExists(path.join(themeDir, 'theme.yaml')))) continue;
      themeNames.push(entry);
    }

    // Sample assets directory — copy into each theme's gallery output so the
    // file-ref images in sample.md resolve correctly when deck.html is opened
    // (browser resolves relative paths against the html's location).
    const sampleAssetsDir = path.join(pluginDir, 'gallery', 'assets');
    const hasSampleAssets = await fs.pathExists(sampleAssetsDir);

    for (const name of themeNames) {
      const themeCss = path.join(themesDir, name, 'theme.css');
      const outDir = path.join(galleryDir, name);
      await fs.ensureDir(outDir);

      if (hasSampleAssets) {
        await fs.copy(sampleAssetsDir, path.join(outDir, 'assets'), { overwrite: true });
      }

      const htmlOut = path.join(outDir, 'deck.html');
      await execa(
        'marp',
        [samplePath, '--theme', themeCss, '--html', '--allow-local-files', '-o', htmlOut],
        { stdio: 'inherit' },
      );

      // Per-slide PNGs at 2x for crisp README thumbnails.
      const pngOut = path.join(outDir, 'slide.png');
      await execa(
        'marp',
        [samplePath, '--theme', themeCss, '--images', 'png', '--image-scale', '2', '--allow-local-files', '-o', pngOut],
        { stdio: 'inherit' },
      );
    }

    console.log(JSON.stringify({ ok: true, themes: themeNames, galleryDir }));
  },
  'theme-preview': async (args) => {
    const themeName = args[0];
    if (!themeName) throw new Error('theme-preview requires a theme name');
    const { paths, pluginDir } = context();
    const found = resolveThemePath(themeName, paths);
    if (!found) throw new Error(`theme not found: ${themeName}`);

    // Bundled theme with pre-built gallery? Use it.
    if (found.location === 'bundled') {
      const galleryHtml = path.join(pluginDir, 'gallery', themeName, 'deck.html');
      if (await fs.pathExists(galleryHtml)) {
        console.log(JSON.stringify({ ok: true, source: 'gallery', path: galleryHtml }));
        return;
      }
    }

    // Build on the fly
    const samplePath = path.join(pluginDir, 'gallery', 'sample.md');
    if (!(await fs.pathExists(samplePath))) {
      throw new Error(`gallery sample missing: ${samplePath}`);
    }
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-preview-'));
    const out = path.join(tmpDir, `${themeName}.html`);
    const themeCss = path.join(found.path, 'theme.css');
    await execa(
      'marp',
      [samplePath, '--theme', themeCss, '--html', '--allow-local-files', '-o', out],
      { stdio: 'inherit' },
    );
    console.log(JSON.stringify({ ok: true, source: 'on-the-fly', path: out }));
  },
  'theme-build-preview': async (args) => {
    const flags = parseFlags(args);
    if (!flags['theme-css']) throw new Error('theme-build-preview requires --theme-css <path>');
    if (!flags.out) throw new Error('theme-build-preview requires --out <output-html>');
    const { pluginDir } = context();
    const samplePath = flags.sample ?? path.join(pluginDir, 'gallery', 'sample.md');
    if (!(await fs.pathExists(samplePath))) {
      throw new Error(`gallery sample missing: ${samplePath}`);
    }
    await fs.ensureDir(path.dirname(flags.out));
    await execa(
      'marp',
      [samplePath, '--theme', flags['theme-css'], '--html', '--allow-local-files', '-o', flags.out],
      { stdio: 'inherit' },
    );
    console.log(JSON.stringify({ ok: true, out: flags.out }));
  },
  doctor: async () => {
    const { paths, pluginDir } = context();
    const procs = loadProcessors(processorRoots(paths, pluginDir));
    const env = loadEnv(paths.projectDir, process.env);
    const report = await runDoctorChecks({
      processors: procs,
      env,
      whichBinary: defaultWhich,
    });
    for (const c of report.checks) {
      const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️ ' : '❌';
      console.log(`${icon}  ${c.label}${c.detail ? `\n   ${c.detail}` : ''}`);
    }
    if (!report.ok) exit(1);
  },
  detect: async (args) => {
    const file = args[0];
    if (!file) throw new Error('detect requires <markdown-file>');
    const md = await fs.promises.readFile(file, 'utf-8');
    console.log(JSON.stringify(detectPlaceholders(md), null, 2));
  },
  'dispatch-file-ref': async (args) => {
    const ext = args[0];
    if (!ext) throw new Error('dispatch-file-ref requires <extension>');
    const { paths, pluginDir } = context();
    const procs = loadProcessors(processorRoots(paths, pluginDir));
    const userConfigPath = path.join(paths.userHome, '.slidesmith', 'config.yaml');
    let userConfig: UserConfig = {};
    if (await fs.pathExists(userConfigPath)) {
      const { parse } = await import('yaml');
      userConfig = (parse(await fs.readFile(userConfigPath, 'utf-8')) ?? {}) as UserConfig;
    }
    const match = matchFileRef(ext, procs, userConfig);
    console.log(JSON.stringify(match, null, 2));
  },
  inject: async (args) => {
    const file = args[0];
    const flags = parseFlags(args.slice(1));
    if (!file) throw new Error('inject requires <markdown-file>');
    if (!flags.replacements || !flags.out) throw new Error('inject requires --replacements <json> --out <path>');
    const md = await fs.readFile(file, 'utf-8');
    const replacements: Replacement[] = JSON.parse(await fs.readFile(flags.replacements, 'utf-8'));
    const result = injectReplacements(md, replacements);
    await fs.ensureDir(path.dirname(flags.out));
    await fs.writeFile(flags.out, result);
    console.log(JSON.stringify({ written: flags.out, replacements: replacements.length }));
  },
  'run-processor': async (args) => {
    const flags = parseFlags(args);
    const procName = flags.name;
    if (!procName) throw new Error('run-processor requires --name <processor>');
    if (!flags.out) throw new Error('run-processor requires --out <output-path>');
    const { paths, pluginDir } = context();
    const procs = loadProcessors(processorRoots(paths, pluginDir));
    const proc = procs.find((p) => p.name === procName);
    if (!proc) throw new Error(`processor not found: ${procName}`);
    const envValues = loadEnv(paths.projectDir, process.env);
    const result = await runOneProcessor({
      proc,
      inputFile: flags['input-file'],
      rawInput: flags.input,
      outputFile: flags.out,
      themeName: flags.theme,
      paths,
      pluginDir,
      envValues,
      httpPath: flags['http-path'],
      httpMethod: (flags['http-method'] as 'GET' | 'POST') ?? 'GET',
    });
    if (!result.ok) {
      console.error(`run-processor error: ${result.error}`);
      exit(2);
    }
    console.log(JSON.stringify({ ok: true, out: result.out }));
  },
  'prerender-all': async (args) => {
    const flags = parseFlags(args);
    const { paths, pluginDir } = context();
    const inputMd = flags.input ?? path.join(paths.projectDir, 'output.md');
    const outDir = flags['out-dir'] ?? path.join(paths.projectDir, 'build', 'html');
    const themeName = flags.theme;
    const concurrency = Math.max(1, Number(flags.concurrency ?? 4));

    const md = await fs.readFile(inputMd, 'utf-8');
    const placeholders = detectPlaceholders(md);

    const procs = loadProcessors(processorRoots(paths, pluginDir));
    const userConfig = await loadUserConfig(paths);
    const envValues = loadEnv(paths.projectDir, process.env);

    interface Job {
      id: string;
      proc: ProcessorManifest;
      ph: ReturnType<typeof detectPlaceholders>[number];
      ext: string;
      subdir: 'svg' | 'img';
      out: string;
      inputFile?: string;
      httpInput?: string;
    }
    const jobs: Job[] = [];
    const externals: Array<Record<string, unknown>> = [];
    const passthrough: Array<Record<string, unknown>> = [];

    for (const ph of placeholders) {
      if (ph.kind === 'image') {
        passthrough.push({ id: ph.id, kind: 'image', path: ph.path });
        continue;
      }
      if (ph.kind === 'file-ref') {
        const proc = matchFileRef(ph.ext, procs, userConfig);
        if (!proc) {
          externals.push({ id: ph.id, kind: 'unmatched', ext: ph.ext, alt: ph.alt, raw: ph.raw, line: ph.line });
          continue;
        }
        if (proc.backend.type === 'mcp') {
          externals.push({
            id: ph.id,
            kind: 'file-ref-mcp',
            processor: proc.name,
            ext: ph.ext,
            alt: ph.alt,
            path: ph.path,
            raw: ph.raw,
            line: ph.line,
          });
          continue;
        }
        const ext = proc.output_ext ?? 'svg';
        const subdir: 'svg' | 'img' = ext === 'svg' ? 'svg' : 'img';
        const outFile = path.join(outDir, subdir, `${ph.id}.${ext}`);
        jobs.push({
          id: ph.id,
          proc,
          ph,
          ext,
          subdir,
          out: outFile,
          inputFile: path.join(paths.projectDir, ph.path),
        });
        continue;
      }
      // semantic — needs LLM judgment, dispatched externally
      externals.push({ id: ph.id, kind: 'semantic', alt: ph.alt, raw: ph.raw, line: ph.line });
    }

    interface Resolved {
      id: string;
      processor: string;
      ext: string;
      out: string;
      replacement: string;
    }
    const resolved: Resolved[] = [];
    const failures: Array<{ id: string; error: string }> = [];

    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, jobs.length) || 1 }, async () => {
      while (true) {
        const idx = cursor;
        cursor += 1;
        if (idx >= jobs.length) return;
        const job = jobs[idx];
        const r = await runOneProcessor({
          proc: job.proc,
          inputFile: job.inputFile,
          rawInput: job.httpInput,
          outputFile: job.out,
          themeName,
          paths,
          pluginDir,
          envValues,
          httpMethod: 'GET',
        });
        if (r.ok) {
          const altText = job.ph.kind === 'image' || job.ph.kind === 'file-ref' || job.ph.kind === 'semantic'
            ? job.ph.alt : '';
          resolved.push({
            id: job.id,
            processor: job.proc.name,
            ext: job.ext,
            out: job.out,
            replacement: `![${altText}](${job.subdir}/${job.id}.${job.ext})`,
          });
        } else {
          failures.push({ id: job.id, error: r.error });
        }
      }
    });
    await Promise.all(workers);

    // Restore document order so replacements apply left-to-right (matters when
    // originals collide, e.g. duplicate `![]()` placeholders).
    const idOrder = new Map(placeholders.map((p, i) => [p.id, i]));
    resolved.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

    await fs.ensureDir(outDir);
    const replacements: Replacement[] = resolved.map((r) => {
      const ph = placeholders.find((p) => p.id === r.id)!;
      return { id: r.id, original: ph.raw, replacement: r.replacement };
    });
    const replacementsPath = path.join(outDir, 'replacements.json');
    await fs.writeFile(replacementsPath, JSON.stringify(replacements, null, 2));

    console.log(JSON.stringify({
      ok: failures.length === 0,
      input: inputMd,
      outDir,
      resolved,
      externals,
      passthrough,
      failures,
      replacementsPath,
    }, null, 2));
  },
  export: async (args) => {
    const flags = parseFlags(args);
    const { paths } = context();
    const input = flags.input ?? path.join(paths.projectDir, 'build', '.cache', 'prerendered.md');
    const themeCss = flags['theme-css'];
    const overrides = flags.overrides;
    const outBasename = flags['out-basename'] ?? path.join(paths.projectDir, 'build', 'deck');
    const formats = (flags.formats ?? 'pdf,html').split(',') as ExportFormat[];

    if (!themeCss) throw new Error('export requires --theme-css <path>');

    const combinedCss = path.join(path.dirname(outBasename), '.cache', '_combined-theme.css');
    await combineThemeCss(themeCss, overrides ?? null, combinedCss);

    if (formats.includes('html')) {
      await fs.ensureDir(path.join(path.dirname(outBasename), 'html'));
    }

    const invocations = buildExportArgs({
      input,
      themeCss: combinedCss,
      outBasename,
      formats,
    });

    await runMarpExports('marp', invocations, paths.projectDir);
    console.log(JSON.stringify({ ok: true, outBasename, formats }));
  },
};

async function main(): Promise<void> {
  const subcommand = argv[2];
  const rest = argv.slice(3);
  if (!subcommand || !commands[subcommand]) {
    console.error(`Usage: cli.ts <subcommand>\nKnown: ${Object.keys(commands).join(', ')}`);
    exit(1);
  }
  await commands[subcommand](rest);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  exit(1);
});
