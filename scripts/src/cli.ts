#!/usr/bin/env tsx
import { argv, env, exit, cwd } from 'node:process';
import path from 'node:path';
import fs from 'fs-extra';
import { listCapabilities, loadProcessors } from './dispatch.ts';
import { parseThemeManifest } from './lib/manifest.ts';
import { resolveThemePath, type PathContext } from './lib/paths.ts';
import { runDoctorChecks, defaultWhich } from './doctor.ts';
import { loadEnv } from './lib/env.ts';
import { bootstrapProject } from './new.ts';
import { listThemes, addTheme, updateTheme, removeTheme } from './theme.ts';

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

function processorRoots(ctx: PathContext, pluginDir: string): string[] {
  return [
    path.join(ctx.projectDir, '.slidesmith', 'prerenders'),
    path.join(ctx.userHome, '.slidesmith', 'prerenders'),
    path.join(pluginDir, 'prerenders'),
  ];
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
