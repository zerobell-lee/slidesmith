import fs from 'fs-extra';
import path from 'node:path';
import { execa } from 'execa';

export type ExportFormat = 'pdf' | 'html' | 'pptx';

export async function combineThemeCss(
  themeCssPath: string,
  overridesPath: string | null,
  outPath: string,
): Promise<void> {
  const themeCss = await fs.readFile(themeCssPath, 'utf-8');
  let combined = themeCss;
  if (overridesPath && (await fs.pathExists(overridesPath))) {
    const ov = await fs.readFile(overridesPath, 'utf-8');
    combined = themeCss + '\n/* --- project overrides --- */\n' + ov;
  }
  await fs.ensureDir(path.dirname(outPath));
  await fs.writeFile(outPath, combined);
}

export interface ExportArgsOptions {
  input: string;
  themeCss: string;
  outBasename: string;
  formats: ExportFormat[];
}

export function buildExportArgs(opts: ExportArgsOptions): string[][] {
  return opts.formats.map((fmt) => {
    const outPath =
      fmt === 'html'
        ? path.join(path.dirname(opts.outBasename), 'html', `${path.basename(opts.outBasename)}.html`)
        : `${opts.outBasename}.${fmt}`;
    return [
      opts.input,
      '--theme',
      opts.themeCss,
      `--${fmt}`,
      '--allow-local-files',
      '-o',
      outPath,
    ];
  });
}

export async function runMarpExports(
  marpBinary: string,
  invocations: string[][],
  cwd: string,
): Promise<void> {
  for (const args of invocations) {
    await execa(marpBinary, args, { cwd, stdio: 'inherit' });
  }
}
