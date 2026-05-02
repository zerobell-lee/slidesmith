import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;
const cliPath = path.resolve(__dirname, '..', 'src', 'cli.ts');

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-cli-'));
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('cli list-capabilities', () => {
  it('prints empty array when no processors registered', async () => {
    await fs.ensureDir(path.join(tmp, 'plugin', 'prerenders'));
    const { stdout } = await execa('npx', ['tsx', cliPath, 'list-capabilities'], {
      env: {
        ...process.env,
        SLIDESMITH_PLUGIN_DIR: path.join(tmp, 'plugin'),
        SLIDESMITH_PROJECT_DIR: tmp,
        SLIDESMITH_USER_HOME: tmp,
      },
    });
    expect(JSON.parse(stdout)).toEqual([]);
  });

  it('returns capabilities from bundled processors', async () => {
    const procDir = path.join(tmp, 'plugin', 'prerenders', 'mermaid-cli');
    await fs.ensureDir(procDir);
    await fs.writeFile(
      path.join(procDir, 'manifest.yaml'),
      `name: mermaid-cli
provides: [diagram.mermaid]
matches: { extensions: [.mmd] }
backend: { type: cli, cmd: mmdc }
`,
    );
    const { stdout } = await execa('npx', ['tsx', cliPath, 'list-capabilities'], {
      env: {
        ...process.env,
        SLIDESMITH_PLUGIN_DIR: path.join(tmp, 'plugin'),
        SLIDESMITH_PROJECT_DIR: tmp,
        SLIDESMITH_USER_HOME: tmp,
      },
    });
    const out = JSON.parse(stdout);
    expect(out).toHaveLength(1);
    expect(out[0].capability).toBe('diagram.mermaid');
  });
});

describe('cli theme-info', () => {
  it('returns parsed theme manifest as JSON', async () => {
    const themeDir = path.join(tmp, 'plugin', 'themes', 'midnight');
    await fs.ensureDir(themeDir);
    await fs.writeFile(
      path.join(themeDir, 'theme.yaml'),
      `name: midnight
displayName: Midnight
version: 0.1.0
description: dark
samples: { default: samples/sample.md }
`,
    );
    await fs.writeFile(path.join(themeDir, 'theme.css'), '/* @theme midnight */');
    const { stdout } = await execa('npx', ['tsx', cliPath, 'theme-info', 'midnight'], {
      env: {
        ...process.env,
        SLIDESMITH_PLUGIN_DIR: path.join(tmp, 'plugin'),
        SLIDESMITH_PROJECT_DIR: tmp,
        SLIDESMITH_USER_HOME: tmp,
      },
    });
    const info = JSON.parse(stdout);
    expect(info.manifest.name).toBe('midnight');
    expect(info.location).toBe('bundled');
  });
});

describe('cli theme-preview', () => {
  it('returns the prebuilt gallery path for a bundled theme when one exists', async () => {
    const themeDir = path.join(tmp, 'plugin', 'themes', 'midnight');
    await fs.ensureDir(themeDir);
    await fs.writeFile(
      path.join(themeDir, 'theme.yaml'),
      `name: midnight
displayName: Midnight
version: 0.1.0
description: dark
samples: { default: samples/sample.md }
`,
    );
    await fs.writeFile(path.join(themeDir, 'theme.css'), '/* @theme midnight */');
    const galleryDeck = path.join(tmp, 'plugin', 'gallery', 'midnight', 'deck.html');
    await fs.ensureDir(path.dirname(galleryDeck));
    await fs.writeFile(galleryDeck, '<html>cached gallery</html>');
    await fs.writeFile(path.join(tmp, 'plugin', 'gallery', 'sample.md'), '# x');

    const { stdout } = await execa('npx', ['tsx', cliPath, 'theme-preview', 'midnight'], {
      env: {
        ...process.env,
        SLIDESMITH_PLUGIN_DIR: path.join(tmp, 'plugin'),
        SLIDESMITH_PROJECT_DIR: tmp,
        SLIDESMITH_USER_HOME: tmp,
      },
    });
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.source).toBe('gallery');
    expect(path.normalize(result.path)).toBe(path.normalize(galleryDeck));
  });

  it('errors when the theme cannot be resolved', async () => {
    await fs.ensureDir(path.join(tmp, 'plugin', 'themes'));
    await expect(
      execa('npx', ['tsx', cliPath, 'theme-preview', 'nonexistent'], {
        env: {
          ...process.env,
          SLIDESMITH_PLUGIN_DIR: path.join(tmp, 'plugin'),
          SLIDESMITH_PROJECT_DIR: tmp,
          SLIDESMITH_USER_HOME: tmp,
        },
      }),
    ).rejects.toMatchObject({ exitCode: 1 });
  });
});
