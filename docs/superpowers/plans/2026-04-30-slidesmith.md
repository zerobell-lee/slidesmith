# slidesmith Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marp 기반의 Claude Code 플러그인 `slidesmith`를 구축한다 — 큐레이션 테마 + 확장 가능한 prerender 파이프라인 + LLM 주도 슬라이드 기획을 묶어 자연어 입력만으로 PDF/HTML/PPTX 발표 자료를 산출.

**Architecture:** 3층 구조 — 슬래시 커맨드(LLM 진입점) → Node/TS 스크립트(결정적 작업) + LLM(판단·창작) → 디스크 데이터(테마/매니페스트/프로젝트). 매니페스트 기반 확장(디렉토리 + YAML 추가 = 새 테마/프로세서). 능력(capability) ↔ 백엔드(processor) 디커플링.

**Tech Stack:** Node 20+, TypeScript (tsx 런타임, 빌드 없음), vitest(테스트), yaml(파싱), zod(스키마 검증), fs-extra(파일 ops), execa(subprocess), undici(HTTP), chalk(출력 포맷). 외부 의존: marp-cli, mermaid-cli, excalidraw MCP 서버.

**Spec Reference:** `docs/superpowers/specs/2026-04-30-slidesmith-design.md`

---

## Phase 0 — 프리렉

이 단계는 사용자가 수동으로 처리한다 (스크립트로 자동화 불가).

### Task 0: 디렉토리 rename 및 환경 준비

**Files:** N/A (사용자 작업)

- [ ] **Step 1: VSCode 등 IDE에서 `D:\workspace\marp-skills` 닫기**

핸들이 잡혀있으면 rename 실패한다.

- [ ] **Step 2: 디렉토리 rename**

PowerShell:
```powershell
Rename-Item -Path "D:\workspace\marp-skills" -NewName "slidesmith"
```

이후 모든 경로는 `D:\workspace\slidesmith`로 해석한다.

- [ ] **Step 3: Node.js 버전 확인**

```bash
node --version
```
Expected: v20.x 이상.

- [ ] **Step 4: marp-cli 전역 설치 확인 (실패해도 진행 가능, 나중에 doctor가 잡음)**

```bash
marp --version
```
없으면 `npm i -g @marp-team/marp-cli` 안내 (doctor 단계에서 다시 검증).

- [ ] **Step 5: git 저장소 초기화**

```bash
cd D:/workspace/slidesmith
git init
git config user.email "bnb3456@gmail.com"
```

---

## Phase 1 — Foundation

스크립트 루트 부트스트랩 + 공통 lib 유틸 5종.

### Task 1: 플러그인 레포 스캐폴딩

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `plugin.json`
- Create: `scripts/package.json`
- Create: `scripts/tsconfig.json`
- Create: `scripts/src/cli.ts` (skeleton)

- [ ] **Step 1: `.gitignore` 작성**

```
node_modules/
build/
*.log
.DS_Store
.env
.env.local
.claude/settings.local.json
```

- [ ] **Step 2: `README.md` 한 줄 안내**

```markdown
# slidesmith

Marp + Claude Code로 NotebookLM-style 슬라이드 자동 생성. 자세한 내용은 `docs/superpowers/specs/2026-04-30-slidesmith-design.md` 참조.
```

- [ ] **Step 3: Claude Code 플러그인 매니페스트 `plugin.json`**

```json
{
  "name": "slidesmith",
  "version": "0.1.0",
  "description": "Marp-based slide deck generator for Claude Code",
  "commandsDir": "commands"
}
```

- [ ] **Step 4: `scripts/package.json`**

```json
{
  "name": "slidesmith-scripts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "cli": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "execa": "^9.0.0",
    "fs-extra": "^11.2.0",
    "undici": "^6.0.0",
    "yaml": "^2.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/fs-extra": "^11.0.4",
    "@types/node": "^20.12.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

- [ ] **Step 5: `scripts/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 6: `scripts/src/cli.ts` skeleton**

```typescript
#!/usr/bin/env tsx
import { argv, exit } from 'node:process';

const subcommand = argv[2];

const commands: Record<string, () => Promise<void>> = {};

async function main(): Promise<void> {
  if (!subcommand || !commands[subcommand]) {
    console.error(`Usage: cli.ts <subcommand>\nKnown: ${Object.keys(commands).join(', ') || '(none yet)'}`);
    exit(1);
  }
  await commands[subcommand]();
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
```

- [ ] **Step 7: 의존성 설치**

```bash
cd scripts && npm install
```

- [ ] **Step 8: 첫 커밋**

```bash
git add -A
git commit -m "chore: initial slidesmith scaffolding"
```

---

### Task 2: lib/manifest.ts — YAML 매니페스트 파서

**Files:**
- Create: `scripts/src/lib/manifest.ts`
- Test: `scripts/tests/manifest.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/manifest.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseProcessorManifest, parseThemeManifest } from '../src/lib/manifest';

describe('parseProcessorManifest', () => {
  it('parses a valid CLI processor manifest', () => {
    const yaml = `
name: mermaid-cli
provides: [diagram.mermaid]
matches:
  extensions: [.mmd, .mermaid]
backend:
  type: cli
  cmd: mmdc
requires:
  binaries: [mmdc]
priority: 50
`;
    const result = parseProcessorManifest(yaml);
    expect(result.name).toBe('mermaid-cli');
    expect(result.provides).toEqual(['diagram.mermaid']);
    expect(result.matches.extensions).toEqual(['.mmd', '.mermaid']);
    expect(result.backend.type).toBe('cli');
    expect(result.priority).toBe(50);
  });

  it('parses an HTTP processor manifest', () => {
    const yaml = `
name: pexels
provides: [stock.photo]
matches: {}
backend:
  type: http
  base: https://api.pexels.com/v1
requires:
  env: [PEXELS_API_KEY]
priority: 60
`;
    const result = parseProcessorManifest(yaml);
    expect(result.backend.type).toBe('http');
    expect(result.requires?.env).toEqual(['PEXELS_API_KEY']);
  });

  it('rejects manifest missing required fields', () => {
    const yaml = `name: broken`;
    expect(() => parseProcessorManifest(yaml)).toThrow();
  });

  it('defaults priority to 50 when omitted', () => {
    const yaml = `
name: x
provides: [y]
matches: {}
backend: { type: cli, cmd: x }
`;
    const result = parseProcessorManifest(yaml);
    expect(result.priority).toBe(50);
  });
});

describe('parseThemeManifest', () => {
  it('parses a valid theme manifest', () => {
    const yaml = `
name: midnight-tech
displayName: Midnight Tech
version: 0.1.0
description: dark
tags: [technical]
fits: [tech-talk]
constraints: ["h1 = title"]
samples:
  default: samples/sample.md
  en: samples/sample.en.md
`;
    const result = parseThemeManifest(yaml);
    expect(result.name).toBe('midnight-tech');
    expect(result.samples.default).toBe('samples/sample.md');
    expect(result.samples.en).toBe('samples/sample.en.md');
  });

  it('requires samples.default', () => {
    const yaml = `
name: t
displayName: T
version: 0.1.0
description: ''
samples:
  en: samples/sample.en.md
`;
    expect(() => parseThemeManifest(yaml)).toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/manifest.test.ts
```
Expected: FAIL with module not found.

- [ ] **Step 3: 구현 작성**

`scripts/src/lib/manifest.ts`:

```typescript
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const BackendSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('cli'),
    cmd: z.string(),
    args: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('http'),
    base: z.string().url(),
    auth: z.string().optional(),
  }),
  z.object({
    type: z.literal('mcp'),
    server: z.string(),
    tool: z.string().optional(),
  }),
]);

const ProcessorManifestSchema = z.object({
  name: z.string().min(1),
  provides: z.array(z.string().min(1)).min(1),
  matches: z.object({
    extensions: z.array(z.string()).optional(),
  }).default({}),
  backend: BackendSchema,
  requires: z.object({
    binaries: z.array(z.string()).optional(),
    env: z.array(z.string()).optional(),
    mcp: z.array(z.string()).optional(),
  }).optional(),
  priority: z.number().int().default(50),
});

export type ProcessorManifest = z.infer<typeof ProcessorManifestSchema>;

const ThemeManifestSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  version: z.string().min(1),
  author: z.string().optional(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  fits: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  samples: z.object({
    default: z.string(),
    en: z.string().optional(),
    jp: z.string().optional(),
    ko: z.string().optional(),
  }).passthrough(),
  recommendedPrerenders: z.array(z.string()).default([]),
});

export type ThemeManifest = z.infer<typeof ThemeManifestSchema>;

export function parseProcessorManifest(yaml: string): ProcessorManifest {
  const raw = parseYaml(yaml);
  return ProcessorManifestSchema.parse(raw);
}

export function parseThemeManifest(yaml: string): ThemeManifest {
  const raw = parseYaml(yaml);
  return ThemeManifestSchema.parse(raw);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/manifest.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: 커밋**

```bash
git add scripts/src/lib/manifest.ts scripts/tests/manifest.test.ts
git commit -m "feat(scripts): add YAML manifest parser for processors and themes"
```

---

### Task 3: lib/paths.ts — 테마 경로 해석 (project > user > bundled)

**Files:**
- Create: `scripts/src/lib/paths.ts`
- Test: `scripts/tests/paths.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/paths.test.ts`:

```typescript
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
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/paths.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

`scripts/src/lib/paths.ts`:

```typescript
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/paths.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add scripts/src/lib/paths.ts scripts/tests/paths.test.ts
git commit -m "feat(scripts): add theme path resolution with project > user > bundled precedence"
```

---

### Task 4: lib/env.ts — 환경변수 + 프로젝트 .env 머지

**Files:**
- Create: `scripts/src/lib/env.ts`
- Test: `scripts/tests/env.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/env.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEnv } from '../src/lib/env';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-env-'));
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('loadEnv', () => {
  it('reads from process env when no .env present', () => {
    const result = loadEnv(tmp, { FOO: 'bar' });
    expect(result.FOO).toBe('bar');
  });

  it('overrides process env with project .env', () => {
    fs.writeFileSync(path.join(tmp, '.env'), 'FOO=from-dotenv\n');
    const result = loadEnv(tmp, { FOO: 'from-process' });
    expect(result.FOO).toBe('from-dotenv');
  });

  it('merges keys from both sources', () => {
    fs.writeFileSync(path.join(tmp, '.env'), 'A=1\nB=2\n');
    const result = loadEnv(tmp, { C: '3' });
    expect(result).toEqual({ A: '1', B: '2', C: '3' });
  });

  it('ignores comment and empty lines', () => {
    fs.writeFileSync(path.join(tmp, '.env'), '# comment\n\nA=1\n');
    const result = loadEnv(tmp, {});
    expect(result).toEqual({ A: '1' });
  });

  it('strips surrounding quotes', () => {
    fs.writeFileSync(path.join(tmp, '.env'), 'A="quoted"\nB=\'single\'\n');
    const result = loadEnv(tmp, {});
    expect(result.A).toBe('quoted');
    expect(result.B).toBe('single');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/env.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

`scripts/src/lib/env.ts`:

```typescript
import fs from 'fs-extra';
import path from 'node:path';

export type Env = Record<string, string>;

function parseDotenv(content: string): Env {
  const result: Env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function loadEnv(projectDir: string, processEnv: NodeJS.ProcessEnv): Env {
  const out: Env = {};
  for (const [k, v] of Object.entries(processEnv)) {
    if (typeof v === 'string') out[k] = v;
  }
  const dotenvPath = path.join(projectDir, '.env');
  if (fs.existsSync(dotenvPath)) {
    const parsed = parseDotenv(fs.readFileSync(dotenvPath, 'utf-8'));
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = v;
    }
  }
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/env.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add scripts/src/lib/env.ts scripts/tests/env.test.ts
git commit -m "feat(scripts): add .env loader merging project .env over process env"
```

---

### Task 5: lib/proc.ts — 백엔드 어댑터 (CLI/HTTP/MCP)

**Files:**
- Create: `scripts/src/lib/proc.ts`
- Test: `scripts/tests/proc.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/proc.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invokeBackend, type BackendInvocation } from '../src/lib/proc';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-proc-'));
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('invokeBackend (cli)', () => {
  it('runs cli command and returns stdout', async () => {
    const result = await invokeBackend({
      backend: { type: 'cli', cmd: 'node', args: ['-e', 'console.log("hi")'] },
      input: '',
      env: {},
      cwd: tmp,
    } as BackendInvocation);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.stdout.trim()).toBe('hi');
  });

  it('returns error when cli fails', async () => {
    const result = await invokeBackend({
      backend: { type: 'cli', cmd: 'node', args: ['-e', 'process.exit(1)'] },
      input: '',
      env: {},
      cwd: tmp,
    } as BackendInvocation);
    expect(result.kind).toBe('error');
  });
});

describe('invokeBackend (http)', () => {
  it('returns error placeholder for http (full impl in integration)', async () => {
    // Stubbed test: ensure http branch routes correctly even if upstream fails offline
    const result = await invokeBackend({
      backend: { type: 'http', base: 'http://127.0.0.1:1' },
      input: 'q',
      env: {},
      cwd: tmp,
      httpRequestPath: '/search',
    } as BackendInvocation);
    expect(result.kind).toBe('error');
  });
});

describe('invokeBackend (mcp)', () => {
  it('returns not-implemented for mcp until adapter wired (placeholder)', async () => {
    const result = await invokeBackend({
      backend: { type: 'mcp', server: 'excalidraw' },
      input: 'q',
      env: {},
      cwd: tmp,
    } as BackendInvocation);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toMatch(/mcp/i);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/proc.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

`scripts/src/lib/proc.ts`:

```typescript
import { execa } from 'execa';
import { request } from 'undici';
import type { ProcessorManifest } from './manifest';
import type { Env } from './env';

type Backend = ProcessorManifest['backend'];

export interface BackendInvocation {
  backend: Backend;
  input: string;
  env: Env;
  cwd: string;
  httpRequestPath?: string;
  httpMethod?: 'GET' | 'POST';
  httpHeaders?: Record<string, string>;
}

export type BackendResult =
  | { kind: 'ok'; stdout: string; bytes?: Buffer }
  | { kind: 'error'; message: string };

export async function invokeBackend(invocation: BackendInvocation): Promise<BackendResult> {
  const { backend } = invocation;
  switch (backend.type) {
    case 'cli':
      return runCli(invocation, backend);
    case 'http':
      return runHttp(invocation, backend);
    case 'mcp':
      return {
        kind: 'error',
        message: 'mcp backend not yet wired in this adapter; orchestrate via Claude Code MCP tools.',
      };
  }
}

async function runCli(
  inv: BackendInvocation,
  backend: Extract<Backend, { type: 'cli' }>,
): Promise<BackendResult> {
  try {
    const { stdout } = await execa(backend.cmd, backend.args ?? [], {
      cwd: inv.cwd,
      env: inv.env,
      input: inv.input || undefined,
      reject: true,
    });
    return { kind: 'ok', stdout };
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runHttp(
  inv: BackendInvocation,
  backend: Extract<Backend, { type: 'http' }>,
): Promise<BackendResult> {
  try {
    const url = backend.base + (inv.httpRequestPath ?? '');
    const headers: Record<string, string> = { ...(inv.httpHeaders ?? {}) };
    if (backend.auth) {
      const expanded = expandEnvRefs(backend.auth, inv.env);
      const m = /^header:([^:]+):(.+)$/.exec(expanded);
      if (m) headers[m[1]] = m[2];
    }
    const res = await request(url, {
      method: inv.httpMethod ?? 'GET',
      headers,
      body: inv.httpMethod === 'POST' ? inv.input : undefined,
    });
    if (res.statusCode >= 400) {
      return { kind: 'error', message: `http ${res.statusCode}` };
    }
    const buf = Buffer.from(await res.body.arrayBuffer());
    return { kind: 'ok', stdout: buf.toString('utf-8'), bytes: buf };
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function expandEnvRefs(template: string, env: Env): string {
  return template.replace(/\{env\.([A-Z0-9_]+)\}/g, (_, key) => env[key] ?? '');
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/proc.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add scripts/src/lib/proc.ts scripts/tests/proc.test.ts
git commit -m "feat(scripts): add backend adapter for CLI/HTTP/MCP invocations"
```

---

## Phase 2 — 탐지 / 디스패치 / 주입

### Task 6: detect.ts — placeholder 탐지

**Files:**
- Create: `scripts/src/detect.ts`
- Test: `scripts/tests/detect.test.ts`

스펙 §6.3의 3가지 placeholder 형태(일반 이미지 / 파일 변환 대상 / semantic) 탐지.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/detect.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectPlaceholders } from '../src/detect';

describe('detectPlaceholders', () => {
  it('classifies image with png extension as kind=image', () => {
    const md = '# Title\n\n![hero](assets/images/hero.png)\n';
    const result = detectPlaceholders(md);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('image');
    expect(result[0].path).toBe('assets/images/hero.png');
  });

  it('classifies image with .mmd extension as kind=file-ref', () => {
    const md = '![flow](assets/diagrams/flow.mmd)\n';
    const result = detectPlaceholders(md);
    expect(result[0].kind).toBe('file-ref');
    if (result[0].kind === 'file-ref') {
      expect(result[0].ext).toBe('.mmd');
    }
  });

  it('classifies image with empty src as kind=semantic', () => {
    const md = '![A cat by the window]()\n';
    const result = detectPlaceholders(md);
    expect(result[0].kind).toBe('semantic');
    if (result[0].kind === 'semantic') {
      expect(result[0].alt).toBe('A cat by the window');
    }
  });

  it('handles compound .vl.json extension', () => {
    const md = '![chart](assets/charts/sales.vl.json)\n';
    const result = detectPlaceholders(md);
    expect(result[0].kind).toBe('file-ref');
    if (result[0].kind === 'file-ref') {
      expect(result[0].ext).toBe('.vl.json');
    }
  });

  it('assigns sequential ids and tracks line numbers', () => {
    const md = 'line 1\n![a](x.png)\nline 3\n![b]()\n';
    const result = detectPlaceholders(md);
    expect(result[0].id).toBe('p1');
    expect(result[0].line).toBe(2);
    expect(result[1].id).toBe('p2');
    expect(result[1].line).toBe(4);
  });

  it('ignores code-block content (no langs prerendered inline)', () => {
    const md = '```mermaid\ngraph TD; A-->B\n```\n![hero](assets/x.png)\n';
    const result = detectPlaceholders(md);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('image');
  });

  it('returns empty array for plain markdown', () => {
    expect(detectPlaceholders('# Just text')).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/detect.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

`scripts/src/detect.ts`:

```typescript
import path from 'node:path';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
const COMPOUND_EXTS = ['.vl.json', '.chart.json'];

export type Placeholder =
  | { id: string; kind: 'image'; alt: string; path: string; line: number; raw: string }
  | { id: string; kind: 'file-ref'; alt: string; path: string; ext: string; line: number; raw: string }
  | { id: string; kind: 'semantic'; alt: string; line: number; raw: string };

const IMG_RE = /!\[([^\]]*)\]\(([^)]*)\)/g;

function getExtension(p: string): string {
  for (const compound of COMPOUND_EXTS) {
    if (p.toLowerCase().endsWith(compound)) return compound;
  }
  return path.extname(p).toLowerCase();
}

function isInsideFencedCode(lines: string[], lineIdx: number): boolean {
  let inside = false;
  for (let i = 0; i < lineIdx; i++) {
    if (/^```/.test(lines[i])) inside = !inside;
  }
  return inside;
}

export function detectPlaceholders(markdown: string): Placeholder[] {
  const lines = markdown.split(/\r?\n/);
  const result: Placeholder[] = [];
  let counter = 0;

  for (let i = 0; i < lines.length; i++) {
    if (isInsideFencedCode(lines, i)) continue;
    const line = lines[i];
    IMG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMG_RE.exec(line)) !== null) {
      counter += 1;
      const id = `p${counter}`;
      const alt = m[1];
      const src = m[2].trim();
      const lineNum = i + 1;
      const raw = m[0];
      if (src === '') {
        result.push({ id, kind: 'semantic', alt, line: lineNum, raw });
      } else {
        const ext = getExtension(src);
        if (IMAGE_EXTS.has(ext)) {
          result.push({ id, kind: 'image', alt, path: src, line: lineNum, raw });
        } else {
          result.push({ id, kind: 'file-ref', alt, path: src, ext, line: lineNum, raw });
        }
      }
    }
  }
  return result;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/detect.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5: 커밋**

```bash
git add scripts/src/detect.ts scripts/tests/detect.test.ts
git commit -m "feat(scripts): add placeholder detection for image/file-ref/semantic kinds"
```

---

### Task 7: dispatch.ts — 매니페스트 로딩 + 능력 매칭

**Files:**
- Create: `scripts/src/dispatch.ts`
- Test: `scripts/tests/dispatch.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/dispatch.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadProcessors, matchFileRef, listCapabilities } from '../src/dispatch';
import type { ProcessorManifest } from '../src/lib/manifest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-disp-'));
  await fs.ensureDir(path.join(tmp, 'mermaid-cli'));
  fs.writeFileSync(
    path.join(tmp, 'mermaid-cli', 'manifest.yaml'),
    `name: mermaid-cli
provides: [diagram.mermaid]
matches:
  extensions: [.mmd, .mermaid]
backend: { type: cli, cmd: mmdc }
priority: 50
`,
  );
  await fs.ensureDir(path.join(tmp, 'pexels'));
  fs.writeFileSync(
    path.join(tmp, 'pexels', 'manifest.yaml'),
    `name: pexels
provides: [stock.photo]
matches: {}
backend: { type: http, base: https://api.pexels.com/v1 }
requires: { env: [PEXELS_API_KEY] }
priority: 60
`,
  );
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('loadProcessors', () => {
  it('loads all manifests in a directory', () => {
    const result = loadProcessors([tmp]);
    expect(result).toHaveLength(2);
    const names = result.map((m) => m.name).sort();
    expect(names).toEqual(['mermaid-cli', 'pexels']);
  });

  it('returns empty array for missing directory', () => {
    expect(loadProcessors([path.join(tmp, 'nonexistent')])).toEqual([]);
  });
});

describe('matchFileRef', () => {
  const procs: ProcessorManifest[] = [
    {
      name: 'mermaid-cli',
      provides: ['diagram.mermaid'],
      matches: { extensions: ['.mmd', '.mermaid'] },
      backend: { type: 'cli', cmd: 'mmdc' },
      priority: 50,
    },
    {
      name: 'mermaid-other',
      provides: ['diagram.mermaid'],
      matches: { extensions: ['.mmd'] },
      backend: { type: 'cli', cmd: 'other' },
      priority: 30,
    },
  ];

  it('returns highest priority match for an extension', () => {
    const result = matchFileRef('.mmd', procs);
    expect(result?.name).toBe('mermaid-cli');
  });

  it('returns null when no processor matches extension', () => {
    expect(matchFileRef('.xyz', procs)).toBeNull();
  });

  it('honors user preference override over priority', () => {
    const result = matchFileRef('.mmd', procs, {
      preferred: { 'diagram.mermaid': 'mermaid-other' },
    });
    expect(result?.name).toBe('mermaid-other');
  });
});

describe('listCapabilities', () => {
  it('returns unique capability names with provider counts', () => {
    const result = listCapabilities([
      { name: 'a', provides: ['stock.photo'], matches: {}, backend: { type: 'cli', cmd: 'a' }, priority: 50 },
      { name: 'b', provides: ['stock.photo'], matches: {}, backend: { type: 'cli', cmd: 'b' }, priority: 60 },
      { name: 'c', provides: ['diagram.mermaid'], matches: {}, backend: { type: 'cli', cmd: 'c' }, priority: 50 },
    ]);
    expect(result.find((c) => c.capability === 'stock.photo')?.providers).toEqual(['b', 'a']);
    expect(result.find((c) => c.capability === 'diagram.mermaid')?.providers).toEqual(['c']);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/dispatch.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

`scripts/src/dispatch.ts`:

```typescript
import fs from 'fs-extra';
import path from 'node:path';
import { parseProcessorManifest, type ProcessorManifest } from './lib/manifest';

export interface UserConfig {
  preferred?: Record<string, string>;
}

export function loadProcessors(roots: string[]): ProcessorManifest[] {
  const result: ProcessorManifest[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(root, entry.name, 'manifest.yaml');
      if (!fs.existsSync(manifestPath)) continue;
      const yaml = fs.readFileSync(manifestPath, 'utf-8');
      try {
        result.push(parseProcessorManifest(yaml));
      } catch (err) {
        console.warn(`[slidesmith] skipping invalid manifest at ${manifestPath}: ${(err as Error).message}`);
      }
    }
  }
  return result;
}

export function matchFileRef(
  extension: string,
  processors: ProcessorManifest[],
  config: UserConfig = {},
): ProcessorManifest | null {
  const ext = extension.toLowerCase();
  const candidates = processors.filter((p) => p.matches.extensions?.some((e) => e.toLowerCase() === ext));
  if (candidates.length === 0) return null;
  if (config.preferred) {
    for (const cap of new Set(candidates.flatMap((c) => c.provides))) {
      const preferredName = config.preferred[cap];
      if (preferredName) {
        const found = candidates.find((c) => c.name === preferredName);
        if (found) return found;
      }
    }
  }
  return [...candidates].sort((a, b) => b.priority - a.priority)[0];
}

export interface CapabilitySummary {
  capability: string;
  providers: string[];
}

export function listCapabilities(processors: ProcessorManifest[]): CapabilitySummary[] {
  const map = new Map<string, ProcessorManifest[]>();
  for (const p of processors) {
    for (const cap of p.provides) {
      const list = map.get(cap) ?? [];
      list.push(p);
      map.set(cap, list);
    }
  }
  return [...map.entries()].map(([capability, ps]) => ({
    capability,
    providers: [...ps].sort((a, b) => b.priority - a.priority).map((p) => p.name),
  }));
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/dispatch.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: 커밋**

```bash
git add scripts/src/dispatch.ts scripts/tests/dispatch.test.ts
git commit -m "feat(scripts): add processor manifest loading and capability matching"
```

---

### Task 8: inject.ts — placeholder 치환

**Files:**
- Create: `scripts/src/inject.ts`
- Test: `scripts/tests/inject.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/inject.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { injectReplacements, type Replacement } from '../src/inject';

describe('injectReplacements', () => {
  it('replaces a single placeholder by id', () => {
    const md = '![hero](assets/images/hero.png)\n';
    const replacements: Replacement[] = [
      { id: 'p1', original: '![hero](assets/images/hero.png)', replacement: '![hero](build/.cache/img/p1.jpg)' },
    ];
    expect(injectReplacements(md, replacements)).toBe('![hero](build/.cache/img/p1.jpg)\n');
  });

  it('replaces multiple placeholders preserving order', () => {
    const md = 'a ![x]() b ![y]() c\n';
    const replacements: Replacement[] = [
      { id: 'p1', original: '![x]()', replacement: '![x](r1.png)' },
      { id: 'p2', original: '![y]()', replacement: '![y](r2.png)' },
    ];
    expect(injectReplacements(md, replacements)).toBe('a ![x](r1.png) b ![y](r2.png) c\n');
  });

  it('leaves untouched placeholders alone', () => {
    const md = '![a]() ![b]()\n';
    const replacements: Replacement[] = [
      { id: 'p1', original: '![a]()', replacement: '![a](r.png)' },
    ];
    expect(injectReplacements(md, replacements)).toBe('![a](r.png) ![b]()\n');
  });

  it('throws when an original substring is not present', () => {
    const md = 'no placeholder here';
    const replacements: Replacement[] = [
      { id: 'p1', original: '![missing]()', replacement: 'x' },
    ];
    expect(() => injectReplacements(md, replacements)).toThrow(/p1/);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/inject.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

`scripts/src/inject.ts`:

```typescript
export interface Replacement {
  id: string;
  original: string;
  replacement: string;
}

export function injectReplacements(markdown: string, replacements: Replacement[]): string {
  let out = markdown;
  for (const r of replacements) {
    const idx = out.indexOf(r.original);
    if (idx === -1) {
      throw new Error(`inject: placeholder ${r.id} original substring not found in document`);
    }
    out = out.slice(0, idx) + r.replacement + out.slice(idx + r.original.length);
  }
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/inject.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add scripts/src/inject.ts scripts/tests/inject.test.ts
git commit -m "feat(scripts): add placeholder injection utility"
```

---

## Phase 3 — CLI 진입점 + Doctor

### Task 9: cli.ts — subcommand dispatch + 첫 두 커맨드 (`list-capabilities`, `theme-info`)

**Files:**
- Modify: `scripts/src/cli.ts`
- Test: `scripts/tests/cli.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/cli.test.ts`:

```typescript
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
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/cli.test.ts
```
Expected: FAIL.

- [ ] **Step 3: cli.ts 구현 (subcommand dispatch + 두 커맨드)**

`scripts/src/cli.ts`:

```typescript
#!/usr/bin/env tsx
import { argv, env, exit, cwd } from 'node:process';
import path from 'node:path';
import fs from 'fs-extra';
import { listCapabilities, loadProcessors } from './dispatch.ts';
import { parseThemeManifest } from './lib/manifest.ts';
import { resolveThemePath, defaultPathContext, type PathContext } from './lib/paths.ts';

function context(): { paths: PathContext; pluginDir: string } {
  const projectDir = env.SLIDESMITH_PROJECT_DIR ?? cwd();
  const pluginDir = env.SLIDESMITH_PLUGIN_DIR ?? path.resolve(import.meta.dirname, '..', '..');
  const userHome = env.SLIDESMITH_USER_HOME ?? env.HOME ?? env.USERPROFILE ?? '';
  return {
    paths: { projectDir, pluginDir, userHome },
    pluginDir,
  };
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/cli.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add scripts/src/cli.ts scripts/tests/cli.test.ts
git commit -m "feat(scripts): wire cli with list-capabilities and theme-info subcommands"
```

---

### Task 10: doctor.ts — 환경 검증

**Files:**
- Create: `scripts/src/doctor.ts`
- Modify: `scripts/src/cli.ts` (add `doctor` subcommand)
- Test: `scripts/tests/doctor.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/doctor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runDoctorChecks } from '../src/doctor';
import type { ProcessorManifest } from '../src/lib/manifest';

describe('runDoctorChecks', () => {
  it('reports missing env requirements as fail', async () => {
    const procs: ProcessorManifest[] = [
      {
        name: 'pexels',
        provides: ['stock.photo'],
        matches: {},
        backend: { type: 'http', base: 'https://api.pexels.com/v1' },
        requires: { env: ['PEXELS_API_KEY'] },
        priority: 50,
      },
    ];
    const report = await runDoctorChecks({
      processors: procs,
      env: {},
      whichBinary: async () => null,
    });
    const envCheck = report.checks.find((c) => c.id.startsWith('env:PEXELS_API_KEY'));
    expect(envCheck?.status).toBe('fail');
  });

  it('reports present env as pass', async () => {
    const procs: ProcessorManifest[] = [
      {
        name: 'pexels',
        provides: ['stock.photo'],
        matches: {},
        backend: { type: 'http', base: 'https://api.pexels.com/v1' },
        requires: { env: ['PEXELS_API_KEY'] },
        priority: 50,
      },
    ];
    const report = await runDoctorChecks({
      processors: procs,
      env: { PEXELS_API_KEY: 'set' },
      whichBinary: async () => null,
    });
    const envCheck = report.checks.find((c) => c.id.startsWith('env:PEXELS_API_KEY'));
    expect(envCheck?.status).toBe('pass');
  });

  it('reports missing binaries as fail', async () => {
    const procs: ProcessorManifest[] = [
      {
        name: 'mermaid-cli',
        provides: ['diagram.mermaid'],
        matches: {},
        backend: { type: 'cli', cmd: 'mmdc' },
        requires: { binaries: ['mmdc'] },
        priority: 50,
      },
    ];
    const report = await runDoctorChecks({
      processors: procs,
      env: {},
      whichBinary: async () => null,
    });
    const check = report.checks.find((c) => c.id === 'binary:mmdc');
    expect(check?.status).toBe('fail');
  });

  it('always checks marp-cli presence', async () => {
    const report = await runDoctorChecks({
      processors: [],
      env: {},
      whichBinary: async (name) => (name === 'marp' ? '/usr/local/bin/marp' : null),
    });
    const check = report.checks.find((c) => c.id === 'binary:marp');
    expect(check?.status).toBe('pass');
  });

  it('aggregates ok=true only when all critical checks pass', async () => {
    const okReport = await runDoctorChecks({
      processors: [],
      env: {},
      whichBinary: async () => '/usr/local/bin/marp',
    });
    expect(okReport.ok).toBe(true);
    const failReport = await runDoctorChecks({
      processors: [],
      env: {},
      whichBinary: async () => null,
    });
    expect(failReport.ok).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/doctor.test.ts
```
Expected: FAIL.

- [ ] **Step 3: doctor.ts 구현**

`scripts/src/doctor.ts`:

```typescript
import { execa } from 'execa';
import type { ProcessorManifest } from './lib/manifest.ts';
import type { Env } from './lib/env.ts';

export type CheckStatus = 'pass' | 'fail' | 'warn';

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: Check[];
}

export interface DoctorContext {
  processors: ProcessorManifest[];
  env: Env;
  whichBinary: (name: string) => Promise<string | null>;
}

export async function defaultWhich(name: string): Promise<string | null> {
  try {
    const { stdout } = await execa(process.platform === 'win32' ? 'where' : 'which', [name]);
    return stdout.trim().split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

export async function runDoctorChecks(ctx: DoctorContext): Promise<DoctorReport> {
  const checks: Check[] = [];

  const marpPath = await ctx.whichBinary('marp');
  checks.push({
    id: 'binary:marp',
    label: 'marp-cli installed',
    status: marpPath ? 'pass' : 'fail',
    detail: marpPath ?? 'install with: npm i -g @marp-team/marp-cli',
  });

  const seenBinaries = new Set<string>(['marp']);
  for (const proc of ctx.processors) {
    for (const bin of proc.requires?.binaries ?? []) {
      if (seenBinaries.has(bin)) continue;
      seenBinaries.add(bin);
      const found = await ctx.whichBinary(bin);
      checks.push({
        id: `binary:${bin}`,
        label: `${bin} (required by ${proc.name})`,
        status: found ? 'pass' : 'fail',
        detail: found ?? `not found in PATH; required by processor ${proc.name}`,
      });
    }
  }

  const seenEnv = new Set<string>();
  for (const proc of ctx.processors) {
    for (const key of proc.requires?.env ?? []) {
      const id = `env:${key}@${proc.name}`;
      if (seenEnv.has(id)) continue;
      seenEnv.add(id);
      const present = typeof ctx.env[key] === 'string' && ctx.env[key].length > 0;
      checks.push({
        id,
        label: `${key} (required by ${proc.name})`,
        status: present ? 'pass' : 'fail',
        detail: present ? '(redacted)' : `set ${key} in environment or project .env`,
      });
    }
  }

  for (const proc of ctx.processors) {
    if (proc.backend.type === 'mcp') {
      checks.push({
        id: `mcp:${proc.backend.server}@${proc.name}`,
        label: `MCP server "${proc.backend.server}" (required by ${proc.name})`,
        status: 'warn',
        detail: 'MCP availability is determined by Claude Code session at runtime.',
      });
    }
  }

  const ok = checks.every((c) => c.status !== 'fail');
  return { ok, checks };
}
```

- [ ] **Step 4: cli.ts에 doctor 커맨드 추가**

`scripts/src/cli.ts`의 `commands` 객체에 항목 추가:

```typescript
import { runDoctorChecks, defaultWhich } from './doctor.ts';
import { loadEnv } from './lib/env.ts';

// commands 객체에 추가:
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
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/doctor.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 6: 통합 동작 수동 확인**

```bash
cd scripts && npx tsx src/cli.ts doctor
```
Expected: marp 설치 여부에 따라 ✅ 또는 ❌ 출력.

- [ ] **Step 7: 커밋**

```bash
git add scripts/src/doctor.ts scripts/src/cli.ts scripts/tests/doctor.test.ts
git commit -m "feat(scripts): add doctor environment check and cli subcommand"
```

---

## Phase 4 — 프로젝트 부트스트랩 + 테마 관리

### Task 11: new.ts — `/slidesmith:new` 백엔드

**Files:**
- Create: `scripts/src/new.ts`
- Modify: `scripts/src/cli.ts` (add `new-project` subcommand)
- Test: `scripts/tests/new.test.ts`

스펙 §5.3에 따라 디렉토리 시드. 테마 sample 매핑은 §4.5의 fallback 규칙 따름.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/new.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { bootstrapProject } from '../src/new';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;
let pluginDir: string;

async function makeBundledTheme(name: string): Promise<void> {
  const dir = path.join(pluginDir, 'themes', name);
  await fs.ensureDir(path.join(dir, 'samples'));
  await fs.writeFile(
    path.join(dir, 'theme.yaml'),
    `name: ${name}
displayName: ${name}
version: 0.1.0
description: ''
samples:
  default: samples/sample.md
  en: samples/sample.en.md
`,
  );
  await fs.writeFile(path.join(dir, 'theme.css'), `/* @theme ${name} */`);
  await fs.writeFile(path.join(dir, 'samples', 'sample.md'), '# default sample');
  await fs.writeFile(path.join(dir, 'samples', 'sample.en.md'), '# english sample');
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-new-'));
  pluginDir = path.join(tmp, 'plugin');
  await makeBundledTheme('default');
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('bootstrapProject', () => {
  it('creates the standard project structure', async () => {
    const projectPath = path.join(tmp, 'mydeck');
    await bootstrapProject({
      name: 'mydeck',
      targetDir: projectPath,
      themeName: 'default',
      lang: 'ko',
      pluginDir,
      userHome: tmp,
    });
    expect(await fs.pathExists(path.join(projectPath, 'deck.yaml'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'blueprint.md'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'assets', 'diagrams'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'assets', 'charts'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'assets', 'images'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, '.gitignore'))).toBe(true);
  });

  it('uses sample mapped by lang when present', async () => {
    const projectPath = path.join(tmp, 'mydeck');
    await bootstrapProject({
      name: 'mydeck',
      targetDir: projectPath,
      themeName: 'default',
      lang: 'en',
      pluginDir,
      userHome: tmp,
    });
    const blueprint = await fs.readFile(path.join(projectPath, 'blueprint.md'), 'utf-8');
    expect(blueprint).toBe('# english sample');
  });

  it('falls back to default sample when lang key missing', async () => {
    const projectPath = path.join(tmp, 'mydeck');
    await bootstrapProject({
      name: 'mydeck',
      targetDir: projectPath,
      themeName: 'default',
      lang: 'jp',
      pluginDir,
      userHome: tmp,
    });
    const blueprint = await fs.readFile(path.join(projectPath, 'blueprint.md'), 'utf-8');
    expect(blueprint).toBe('# default sample');
  });

  it('writes deck.yaml with the requested theme and lang', async () => {
    const projectPath = path.join(tmp, 'mydeck');
    await bootstrapProject({
      name: 'mydeck',
      targetDir: projectPath,
      themeName: 'default',
      lang: 'en',
      pluginDir,
      userHome: tmp,
    });
    const deck = await fs.readFile(path.join(projectPath, 'deck.yaml'), 'utf-8');
    expect(deck).toMatch(/theme:\s*default/);
    expect(deck).toMatch(/language:\s*en/);
  });

  it('refuses to overwrite an existing non-empty directory', async () => {
    const projectPath = path.join(tmp, 'existing');
    await fs.ensureDir(projectPath);
    await fs.writeFile(path.join(projectPath, 'thing.txt'), 'x');
    await expect(
      bootstrapProject({
        name: 'existing',
        targetDir: projectPath,
        themeName: 'default',
        lang: 'ko',
        pluginDir,
        userHome: tmp,
      }),
    ).rejects.toThrow(/non-empty/);
  });

  it('throws when theme not found', async () => {
    await expect(
      bootstrapProject({
        name: 'mydeck',
        targetDir: path.join(tmp, 'mydeck'),
        themeName: 'nonexistent',
        lang: 'ko',
        pluginDir,
        userHome: tmp,
      }),
    ).rejects.toThrow(/theme not found/);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/new.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

`scripts/src/new.ts`:

```typescript
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
```

- [ ] **Step 4: cli.ts에 `new-project` 서브커맨드 추가**

`scripts/src/cli.ts`의 `commands`에 추가:

```typescript
import { bootstrapProject } from './new.ts';

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
```

`parseFlags` 헬퍼를 cli.ts에 추가:

```typescript
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
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/new.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 6: 커밋**

```bash
git add scripts/src/new.ts scripts/src/cli.ts scripts/tests/new.test.ts
git commit -m "feat(scripts): add project bootstrap (new-project subcommand)"
```

---

### Task 12: theme.ts — 테마 관리 (`add` / `list` / `remove` / `update`)

**Files:**
- Create: `scripts/src/theme.ts`
- Modify: `scripts/src/cli.ts` (add `theme` subcommand)
- Test: `scripts/tests/theme.test.ts`

git clone/pull로 사용자 글로벌 테마 관리.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/theme.test.ts`:

```typescript
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
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/theme.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

`scripts/src/theme.ts`:

```typescript
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
```

- [ ] **Step 4: cli.ts에 `theme` 서브커맨드 추가**

`scripts/src/cli.ts`:

```typescript
import { listThemes, addTheme, updateTheme, removeTheme } from './theme.ts';

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
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/theme.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 6: 커밋**

```bash
git add scripts/src/theme.ts scripts/src/cli.ts scripts/tests/theme.test.ts
git commit -m "feat(scripts): add theme management (list/add/update/remove/info)"
```

---

## Phase 5 — 빌드 파이프라인 스크립트

### Task 13: `detect` / `dispatch-file-ref` / `inject` / `run-processor` cli 서브커맨드

**Files:**
- Modify: `scripts/src/cli.ts`
- Test: `scripts/tests/cli-pipeline.test.ts`

기존 라이브러리 함수를 외부에서 호출할 수 있게 cli 서브커맨드로 노출.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/cli-pipeline.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;
const cliPath = path.resolve(__dirname, '..', 'src', 'cli.ts');

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-pipeline-'));
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('cli detect', () => {
  it('returns placeholders as JSON for a given output.md', async () => {
    const project = path.join(tmp, 'project');
    await fs.ensureDir(project);
    await fs.writeFile(
      path.join(project, 'output.md'),
      '# Title\n\n![hero](assets/images/h.png)\n![flow](assets/diagrams/f.mmd)\n![desc]()\n',
    );
    const { stdout } = await execa('npx', ['tsx', cliPath, 'detect', 'output.md'], {
      cwd: project,
    });
    const arr = JSON.parse(stdout);
    expect(arr).toHaveLength(3);
    expect(arr.map((p: { kind: string }) => p.kind)).toEqual(['image', 'file-ref', 'semantic']);
  });
});

describe('cli dispatch-file-ref', () => {
  it('returns matching processor name for an extension', async () => {
    const pluginDir = path.join(tmp, 'plugin');
    const procDir = path.join(pluginDir, 'prerenders', 'mermaid-cli');
    await fs.ensureDir(procDir);
    await fs.writeFile(
      path.join(procDir, 'manifest.yaml'),
      `name: mermaid-cli
provides: [diagram.mermaid]
matches: { extensions: [.mmd] }
backend: { type: cli, cmd: mmdc }
`,
    );
    const { stdout } = await execa('npx', ['tsx', cliPath, 'dispatch-file-ref', '.mmd'], {
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: tmp, SLIDESMITH_USER_HOME: tmp },
    });
    expect(JSON.parse(stdout).name).toBe('mermaid-cli');
  });

  it('returns null when no match and exits 0', async () => {
    const pluginDir = path.join(tmp, 'plugin');
    await fs.ensureDir(path.join(pluginDir, 'prerenders'));
    const { stdout } = await execa('npx', ['tsx', cliPath, 'dispatch-file-ref', '.xyz'], {
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: tmp, SLIDESMITH_USER_HOME: tmp },
    });
    expect(JSON.parse(stdout)).toBeNull();
  });
});

describe('cli inject', () => {
  it('writes prerendered.md with substitutions applied', async () => {
    const project = path.join(tmp, 'project');
    await fs.ensureDir(path.join(project, 'build', '.cache'));
    await fs.writeFile(path.join(project, 'output.md'), '![a]() ![b]()\n');
    const replacements = [
      { id: 'p1', original: '![a]()', replacement: '![a](r1.png)' },
      { id: 'p2', original: '![b]()', replacement: '![b](r2.png)' },
    ];
    await fs.writeFile(path.join(tmp, 'r.json'), JSON.stringify(replacements));
    await execa('npx', ['tsx', cliPath, 'inject', 'output.md', '--replacements', path.join(tmp, 'r.json'), '--out', 'build/.cache/prerendered.md'], { cwd: project });
    const result = await fs.readFile(path.join(project, 'build', '.cache', 'prerendered.md'), 'utf-8');
    expect(result).toBe('![a](r1.png) ![b](r2.png)\n');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/cli-pipeline.test.ts
```
Expected: FAIL.

- [ ] **Step 3: cli.ts에 새 서브커맨드 3개 추가**

```typescript
import { detectPlaceholders } from './detect.ts';
import { matchFileRef } from './dispatch.ts';
import { injectReplacements, type Replacement } from './inject.ts';
import { invokeBackend } from './lib/proc.ts';

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
    let userConfig = {};
    if (await fs.pathExists(userConfigPath)) {
      const { parse } = await import('yaml');
      userConfig = parse(await fs.readFile(userConfigPath, 'utf-8')) ?? {};
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
    const env = loadEnv(paths.projectDir, process.env);

    let input = '';
    if (flags['input-file']) {
      input = await fs.readFile(flags['input-file'], 'utf-8');
    } else if (flags.input) {
      input = flags.input;
    }

    const result = await invokeBackend({
      backend: proc.backend,
      input,
      env,
      cwd: paths.projectDir,
      httpRequestPath: flags['http-path'],
      httpMethod: (flags['http-method'] as 'GET' | 'POST') ?? 'GET',
    });

    if (result.kind === 'error') {
      console.error(`run-processor error: ${result.message}`);
      exit(2);
    }

    await fs.ensureDir(path.dirname(flags.out));
    if (result.bytes) {
      await fs.writeFile(flags.out, result.bytes);
    } else {
      await fs.writeFile(flags.out, result.stdout);
    }
    console.log(JSON.stringify({ ok: true, out: flags.out }));
  },
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/cli-pipeline.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add scripts/src/cli.ts scripts/tests/cli-pipeline.test.ts
git commit -m "feat(scripts): expose detect/dispatch-file-ref/inject/run-processor subcommands"
```

---

### Task 14: export.ts — marp-cli 호출 + theme CSS 합성

**Files:**
- Create: `scripts/src/export.ts`
- Modify: `scripts/src/cli.ts` (add `export` subcommand)
- Test: `scripts/tests/export.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/tests/export.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { combineThemeCss, buildExportArgs } from '../src/export';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-export-'));
});
afterEach(async () => {
  await fs.remove(tmp);
});

describe('combineThemeCss', () => {
  it('writes theme.css when no overrides', async () => {
    const themeCss = path.join(tmp, 'theme.css');
    await fs.writeFile(themeCss, '/* @theme x */\n.body { color: blue; }');
    const out = path.join(tmp, '_combined.css');
    await combineThemeCss(themeCss, null, out);
    const result = await fs.readFile(out, 'utf-8');
    expect(result).toContain('color: blue');
  });

  it('appends overrides after theme', async () => {
    const themeCss = path.join(tmp, 'theme.css');
    const overrides = path.join(tmp, 'overrides.css');
    await fs.writeFile(themeCss, '/* @theme x */\n.a { color: red; }');
    await fs.writeFile(overrides, '.a { color: green; }');
    const out = path.join(tmp, '_combined.css');
    await combineThemeCss(themeCss, overrides, out);
    const result = await fs.readFile(out, 'utf-8');
    const redIdx = result.indexOf('color: red');
    const greenIdx = result.indexOf('color: green');
    expect(redIdx).toBeGreaterThanOrEqual(0);
    expect(greenIdx).toBeGreaterThan(redIdx);
  });
});

describe('buildExportArgs', () => {
  it('produces one invocation per requested format', () => {
    const result = buildExportArgs({
      input: 'build/.cache/prerendered.md',
      themeCss: 'build/.cache/_theme.css',
      outBasename: 'build/deck',
      formats: ['pdf', 'html', 'pptx'],
    });
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual([
      'build/.cache/prerendered.md',
      '--theme',
      'build/.cache/_theme.css',
      '--pdf',
      '--allow-local-files',
      '-o',
      'build/deck.pdf',
    ]);
    expect(result[1][3]).toBe('--html');
    expect(result[2][3]).toBe('--pptx');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd scripts && npx vitest run tests/export.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 구현 작성**

`scripts/src/export.ts`:

```typescript
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
  return opts.formats.map((fmt) => [
    opts.input,
    '--theme',
    opts.themeCss,
    `--${fmt}`,
    '--allow-local-files',
    '-o',
    `${opts.outBasename}.${fmt}`,
  ]);
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
```

- [ ] **Step 4: cli.ts에 `export` 서브커맨드 추가**

```typescript
import { combineThemeCss, buildExportArgs, runMarpExports, type ExportFormat } from './export.ts';

  export: async (args) => {
    const flags = parseFlags(args);
    const { paths } = context();
    const input = flags.input ?? path.join(paths.projectDir, 'build', '.cache', 'prerendered.md');
    const themeCss = flags['theme-css'];
    const overrides = flags.overrides;
    const outBasename = flags['out-basename'] ?? path.join(paths.projectDir, 'build', 'deck');
    const formats = (flags.formats ?? 'pdf,html').split(',') as ExportFormat[];

    if (!themeCss) throw new Error('export requires --theme-css <path>');

    const combinedCss = path.join(paths.projectDir, 'build', '.cache', '_combined-theme.css');
    await combineThemeCss(themeCss, overrides ?? null, combinedCss);

    const invocations = buildExportArgs({
      input,
      themeCss: combinedCss,
      outBasename,
      formats,
    });

    await runMarpExports('marp', invocations, paths.projectDir);
    console.log(JSON.stringify({ ok: true, outBasename, formats }));
  },
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/export.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 6: 커밋**

```bash
git add scripts/src/export.ts scripts/src/cli.ts scripts/tests/export.test.ts
git commit -m "feat(scripts): add export pipeline (theme CSS combine + marp-cli invocation)"
```

---

## Phase 6 — 슬래시 커맨드 (LLM 진입점)

각 커맨드는 `commands/<name>.md`로 작성. 본문이 LLM이 받는 시스템 지시. 단위 테스트는 없음 (LLM 영역). 매뉴얼 검증은 Phase 9의 fixture 시나리오에서 다룬다.

### Task 15: `/slidesmith:doctor` 커맨드

**Files:**
- Create: `commands/doctor.md`

- [ ] **Step 1: 파일 작성**

`commands/doctor.md`:

```markdown
---
description: Verify slidesmith environment (marp-cli, processor binaries, env keys, MCP availability)
---

# /slidesmith:doctor

slidesmith가 정상 동작에 필요한 모든 환경 요소를 검증합니다.

## What you should do

1. 플러그인 디렉토리에서 다음을 실행:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && npx tsx src/cli.ts doctor
   ```
   (cwd가 사용자 프로젝트라면 `SLIDESMITH_PROJECT_DIR`를 그 경로로 두고 호출)

2. 결과를 사용자에게 그대로 보여줍니다 (✅/⚠️/❌ 표).

3. 실패 항목이 있으면 각 항목별 원인과 다음 행동을 한 줄씩 정리해서 안내합니다:
   - `binary:marp` 실패 → "`npm i -g @marp-team/marp-cli` 실행하세요."
   - `binary:mmdc` 실패 → "`npm i -g @mermaid-js/mermaid-cli` 실행하세요."
   - `env:PEXELS_API_KEY` 실패 → "프로젝트의 `.env`에 `PEXELS_API_KEY=...`를 추가하거나 셸 환경변수로 설정하세요."
   - `mcp:*` 경고 → 해당 MCP 서버가 현재 Claude Code 세션에서 활성인지 확인하세요.

4. 모두 ✅이면 "환경 OK. `/slidesmith:new`로 프로젝트를 시작하거나 `/slidesmith:build`로 빌드하세요." 안내.
```

- [ ] **Step 2: 커밋**

```bash
git add commands/doctor.md
git commit -m "feat(commands): add /slidesmith:doctor slash command"
```

---

### Task 16: `/slidesmith:new` 커맨드

**Files:**
- Create: `commands/new.md`

- [ ] **Step 1: 파일 작성**

`commands/new.md`:

```markdown
---
description: Bootstrap a new slidesmith project directory
argument-hint: <project-name> [--theme <theme>] [--lang <ko|en|jp>]
---

# /slidesmith:new

새 slidesmith 프로젝트 디렉토리를 만듭니다 (스펙 §5.3).

## Arguments

- `<project-name>` (필수): 만들 디렉토리 이름. 현재 cwd 기준 상대 경로.
- `--theme <name>` (선택, 기본 `default`): 사용할 테마.
- `--lang <code>` (선택, 기본 `ko`): blueprint 시드에 사용할 sample 언어.

## What you should do

1. 사용자 입력에서 인자 파싱. 누락이면 다시 묻기.

2. 테마가 사용 가능한지 사전 확인:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && npx tsx src/cli.ts theme-info <theme>
   ```
   실패하면 사용자에게 사용 가능한 테마 목록(`/slidesmith:theme list`)을 안내하고 중단.

3. 프로젝트 부트스트랩:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts new-project <name> --theme <theme> --lang <lang>
   ```

4. 성공하면 사용자에게:
   - 어떤 디렉토리가 만들어졌는지
   - 다음 행동 안내: "`<name>`으로 cd 후 `blueprint.md`를 편집하세요. 그 다음 `/slidesmith:build`로 한 번에 빌드하거나, 단계별로 `/slidesmith:plan` → `/slidesmith:prerender` → `/slidesmith:export`."

5. 실패하면 에러 메시지 그대로 보여주고 (특히 "non-empty"면 사용자가 의도한 디렉토리가 맞는지 확인).
```

- [ ] **Step 2: 커밋**

```bash
git add commands/new.md
git commit -m "feat(commands): add /slidesmith:new slash command"
```

---

### Task 17: `/slidesmith:theme` 커맨드

**Files:**
- Create: `commands/theme.md`

- [ ] **Step 1: 파일 작성**

`commands/theme.md`:

```markdown
---
description: Manage slidesmith themes (list/add/remove/update/info)
argument-hint: <list|add|remove|update|info> [args]
---

# /slidesmith:theme

테마 관리. 스펙 §9 참조.

## Subcommands

- `list` — 모든 source(번들/유저글로벌/프로젝트)의 테마 + 우선순위 표시
- `add <git-url> [--name <id>]` — git clone으로 사용자 글로벌 테마 추가 (`~/.slidesmith/themes/`)
- `update <name>` — git pull로 갱신
- `remove <name>` — 사용자 글로벌 테마 제거 (번들·프로젝트는 제거 거부)
- `info <name>` — 테마 메타데이터 표시

## What you should do

1. 첫 인자에서 서브커맨드 추출. 없으면 list로 fallback.

2. 해당 서브커맨드 호출:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts theme <sub> [args]
   ```

3. JSON 출력을 사용자에게 친화적으로 정리:
   - `list`: 표 형태로 (이름 / 위치 / 설명 / 태그)
   - `info`: 핵심 필드 + constraints 항목들 + 권장 prerenders
   - `add`/`update`/`remove`: 한 줄 결과 + 다음 단계 안내

4. `add` 실패 시 흔한 원인 안내:
   - "remote not found": git URL 오타 또는 비공개 레포
   - "cloned repo has no theme.yaml at its root": 그 레포는 slidesmith 테마가 아님
```

- [ ] **Step 2: 커밋**

```bash
git add commands/theme.md
git commit -m "feat(commands): add /slidesmith:theme slash command"
```

---

### Task 18: `/slidesmith:plan` 커맨드

**Files:**
- Create: `commands/plan.md`

이게 LLM 작업 비중이 가장 큰 커맨드. 본문에 사용자 콘텐츠 종합 + Marp 작성 가이드를 자세히 적는다.

- [ ] **Step 1: 파일 작성**

`commands/plan.md`:

```markdown
---
description: Generate output.md from blueprint, assets, and conversation
argument-hint: [--no-blueprint] [--from "직접 텍스트"]
---

# /slidesmith:plan

스펙 §6.2의 plan 단계. blueprint·assets·대화 컨텍스트를 종합해 Marp 마크다운(`output.md`)을 생성합니다.

## Pre-flight

다음 정보를 먼저 수집하세요:

1. **현재 환경에서 가용한 prerender 능력**:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts list-capabilities
   ```
   결과 JSON에서 어떤 능력(예: `diagram.mermaid`, `stock.photo`)이 사용 가능한지 파악.

2. **테마 정보**:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts theme-info "$(cat deck.yaml | grep '^theme:' | awk '{print $2}')"
   ```
   `manifest.constraints` 항목을 반드시 따를 것. `manifest.samples.default` 파일을 형식 가이드로 참고.

3. **입력 소스 (스펙 §5.4 우선순위)**:
   - `blueprint.md` 존재 → master. 다른 입력은 보충용.
   - 없으면 → `assets/` 디렉토리 내용 + 채팅 컨텍스트로 추론.
   - `--no-blueprint` 플래그가 주어졌으면 blueprint 무시.
   - `--from "텍스트"` 플래그가 주어졌으면 그 텍스트가 master.

## Generation rules

1. **테마 constraints 준수** — 위에서 가져온 `manifest.constraints`를 슬라이드 작성에 반영.

2. **prerender 컨텐츠는 모두 외부 파일** (스펙 §6.2):
   - 다이어그램: `assets/diagrams/<slug>.mmd` (또는 `.excalidraw`) 파일 만들고, output.md에는 `![설명](assets/diagrams/<slug>.mmd)` 참조만.
   - 차트: `assets/charts/<slug>.vl.json` (vega-lite 지원되는 경우).
   - 이미지가 이미 `assets/images/`에 있으면 직접 참조.
   - 이미지가 없고 생성/검색이 필요하면 semantic placeholder: `![alt 자연어 설명]()` (빈 src). prerender 단계에서 `image.generate` 또는 `stock.photo` 능력으로 dispatch됨.
   - **인라인 코드블록(` ```mermaid ` 등)에 다이어그램 소스를 넣지 말 것**. detect가 무시하므로 렌더되지 않음.

3. **언어**: `deck.yaml`의 `language` 필드를 따름 (기본 한국어). slide 본문, 제목, alt 텍스트 모두 그 언어로.

4. **Marp frontmatter** (output.md 맨 위):
   ```yaml
   ---
   marp: true
   theme: <theme-name from deck.yaml>
   paginate: true
   ---
   ```

5. **모호한 입력** — blueprint·자료가 빈약해서 합리적 추론이 어려우면 짧은 질문 1~2개로 사용자 확인. 가정으로 진행할 때는 슬라이드 frontmatter에 `# TODO: <가정 내용>` HTML 주석으로 남길 것.

## Write rules

1. 기존 `output.md`가 있으면 사용자에게 덮어쓸지 명시적으로 확인 (스펙 §2.1 사용자 영역 보호).

2. 새 컨텐츠를 `output.md`에 작성 (Write 도구).

3. 다이어그램 소스 파일도 같이 작성 (Write 도구).

4. 작성 끝나면 사용자에게:
   - 슬라이드 개수
   - 만든 다이어그램/소스 파일 목록
   - 사용된 semantic placeholder 개수 (prerender 단계에서 채워질 것)
   - 다음 단계 안내: "`/slidesmith:prerender`로 placeholder 변환을 진행하세요."
```

- [ ] **Step 2: 커밋**

```bash
git add commands/plan.md
git commit -m "feat(commands): add /slidesmith:plan slash command"
```

---

### Task 19: `/slidesmith:prerender` 커맨드

**Files:**
- Create: `commands/prerender.md`

- [ ] **Step 1: 파일 작성**

`commands/prerender.md`:

```markdown
---
description: Detect placeholders in output.md, dispatch processors, write build/.cache/prerendered.md
---

# /slidesmith:prerender

스펙 §6.3의 prerender 단계. `output.md` → `build/.cache/prerendered.md` (placeholder들 변환됨).

## Process

### 1. Pre-flight check

```bash
cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
  SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts doctor
```

`fail` 항목이 있으면 즉시 중단하고 사용자에게 안내. `warn`(예: MCP)는 계속 진행하되 사용자에게 알림.

### 2. Placeholder 탐지

```bash
cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
  SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts detect output.md > /tmp/placeholders.json
```

JSON 배열을 받습니다. 각 항목은 `{id, kind, line, ...}`.

### 3. 각 placeholder별 dispatch

`/tmp/placeholders.json`을 읽고 (JSON parse), 다음 규칙으로 처리:

- **`kind: image`** → 통과 (변환 없음). replacements 배열에 추가하지 않음.

- **`kind: file-ref`** → 결정적 dispatch:
  ```bash
  cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
    SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts dispatch-file-ref "<ext>"
  ```
  결과 JSON이 `null`이면 매칭 프로세서 없음 → 경고 출력 + 그 placeholder 보존(replacement 안 만듦). 결과가 객체면 그 프로세서 이름으로 호출:
  ```bash
  cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
    SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts run-processor \
      --name <processor-name> \
      --input-file "<placeholder.path>" \
      --out "build/.cache/svg/<placeholder.id>.svg"
  ```
  성공 시 replacement: 원래 `![alt](path)`를 `![alt](build/.cache/svg/<id>.svg)`로 바꿈.

- **`kind: semantic`** → LLM judgment dispatch:
  1. `list-capabilities` 결과 확인 (1단계에서 이미 doctor가 검증).
  2. placeholder의 `alt` 텍스트를 보고 적합한 능력 결정:
     - "차트", "그래프" → `chart.*`
     - "다이어그램", "플로우" → `diagram.*`
     - "고양이/사진/실사" → `stock.photo`
     - "일러스트/생성/추상" → `image.generate`
  3. 그 능력의 등록된 프로세서 중 하나 선택 (`list-capabilities`의 `providers[0]` 추천).
  4. 능력별로 호출 인자 구성:
     - `stock.photo` (pexels): `--http-path "/search?query=<encoded query>"` + 결과 JSON에서 첫 번째 사진 URL 다운로드 (별도 단계). 또는 직접 다운로드 호출.
     - `image.generate` (gemini-image): `--http-method POST --input "<prompt>"` + 응답 디코딩.
     - `diagram.*` (mermaid-cli): 먼저 LLM이 mermaid 소스 문자열을 만들어 `assets/diagrams/auto-<id>.mmd`에 저장 → 그 다음 file-ref와 동일한 흐름으로 SVG 변환. 사용자가 나중에 output.md에서 `![alt](assets/diagrams/auto-<id>.mmd)`로 락인할 수 있음.
  5. 호출 결과(이미지 또는 SVG)를 `build/.cache/img/<id>.<ext>` 또는 `build/.cache/svg/<id>.svg`에 저장.
  6. replacement: 원래 `![alt]()`를 `![alt](build/.cache/img/<id>.<ext>)`로 바꿈.

### 4. Inject

성공한 replacement들을 모아 JSON 배열로 만든 뒤:

```bash
cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
  SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts inject output.md \
    --replacements "/tmp/replacements.json" \
    --out "build/.cache/prerendered.md"
```

### 5. Report

사용자에게 보고:
- 처리된 placeholder 수: N
- 통과한 일반 이미지: M
- 실패/스킵된 placeholder: K (각각 어떤 ID, line, 이유)
- 다음 단계 안내: "`/slidesmith:export`로 PDF/HTML 생성하세요."

## Failure policy (스펙 §10.1)

- 개별 placeholder 실패 시 retry 1회 → 그래도 실패하면 그 placeholder는 그대로 두고 (replacement 추가 안 함) 계속 진행.
- 매칭 프로세서 0건이면 silent skip 절대 금지 — 경고 출력.
- doctor light check가 실패하면 prerender 시작 전에 중단.
- output.md / blueprint.md / assets/ 는 절대 수정 안 함 (semantic dispatch에서 새로 만드는 `assets/diagrams/auto-<id>.mmd`는 *생성*이므로 허용, 기존 파일 덮어쓰기는 금지).
```

- [ ] **Step 2: 커밋**

```bash
git add commands/prerender.md
git commit -m "feat(commands): add /slidesmith:prerender slash command"
```

---

### Task 20: `/slidesmith:export` 커맨드

**Files:**
- Create: `commands/export.md`

- [ ] **Step 1: 파일 작성**

`commands/export.md`:

```markdown
---
description: Run marp-cli on prerendered.md to produce PDF/HTML/PPTX in build/
---

# /slidesmith:export

스펙 §6.4의 export 단계. 결정적 작업이라 LLM은 호출만.

## Process

1. `deck.yaml`을 읽어 `theme`, `formats`, `output.basename`, `overrides.css` 추출.

2. 테마 경로 해석:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts theme-info "<theme>"
   ```
   결과 JSON의 `path` 필드에서 `theme.css` 위치 = `<path>/theme.css`.

3. `build/.cache/prerendered.md`가 존재하는지 확인. 없으면 사용자에게 "먼저 `/slidesmith:prerender`를 실행하세요." 안내.

4. export 실행:
   ```bash
   cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
     SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts export \
       --input "$PWD/build/.cache/prerendered.md" \
       --theme-css "<theme.css 경로>" \
       --overrides "$PWD/overrides.css" \
       --out-basename "$PWD/build/<basename from deck.yaml>" \
       --formats "<formats from deck.yaml>"
   ```
   `overrides.css`가 없으면 `--overrides` 인자 생략.

5. 사용자에게 결과 파일 목록 보고: `build/deck.pdf`, `build/deck.html` 등.

## Failure handling

- marp 실행 실패 → marp의 stderr 그대로 보여주기
- 테마 CSS 누락 → 어느 경로에서 찾았는지 알려주고 테마 설치 상태 안내
```

- [ ] **Step 2: 커밋**

```bash
git add commands/export.md
git commit -m "feat(commands): add /slidesmith:export slash command"
```

---

### Task 21: `/slidesmith:build` 커맨드 (wrapper)

**Files:**
- Create: `commands/build.md`

- [ ] **Step 1: 파일 작성**

`commands/build.md`:

```markdown
---
description: Run plan + prerender + export sequentially
argument-hint: [--from plan|prerender|export]
---

# /slidesmith:build

`/slidesmith:plan` → `/slidesmith:prerender` → `/slidesmith:export`를 순서대로 실행.

## Arguments

- `--from <stage>` (선택): 어디서부터 다시 실행할지. 기본은 `plan`. 값: `plan`, `prerender`, `export`.

## Process

1. `--from prerender`이면 plan 단계 건너뜀. `output.md`가 없으면 사용자에게 "먼저 plan부터 실행하세요." 안내 후 중단.

2. `--from export`이면 plan + prerender 모두 건너뜀. `build/.cache/prerendered.md`가 없으면 안내 후 중단.

3. 각 단계 시작 전에 진행 상황 한 줄 출력:
   - "🎨 plan 단계 시작..."
   - "🔧 prerender 단계 시작..."
   - "📦 export 단계 시작..."

4. 각 단계는 해당 슬래시 커맨드의 본문 절차 그대로 실행. (즉, build는 다른 커맨드를 *호출*하는 게 아니라 그 절차를 인라인으로 수행)

5. 어느 단계에서든 실패하면 즉시 중단. 어느 단계에서 실패했는지 명확히 알리고 그 단계의 failure handling 안내.

6. 모든 단계 성공 시 사용자에게 최종 결과물 경로(`build/deck.pdf` 등) 보고.
```

- [ ] **Step 2: 커밋**

```bash
git add commands/build.md
git commit -m "feat(commands): add /slidesmith:build wrapper slash command"
```

---

## Phase 7 — 번들 프로세서 매니페스트

각 프로세서는 `prerenders/<name>/manifest.yaml` 한 파일. 별도 핸들러 없이 cli adapter로 충분.

### Task 22: mermaid-cli 매니페스트

**Files:**
- Create: `prerenders/mermaid-cli/manifest.yaml`

- [ ] **Step 1: 파일 작성**

`prerenders/mermaid-cli/manifest.yaml`:

```yaml
name: mermaid-cli
provides: [diagram.mermaid]
matches:
  extensions: [.mmd, .mermaid]
backend:
  type: cli
  cmd: mmdc
  args:
    - "-i"
    - "{input-file}"
    - "-o"
    - "{output}"
    - "--quiet"
requires:
  binaries: [mmdc]
priority: 50
```

> **Note**: 현재 `lib/proc.ts`의 cli 어댑터는 `args` 배열을 그대로 전달한다. `{input-file}`/`{output}` 토큰 치환 로직은 cli.ts의 `run-processor`에서 처리해야 한다 — Task 13의 구현을 보강할 필요 있음.

- [ ] **Step 2: cli.ts `run-processor`에 토큰 치환 추가**

기존 `run-processor` 핸들러에서 `proc.backend`가 `cli` 타입이고 `args`가 있을 때, args 안의 `{input-file}`, `{output}`, `{input}` 토큰을 실제 값으로 치환한 새 backend를 구성해 invokeBackend 호출:

```typescript
  'run-processor': async (args) => {
    // ... (기존 부분) ...
    let backend = proc.backend;
    if (backend.type === 'cli' && backend.args) {
      const tokens: Record<string, string> = {
        '{input-file}': flags['input-file'] ?? '',
        '{output}': flags.out,
        '{input}': flags.input ?? '',
      };
      backend = {
        ...backend,
        args: backend.args.map((a) => tokens[a] !== undefined ? tokens[a] : a),
      };
    }
    const result = await invokeBackend({
      backend,
      input,
      env,
      cwd: paths.projectDir,
      // ...
    });
    // ... (기존 마무리) ...
  },
```

- [ ] **Step 3: cli-pipeline 테스트에 토큰 치환 케이스 추가**

`scripts/tests/cli-pipeline.test.ts`에 추가:

```typescript
describe('cli run-processor (cli backend with token args)', () => {
  it('substitutes {output} token in args', async () => {
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-rp-'));
    const pluginDir = path.join(tmp2, 'plugin');
    const procDir = path.join(pluginDir, 'prerenders', 'echoer');
    await fs.ensureDir(procDir);
    await fs.writeFile(
      path.join(procDir, 'manifest.yaml'),
      `name: echoer
provides: [test.echo]
matches: {}
backend:
  type: cli
  cmd: node
  args: ["-e", "require('fs').writeFileSync(process.argv[1], 'hello')", "{output}"]
priority: 50
`,
    );
    const outFile = path.join(tmp2, 'out.txt');
    await execa('npx', ['tsx', cliPath, 'run-processor', '--name', 'echoer', '--out', outFile], {
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: tmp2, SLIDESMITH_USER_HOME: tmp2 },
    });
    const content = await fs.readFile(outFile, 'utf-8');
    expect(content).toBe('hello');
    await fs.remove(tmp2);
  });
});
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/cli-pipeline.test.ts
```
Expected: PASS (5 tests, 새 케이스 포함).

- [ ] **Step 5: 커밋**

```bash
git add prerenders/mermaid-cli/manifest.yaml scripts/src/cli.ts scripts/tests/cli-pipeline.test.ts
git commit -m "feat(prerenders): add mermaid-cli processor manifest with cli token substitution"
```

---

### Task 23: excalidraw-mcp 매니페스트

**Files:**
- Create: `prerenders/excalidraw-mcp/manifest.yaml`

- [ ] **Step 1: 파일 작성**

`prerenders/excalidraw-mcp/manifest.yaml`:

```yaml
name: excalidraw-mcp
provides: [diagram.excalidraw]
matches:
  extensions: [.excalidraw]
backend:
  type: mcp
  server: excalidraw
  tool: render_to_svg
requires:
  mcp: [excalidraw]
priority: 50
```

> **Note**: MCP 백엔드는 `lib/proc.ts`에서 명시적 에러 반환. 실제 호출은 `/slidesmith:prerender` 커맨드 본문에서 LLM이 Claude Code의 MCP 도구를 직접 호출해 처리한다. 매니페스트는 doctor와 dispatch에서만 의미 있음.

- [ ] **Step 2: prerender 커맨드 본문 보강 (excalidraw 특수 케이스 안내)**

`commands/prerender.md`의 "각 placeholder별 dispatch" 섹션 끝에 추가:

```markdown
### MCP 백엔드 특수 처리

`backend.type: mcp`인 프로세서가 매칭되면 (예: excalidraw-mcp) `run-processor` 스크립트는 그 호출을 처리하지 못합니다. 대신 LLM이 Claude Code의 해당 MCP 도구를 직접 호출:

1. `dispatch-file-ref` 결과의 `backend` 필드 확인.
2. `backend.type === 'mcp'`이면 → 그 `server`/`tool`을 Claude Code의 MCP 도구로 직접 호출 (예: excalidraw 서버의 `render_to_svg` 도구).
3. 결과 SVG 바이트를 `build/.cache/svg/<id>.svg`에 저장.
4. 이후 흐름은 cli 백엔드와 동일 (replacement 추가).

MCP 서버가 현재 세션에 떠있지 않으면 doctor가 ⚠️로 경고했을 것이므로 그 경고를 사용자에게 환기하고 해당 placeholder는 보존(스킵).
```

- [ ] **Step 3: 커밋**

```bash
git add prerenders/excalidraw-mcp/manifest.yaml commands/prerender.md
git commit -m "feat(prerenders): add excalidraw-mcp processor manifest and MCP dispatch guidance"
```

---

### Task 24: pexels 매니페스트

**Files:**
- Create: `prerenders/pexels/manifest.yaml`

- [ ] **Step 1: 파일 작성**

`prerenders/pexels/manifest.yaml`:

```yaml
name: pexels
provides: [stock.photo]
matches: {}
backend:
  type: http
  base: https://api.pexels.com/v1
  auth: header:Authorization:{env.PEXELS_API_KEY}
requires:
  env: [PEXELS_API_KEY]
priority: 60
```

> **Note**: pexels는 search API → 결과 JSON에서 사진 URL 추출 → 다운로드의 2-step 흐름. cli의 `run-processor`는 1회 HTTP 호출만 한다. prerender 커맨드 본문에서 LLM이 다음 절차로 처리:
>   1. `run-processor --name pexels --http-path "/search?query=<encoded>&per_page=1" --out /tmp/p.json`
>   2. `/tmp/p.json` 파싱 → `photos[0].src.large` URL 획득
>   3. 그 URL을 다시 `run-processor` 또는 단순 fetch로 다운로드 → `build/.cache/img/<id>.jpg`

- [ ] **Step 2: prerender 커맨드 본문 보강 (pexels 흐름 안내)**

`commands/prerender.md`의 "각 placeholder별 dispatch" → "kind: semantic" → "stock.photo (pexels)" 항목을 다음으로 교체:

```markdown
- `stock.photo` via pexels:
  1. 검색:
     ```bash
     cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
       SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts run-processor \
         --name pexels \
         --http-path "/search?query=$(echo '<alt 자연어>' | jq -sRr @uri)&per_page=1" \
         --out "/tmp/pexels-<id>.json"
     ```
  2. 결과 JSON 읽고 `photos[0].src.large` URL 추출.
  3. 그 URL을 다운로드 (Bash `curl -L "$URL" -o build/.cache/img/<id>.jpg` 또는 별도 fetch). 인증 헤더는 다운로드엔 불필요.
```

- [ ] **Step 3: 커밋**

```bash
git add prerenders/pexels/manifest.yaml commands/prerender.md
git commit -m "feat(prerenders): add pexels stock photo processor manifest"
```

---

### Task 25: gemini-image 매니페스트

**Files:**
- Create: `prerenders/gemini-image/manifest.yaml`

- [ ] **Step 1: 파일 작성**

`prerenders/gemini-image/manifest.yaml`:

```yaml
name: gemini-image
provides: [image.generate]
matches: {}
backend:
  type: http
  base: https://generativelanguage.googleapis.com/v1beta
  auth: header:x-goog-api-key:{env.GEMINI_API_KEY}
requires:
  env: [GEMINI_API_KEY]
priority: 50
```

- [ ] **Step 2: prerender 커맨드 본문 보강 (gemini-image 흐름 안내)**

`commands/prerender.md`의 "image.generate (gemini-image)" 항목 교체:

```markdown
- `image.generate` via gemini-image:
  1. POST 요청 페이로드를 LLM이 구성 (Gemini 이미지 생성 API 스펙 따라 — Imagen 또는 Gemini 2.x image preview 모델):
     ```json
     {"contents":[{"parts":[{"text":"<alt 자연어>"}]}]}
     ```
  2. 호출:
     ```bash
     cd "$CLAUDE_PLUGIN_ROOT/scripts" && \
       SLIDESMITH_PROJECT_DIR="$PWD" npx tsx src/cli.ts run-processor \
         --name gemini-image \
         --http-method POST \
         --http-path "/models/<model>:generateContent" \
         --input '<위 JSON>' \
         --out "/tmp/gemini-<id>.json"
     ```
  3. 응답 JSON에서 base64 이미지 데이터 디코딩 → `build/.cache/img/<id>.png` 저장 (디코딩은 Bash 또는 LLM이 처리).
  4. 호출 실패 시 retry 1회 후 placeholder 보존 (스펙 §10.1).
```

- [ ] **Step 3: 커밋**

```bash
git add prerenders/gemini-image/manifest.yaml commands/prerender.md
git commit -m "feat(prerenders): add gemini-image generation processor manifest"
```

---

## Phase 8 — 번들 테마

각 테마는 `themes/<name>/`에 `theme.yaml`, `theme.css`, `samples/sample.{md,en.md,jp.md}`, `README.md` 5개. 한 task = 한 테마.

### Task 26: `default` 테마

**Files:**
- Create: `themes/default/theme.yaml`
- Create: `themes/default/theme.css`
- Create: `themes/default/samples/sample.md`
- Create: `themes/default/samples/sample.en.md`
- Create: `themes/default/samples/sample.jp.md`
- Create: `themes/default/README.md`

- [ ] **Step 1: `theme.yaml` 작성**

```yaml
name: default
displayName: Default
version: 0.1.0
author: slidesmith
description: 깔끔한 일반 발표용 — 어떤 주제에든 무난하게 어울리는 중립 톤.
tags: [neutral, clean, general]
fits: [general-talk, internal-update]
constraints:
  - "h1은 슬라이드 제목으로 사용 (한 슬라이드당 1개)"
  - "h2는 슬라이드 내 섹션 헤더"
  - "리스트는 3~5 항목 권장 (텍스트 과밀 방지)"
samples:
  default: samples/sample.md
  en: samples/sample.en.md
  jp: samples/sample.jp.md
recommendedPrerenders:
  - mermaid-cli
```

- [ ] **Step 2: `theme.css` 작성**

```css
/* @theme default */

@import 'default';

:root {
  --color-bg: #ffffff;
  --color-fg: #1f2328;
  --color-accent: #d97706;
  --color-muted: #6b7280;
  --font-sans: 'Inter', 'Noto Sans KR', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

section {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-sans);
  padding: 64px 80px;
  font-size: 28px;
  line-height: 1.5;
}

h1 {
  color: var(--color-fg);
  font-size: 56px;
  font-weight: 700;
  margin: 0 0 32px;
  letter-spacing: -0.01em;
}

h2 {
  color: var(--color-accent);
  font-size: 36px;
  font-weight: 600;
  margin: 24px 0 16px;
}

h3 { font-size: 28px; font-weight: 600; }

a { color: var(--color-accent); }

code, pre {
  font-family: var(--font-mono);
  background: #f6f8fa;
  border-radius: 6px;
}

code { padding: 2px 6px; font-size: 0.85em; }
pre { padding: 16px; font-size: 22px; line-height: 1.4; }

blockquote {
  border-left: 4px solid var(--color-accent);
  color: var(--color-muted);
  margin: 16px 0;
  padding-left: 16px;
}

table {
  border-collapse: collapse;
  margin: 16px 0;
}
th, td {
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
}
th { background: #f6f8fa; font-weight: 600; }

img { max-width: 100%; border-radius: 8px; }

footer {
  position: absolute;
  bottom: 24px;
  left: 80px;
  right: 80px;
  font-size: 16px;
  color: var(--color-muted);
}
```

- [ ] **Step 3: `samples/sample.md` (한국어)**

```markdown
---
marp: true
theme: default
paginate: true
---

# 발표 제목

부제 또는 발표자 소개

---

## 목차

1. 도입 — 문제 제기
2. 본론 — 해결 아이디어
3. 결론 — 다음 단계

---

## 핵심 메시지

이 한 문장이 청중에게 남아야 합니다.

> 인용으로 강조하면 시선이 모입니다.

---

## 데이터 한 장

| 지표 | Q3 | Q4 |
|---|---:|---:|
| 사용자 | 12k | 18k |
| 전환율 | 2.1% | 3.4% |

---

## 다음 단계

- 가까운 행동 1
- 가까운 행동 2
- 의사결정이 필요한 항목 1개
```

- [ ] **Step 4: `samples/sample.en.md` (영어)**

```markdown
---
marp: true
theme: default
paginate: true
---

# Presentation Title

Subtitle or speaker bio

---

## Agenda

1. Setup — the problem
2. Body — the idea
3. Wrap — next steps

---

## Core Message

One sentence the audience should remember.

> Quote it for emphasis.

---

## One Chart

| Metric | Q3 | Q4 |
|---|---:|---:|
| Users | 12k | 18k |
| Conv. | 2.1% | 3.4% |

---

## Next Steps

- Near action 1
- Near action 2
- One decision needed
```

- [ ] **Step 5: `samples/sample.jp.md` (일본어)**

```markdown
---
marp: true
theme: default
paginate: true
---

# プレゼンタイトル

サブタイトル / 発表者紹介

---

## 目次

1. 導入 — 問題提起
2. 本論 — 解決アイデア
3. 結論 — 次の一歩

---

## コアメッセージ

この一文が聴衆に残るべきです。

> 引用で強調すると視線が集まります。

---

## データ一枚

| 指標 | Q3 | Q4 |
|---|---:|---:|
| ユーザー | 12k | 18k |
| 転換率 | 2.1% | 3.4% |

---

## 次のステップ

- 近接行動 1
- 近接行動 2
- 意思決定が必要な項目
```

- [ ] **Step 6: `README.md`**

```markdown
# default theme

slidesmith 기본 테마. 중립적이고 어떤 주제에든 잘 어울립니다.

- 폰트: Inter (없으면 system-ui)
- 색상: 화이트 배경 + 오렌지 액센트
- 권장 사용처: 사내 발표, 정기 업데이트, 일반 강연

특수 제약 없음. h1=제목, h2=섹션, 리스트는 3~5 항목 권장.
```

- [ ] **Step 7: 커밋**

```bash
git add themes/default/
git commit -m "feat(themes): add default theme with three-language samples"
```

---

### Task 27: `midnight-tech` 테마

**Files:**
- Create: `themes/midnight-tech/theme.yaml`
- Create: `themes/midnight-tech/theme.css`
- Create: `themes/midnight-tech/samples/sample.md`
- Create: `themes/midnight-tech/samples/sample.en.md`
- Create: `themes/midnight-tech/samples/sample.jp.md`
- Create: `themes/midnight-tech/README.md`

- [ ] **Step 1: `theme.yaml`**

```yaml
name: midnight-tech
displayName: Midnight Tech
version: 0.1.0
author: slidesmith
description: 다크 톤의 기술 발표용 — 코드 블록과 다이어그램을 강조.
tags: [technical, dark, code-heavy]
fits: [technical-talk, code-walkthrough, architecture-review]
constraints:
  - "h1은 슬라이드 제목으로 사용 (한 슬라이드당 1개)"
  - "h2는 섹션 분기 — 본문이 길어지면 슬라이드를 나눌 것"
  - "code block은 라인 넘버 자동 — 30줄 초과 시 가독성 저하"
  - "다이어그램은 mermaid (`assets/diagrams/*.mmd`) 또는 excalidraw 권장"
samples:
  default: samples/sample.md
  en: samples/sample.en.md
  jp: samples/sample.jp.md
recommendedPrerenders:
  - mermaid-cli
  - excalidraw-mcp
```

- [ ] **Step 2: `theme.css`**

```css
/* @theme midnight-tech */

@import 'default';

:root {
  --color-bg: #0d1117;
  --color-fg: #e6edf3;
  --color-accent: #58a6ff;
  --color-accent-2: #7ee787;
  --color-muted: #8b949e;
  --color-border: #30363d;
  --color-code-bg: #161b22;
  --font-sans: 'Inter', 'Noto Sans KR', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
}

section {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-sans);
  padding: 64px 80px;
  font-size: 28px;
  line-height: 1.5;
}

h1 {
  color: var(--color-fg);
  font-size: 56px;
  font-weight: 700;
  margin: 0 0 32px;
  letter-spacing: -0.01em;
}

h1::before {
  content: '> ';
  color: var(--color-accent);
}

h2 {
  color: var(--color-accent);
  font-size: 36px;
  font-weight: 600;
  margin: 24px 0 16px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}

h3 { color: var(--color-accent-2); font-size: 28px; font-weight: 600; }

a { color: var(--color-accent); }

code {
  font-family: var(--font-mono);
  background: var(--color-code-bg);
  color: var(--color-accent-2);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}

pre {
  font-family: var(--font-mono);
  background: var(--color-code-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  font-size: 20px;
  line-height: 1.5;
  counter-reset: line;
}

pre code {
  background: transparent;
  color: var(--color-fg);
  padding: 0;
}

pre code .line {
  counter-increment: line;
}
pre code .line::before {
  content: counter(line);
  color: var(--color-muted);
  display: inline-block;
  width: 2em;
  margin-right: 1em;
  text-align: right;
}

blockquote {
  border-left: 4px solid var(--color-accent);
  color: var(--color-muted);
  font-style: italic;
}

table { border-collapse: collapse; }
th, td { border: 1px solid var(--color-border); padding: 8px 12px; }
th { background: var(--color-code-bg); color: var(--color-accent); }

img {
  max-width: 100%;
  border-radius: 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
}

footer {
  position: absolute;
  bottom: 24px;
  left: 80px;
  right: 80px;
  font-size: 16px;
  color: var(--color-muted);
}
```

- [ ] **Step 3: `samples/sample.md` (한국어)**

```markdown
---
marp: true
theme: midnight-tech
paginate: true
---

# 시스템 아키텍처 리뷰

플랫폼 팀 / 2026 Q1

---

## 컨텍스트

- 트래픽 4배 증가 → 기존 모놀리스가 한계
- 결제 모듈에서 p99 지연 8s 관측
- 목표: p99 < 1s, 무중단 배포

---

## 현재 흐름

![signup flow](assets/diagrams/signup-flow.mmd)

병목: 모듈 간 동기 호출 체인.

---

## 제안: 비동기 분리

```typescript
// before
await chargeCard(orderId);
await sendReceipt(orderId);

// after
await queue.publish('order.charged', orderId);
// receipt is consumed elsewhere
```

이벤트 큐를 통한 fire-and-forget.

---

## 트레이드오프

| 측면 | 현재 | 제안 |
|---|---|---|
| 일관성 | 강 | 결과적 |
| 지연 | 느림 | 빠름 |
| 운영 부하 | 낮음 | 중간 |

---

## 다음 단계

1. 결제 모듈만 우선 분리 (1주)
2. 큐 SLA 정의 (3일)
3. 단계적 rollout (5%, 25%, 100%)
```

- [ ] **Step 4: `samples/sample.en.md`**

```markdown
---
marp: true
theme: midnight-tech
paginate: true
---

# System Architecture Review

Platform Team / 2026 Q1

---

## Context

- Traffic up 4× — monolith hitting limits
- p99 latency 8s on payments
- Goal: p99 < 1s, zero-downtime deploys

---

## Current Flow

![signup flow](assets/diagrams/signup-flow.mmd)

Bottleneck: synchronous chains across modules.

---

## Proposal: Async Split

```typescript
// before
await chargeCard(orderId);
await sendReceipt(orderId);

// after
await queue.publish('order.charged', orderId);
// receipt is consumed elsewhere
```

Fire-and-forget via event queue.

---

## Trade-offs

| Aspect | Now | Proposed |
|---|---|---|
| Consistency | Strong | Eventual |
| Latency | Slow | Fast |
| Ops | Low | Medium |

---

## Next Steps

1. Split payment module first (1 week)
2. Define queue SLA (3 days)
3. Phased rollout (5%, 25%, 100%)
```

- [ ] **Step 5: `samples/sample.jp.md`**

```markdown
---
marp: true
theme: midnight-tech
paginate: true
---

# システムアーキテクチャレビュー

プラットフォームチーム / 2026 Q1

---

## コンテキスト

- トラフィック 4倍 → モノリスの限界
- 決済モジュールで p99 8秒
- 目標: p99 < 1s、無停止デプロイ

---

## 現状フロー

![signup flow](assets/diagrams/signup-flow.mmd)

ボトルネック: モジュール間の同期チェーン。

---

## 提案: 非同期化

```typescript
// before
await chargeCard(orderId);
await sendReceipt(orderId);

// after
await queue.publish('order.charged', orderId);
```

イベントキュー経由の fire-and-forget。

---

## トレードオフ

| 観点 | 現在 | 提案 |
|---|---|---|
| 一貫性 | 強 | 結果整合 |
| レイテンシ | 遅 | 速 |
| 運用負荷 | 低 | 中 |

---

## 次のステップ

1. 決済モジュールだけ先行分離 (1週)
2. キューの SLA 定義 (3日)
3. 段階的ロールアウト
```

- [ ] **Step 6: `README.md`**

```markdown
# midnight-tech theme

기술 발표 / 코드 워크스루 / 아키텍처 리뷰용 다크 테마.

- 폰트: Inter + JetBrains Mono
- 배경 #0d1117 + 액센트 #58a6ff (블루) + #7ee787 (그린)
- h1 앞에 `> ` 프롬프트 데코, 코드 블록 라인 번호 (CSS counter)

다이어그램은 mermaid 또는 excalidraw 사용 권장 — 그렇게 해야 다크 배경에 어울리는 색감으로 자동 처리됩니다.
```

- [ ] **Step 7: 커밋**

```bash
git add themes/midnight-tech/
git commit -m "feat(themes): add midnight-tech dark theme for technical talks"
```

---

### Task 28: `editorial` 테마

**Files:**
- Create: `themes/editorial/theme.yaml`
- Create: `themes/editorial/theme.css`
- Create: `themes/editorial/samples/sample.md`
- Create: `themes/editorial/samples/sample.en.md`
- Create: `themes/editorial/samples/sample.jp.md`
- Create: `themes/editorial/README.md`

- [ ] **Step 1: `theme.yaml`**

```yaml
name: editorial
displayName: Editorial
version: 0.1.0
author: slidesmith
description: 텍스트 중심 발표 / 리포트 / 책 같은 인쇄물 톤.
tags: [light, text-heavy, editorial, serif]
fits: [keynote, narrative-report, book-style]
constraints:
  - "h1은 표지 또는 챕터 제목 (큰 비중 차지)"
  - "h2는 섹션 표제. 본문 단락이 핵심"
  - "이미지보다 단락이 우선. 한 슬라이드 100~200자 권장"
samples:
  default: samples/sample.md
  en: samples/sample.en.md
  jp: samples/sample.jp.md
recommendedPrerenders: []
```

- [ ] **Step 2: `theme.css`**

```css
/* @theme editorial */

@import 'default';

:root {
  --color-bg: #fbf8f1;
  --color-fg: #2b2826;
  --color-accent: #8c1c13;
  --color-muted: #7a6f64;
  --font-serif: 'Source Serif Pro', 'Noto Serif KR', Georgia, serif;
  --font-sans: 'Inter', 'Noto Sans KR', system-ui, sans-serif;
}

section {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-serif);
  padding: 80px 120px;
  font-size: 26px;
  line-height: 1.7;
}

h1 {
  font-family: var(--font-serif);
  color: var(--color-fg);
  font-size: 60px;
  font-weight: 700;
  margin: 0 0 16px;
  letter-spacing: -0.02em;
}

h1 + p,
h1 + .subtitle {
  color: var(--color-muted);
  font-style: italic;
  font-size: 28px;
  margin-top: 0;
}

h2 {
  font-family: var(--font-serif);
  color: var(--color-accent);
  font-size: 36px;
  font-weight: 600;
  margin: 32px 0 16px;
}

p { margin: 12px 0; }

a { color: var(--color-accent); text-decoration: underline; }

blockquote {
  border-left: 3px solid var(--color-accent);
  color: var(--color-fg);
  font-style: italic;
  margin: 24px 0;
  padding: 0 24px;
  font-size: 28px;
  line-height: 1.6;
}

code, pre {
  font-family: 'JetBrains Mono', monospace;
  background: #f0eadc;
  border-radius: 4px;
}

img { max-width: 100%; }

footer {
  position: absolute;
  bottom: 32px;
  left: 120px;
  right: 120px;
  font-family: var(--font-sans);
  font-size: 16px;
  color: var(--color-muted);
  border-top: 1px solid var(--color-muted);
  padding-top: 8px;
}
```

- [ ] **Step 3-5: 샘플 3개 (한/영/일)**

`samples/sample.md`:

```markdown
---
marp: true
theme: editorial
paginate: true
---

# 신뢰의 경제학

장기 관계가 어떻게 단기 거래를 이긴다

---

## 거래 vs 관계

거래는 한 번이고 끝나며, 관계는 반복된다.

반복 게임에서 신뢰는 비용이 아니라 자본이다. 누적될수록 거래 비용이 줄고, 한 번의 실수가 갖는 무게는 커진다.

> 가장 비싼 협상은 신뢰가 깨진 뒤 시작된다.

---

## 세 가지 관찰

작은 약속을 지키는 사람은 큰 약속도 지킨다. 모든 약속이 같은 회로에서 흐르기 때문이다.

신뢰는 비대칭이다 — 쌓는 데 1년, 잃는 데 10초.

투명성이 신뢰를 만들지 않는다. 일관성이 만든다.

---

## 적용

매주의 작은 약속이 분기의 큰 거래를 결정한다.

이 발표가 끝나는 순간, 첫 번째 작은 약속을 정하라.
```

`samples/sample.en.md`:

```markdown
---
marp: true
theme: editorial
paginate: true
---

# The Economics of Trust

How long relationships beat short transactions

---

## Transaction vs. Relationship

A transaction ends. A relationship repeats.

In repeated games, trust is not a cost — it's capital. It accrues; transaction costs fall; the weight of a single mistake grows.

> The most expensive negotiation begins after trust is broken.

---

## Three Observations

People who keep small promises keep big ones. All promises flow through the same circuit.

Trust is asymmetric — built in a year, lost in ten seconds.

Transparency doesn't build trust. Consistency does.

---

## Application

The small weekly promise determines the quarterly big deal.

When this talk ends, name your first small promise.
```

`samples/sample.jp.md`:

```markdown
---
marp: true
theme: editorial
paginate: true
---

# 信頼の経済学

長い関係が短い取引に勝つ理由

---

## 取引と関係

取引は一度で終わる。関係は繰り返す。

反復ゲームにおいて信頼はコストではなく資本である。蓄積されるほど取引コストは下がり、一度の失敗の重みは増す。

> 最も高い交渉は信頼が壊れた後に始まる。

---

## 三つの観察

小さな約束を守る人は大きな約束も守る。すべての約束が同じ回路を流れるからだ。

信頼は非対称だ — 築くのに一年、失うのに十秒。

透明性が信頼を生むのではない。一貫性が生む。

---

## 適用

毎週の小さな約束が四半期の大きな取引を決める。

この発表が終わる瞬間、最初の小さな約束を決めよう。
```

- [ ] **Step 6: `README.md`**

```markdown
# editorial theme

내러티브 발표 / 인쇄물 스타일 / 책 같은 톤의 슬라이드.

- 폰트: Source Serif Pro (없으면 Georgia)
- 따뜻한 페이퍼 톤 배경 (#fbf8f1) + 빈티지 레드 액센트 (#8c1c13)
- 한 슬라이드에 본문 단락 1~3개. 비주얼은 보조.

리스트보다 단락을 권장. 발표자가 읽어내려가며 천천히 풀어가는 형식에 적합.
```

- [ ] **Step 7: 커밋**

```bash
git add themes/editorial/
git commit -m "feat(themes): add editorial light theme for narrative presentations"
```

---

## Phase 9 — 통합 테스트 + 문서

### Task 29: Fixture 통합 테스트

**Files:**
- Create: `scripts/tests/fixtures/simple/` (mini project)
- Create: `scripts/tests/fixtures/multilang/`
- Create: `scripts/tests/fixtures/overrides/`
- Create: `scripts/tests/fixtures/missing-secret/`
- Create: `scripts/tests/fixtures/processor-failure/`
- Create: `scripts/tests/integration.test.ts`

스펙 §10.3의 fixture 5종.

- [ ] **Step 1: simple fixture 작성**

`scripts/tests/fixtures/simple/deck.yaml`:

```yaml
title: simple-test
theme: default
language: ko
formats: [html]
output:
  basename: deck
plan:
  blueprint: blueprint.md
  assets: assets
```

`scripts/tests/fixtures/simple/blueprint.md`:

```markdown
한 페이지 짜리 간단한 발표. 제목은 "Hello", 본문은 "World" 한 단어.
```

`scripts/tests/fixtures/simple/output.md` (수동 작성 — plan 단계 결과 시뮬레이션):

```markdown
---
marp: true
theme: default
paginate: true
---

# Hello

World

---

![flow](assets/diagrams/hello.mmd)
```

`scripts/tests/fixtures/simple/assets/diagrams/hello.mmd`:

```
graph TD
  A[Hello] --> B[World]
```

- [ ] **Step 2: integration 테스트 작성 — `simple` fixture**

`scripts/tests/integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';

const cliPath = path.resolve(__dirname, '..', 'src', 'cli.ts');
const fixturesDir = path.resolve(__dirname, 'fixtures');
const pluginDir = path.resolve(__dirname, '..', '..');

let workDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slidesmith-int-'));
});
afterEach(async () => {
  await fs.remove(workDir);
});

async function copyFixture(name: string): Promise<string> {
  const dest = path.join(workDir, name);
  await fs.copy(path.join(fixturesDir, name), dest);
  return dest;
}

describe('fixture: simple — detect+inject pipeline', () => {
  it('detects placeholders in output.md and injects replacements', async () => {
    const project = await copyFixture('simple');
    const { stdout: detectOut } = await execa('npx', ['tsx', cliPath, 'detect', 'output.md'], { cwd: project });
    const placeholders = JSON.parse(detectOut);
    expect(placeholders).toHaveLength(1);
    expect(placeholders[0].kind).toBe('file-ref');
    expect(placeholders[0].ext).toBe('.mmd');
  });

  it('dispatches .mmd to mermaid-cli processor', async () => {
    const project = await copyFixture('simple');
    const { stdout } = await execa('npx', ['tsx', cliPath, 'dispatch-file-ref', '.mmd'], {
      cwd: project,
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: project, SLIDESMITH_USER_HOME: project },
    });
    const match = JSON.parse(stdout);
    expect(match?.name).toBe('mermaid-cli');
  });
});
```

- [ ] **Step 3: 테스트 실행**

```bash
cd scripts && npx vitest run tests/integration.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 4: missing-secret fixture 작성**

`scripts/tests/fixtures/missing-secret/deck.yaml`:

```yaml
title: missing-secret-test
theme: default
language: ko
formats: [pdf]
output:
  basename: deck
```

(no .env file; PEXELS_API_KEY is intentionally absent)

추가 테스트 in `integration.test.ts`:

```typescript
describe('fixture: missing-secret — doctor reports failures', () => {
  it('reports PEXELS_API_KEY missing when pexels processor is registered', async () => {
    const project = await copyFixture('missing-secret');
    // Run doctor; we expect non-zero exit
    let exitCode = 0;
    try {
      await execa('npx', ['tsx', cliPath, 'doctor'], {
        cwd: project,
        env: {
          ...process.env,
          PEXELS_API_KEY: '',
          GEMINI_API_KEY: '',
          SLIDESMITH_PLUGIN_DIR: pluginDir,
          SLIDESMITH_PROJECT_DIR: project,
          SLIDESMITH_USER_HOME: project,
        },
        reject: false,
      }).then((res) => {
        exitCode = res.exitCode;
      });
    } catch (err) {
      // ignore
    }
    expect(exitCode).not.toBe(0);
  });
});
```

- [ ] **Step 5: processor-failure fixture 작성**

`scripts/tests/fixtures/processor-failure/deck.yaml`:

```yaml
title: processor-failure-test
theme: default
language: ko
formats: [html]
output: { basename: deck }
```

`scripts/tests/fixtures/processor-failure/output.md`:

```markdown
---
marp: true
theme: default
---

# Test

![bad](assets/diagrams/nonexistent.mmd)
```

(no source file at the referenced path)

추가 테스트:

```typescript
describe('fixture: processor-failure — soft fail per placeholder', () => {
  it('exits non-zero when run-processor input file is missing', async () => {
    const project = await copyFixture('processor-failure');
    const result = await execa(
      'npx',
      [
        'tsx', cliPath, 'run-processor',
        '--name', 'mermaid-cli',
        '--input-file', path.join(project, 'assets', 'diagrams', 'nonexistent.mmd'),
        '--out', path.join(project, 'build', '.cache', 'svg', 'p1.svg'),
      ],
      {
        cwd: project,
        env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: project, SLIDESMITH_USER_HOME: project },
        reject: false,
      },
    );
    expect(result.exitCode).not.toBe(0);
  });
});
```

- [ ] **Step 6: overrides fixture 작성**

`scripts/tests/fixtures/overrides/deck.yaml`:

```yaml
title: overrides-test
theme: default
language: ko
formats: [html]
output: { basename: deck }
overrides: { css: overrides.css }
```

`scripts/tests/fixtures/overrides/overrides.css`:

```css
section { background: #ffeecc; }
```

`scripts/tests/fixtures/overrides/output.md`:

```markdown
---
marp: true
theme: default
---

# Override Test
```

추가 테스트:

```typescript
describe('fixture: overrides — combined CSS contains both theme and override', () => {
  it('combineThemeCss writes overrides after theme content', async () => {
    const project = await copyFixture('overrides');
    const themeCss = path.join(pluginDir, 'themes', 'default', 'theme.css');
    const out = path.join(project, 'build', '.cache', '_combined.css');
    const { combineThemeCss } = await import('../src/export');
    await combineThemeCss(themeCss, path.join(project, 'overrides.css'), out);
    const content = await fs.readFile(out, 'utf-8');
    expect(content).toMatch(/@theme default/);
    expect(content.indexOf('#ffeecc')).toBeGreaterThan(content.indexOf('@theme default'));
  });
});
```

- [ ] **Step 7: multilang fixture 작성**

`scripts/tests/fixtures/multilang/deck.yaml`:

```yaml
title: multilang-test
theme: default
language: en
formats: [html]
output: { basename: deck }
```

(no blueprint, just deck.yaml — tests that bootstrap copies the right sample)

추가 테스트:

```typescript
describe('fixture: multilang — bootstrap copies correct sample', () => {
  it('uses en sample when --lang en', async () => {
    const target = path.join(workDir, 'newproj');
    await execa('npx', ['tsx', cliPath, 'new-project', 'newproj', '--theme', 'default', '--lang', 'en'], {
      cwd: workDir,
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: workDir, SLIDESMITH_USER_HOME: workDir },
    });
    const blueprint = await fs.readFile(path.join(target, 'blueprint.md'), 'utf-8');
    expect(blueprint).toMatch(/Presentation Title/);
  });

  it('falls back to default sample when no lang mapping', async () => {
    const target = path.join(workDir, 'newproj-jp');
    // editorial theme has jp sample; use a theme that has no jp sample (fabricate by removing) — instead use default with a fake lang
    await execa('npx', ['tsx', cliPath, 'new-project', 'newproj-jp', '--theme', 'default', '--lang', 'fr'], {
      cwd: workDir,
      env: { ...process.env, SLIDESMITH_PLUGIN_DIR: pluginDir, SLIDESMITH_PROJECT_DIR: workDir, SLIDESMITH_USER_HOME: workDir },
    });
    const blueprint = await fs.readFile(path.join(target, 'blueprint.md'), 'utf-8');
    expect(blueprint).toMatch(/발표 제목/); // 기본(한국어) sample
  });
});
```

- [ ] **Step 8: 모든 통합 테스트 통과 확인**

```bash
cd scripts && npx vitest run tests/integration.test.ts
```
Expected: PASS (모든 테스트).

- [ ] **Step 9: 커밋**

```bash
git add scripts/tests/fixtures scripts/tests/integration.test.ts
git commit -m "test: add integration fixtures (simple/multilang/overrides/missing-secret/processor-failure)"
```

---

### Task 30: 전체 테스트 실행 + 누락 점검

**Files:** N/A (verification only)

- [ ] **Step 1: 전체 vitest 실행**

```bash
cd scripts && npx vitest run
```
Expected: 모든 테스트 PASS. 카운트는 위 task별 합산 (~40+).

- [ ] **Step 2: 수동 doctor 실행**

```bash
cd scripts && npx tsx src/cli.ts doctor
```
시스템에 marp-cli 설치돼 있다면 ✅, 없다면 안내 메시지 확인.

- [ ] **Step 3: 수동 list-capabilities**

```bash
cd scripts && SLIDESMITH_PLUGIN_DIR="$(pwd)/.." npx tsx src/cli.ts list-capabilities
```
Expected: 4개 능력(`diagram.mermaid`, `diagram.excalidraw`, `stock.photo`, `image.generate`).

- [ ] **Step 4: 수동 list-themes**

```bash
cd scripts && SLIDESMITH_PLUGIN_DIR="$(pwd)/.." npx tsx src/cli.ts theme list
```
Expected: 3개 테마(`default`, `midnight-tech`, `editorial`).

- [ ] **Step 5: 수동 end-to-end 빌드 (마르프 + 머메이드 설치돼 있을 때만)**

```bash
cd /tmp && rm -rf demo && \
  cd /path/to/slidesmith/scripts && \
  SLIDESMITH_PLUGIN_DIR="$(pwd)/.." SLIDESMITH_PROJECT_DIR=/tmp \
    npx tsx src/cli.ts new-project demo --theme default --lang ko && \
  cd /tmp/demo && \
  echo "기존 sample을 그대로 output.md로 복사 (수동 plan 시뮬레이션)" && \
  cp blueprint.md output.md && \
  cd /path/to/slidesmith/scripts && \
  SLIDESMITH_PLUGIN_DIR="$(pwd)/.." SLIDESMITH_PROJECT_DIR=/tmp/demo \
    npx tsx src/cli.ts detect /tmp/demo/output.md && \
  SLIDESMITH_PLUGIN_DIR="$(pwd)/.." SLIDESMITH_PROJECT_DIR=/tmp/demo \
    npx tsx src/cli.ts inject /tmp/demo/output.md \
      --replacements <(echo '[]') \
      --out /tmp/demo/build/.cache/prerendered.md && \
  SLIDESMITH_PLUGIN_DIR="$(pwd)/.." SLIDESMITH_PROJECT_DIR=/tmp/demo \
    npx tsx src/cli.ts export \
      --input /tmp/demo/build/.cache/prerendered.md \
      --theme-css "$(pwd)/../themes/default/theme.css" \
      --out-basename /tmp/demo/build/deck \
      --formats html
```
Expected: `/tmp/demo/build/deck.html` 생성 + 브라우저로 열어 슬라이드 확인.

- [ ] **Step 6: 누락 점검 — `/slidesmith:plan`/`/slidesmith:prerender` 매뉴얼 시나리오 1회**

스크립트로 자동화 못 함 (LLM 영역). 별도 데모 프로젝트에서:
1. `/slidesmith:new demo`
2. `blueprint.md`를 짧게 채움
3. `/slidesmith:plan` → output.md 생성 확인
4. `/slidesmith:prerender` → build/.cache/prerendered.md 확인
5. `/slidesmith:export` → deck.pdf 확인
6. 결과 PDF 시각 점검

각 단계의 console output 캡처해서 Phase 9 task로 archive (PR 본문에 첨부).

---

### Task 31: 최종 README + 사용 가이드

**Files:**
- Modify: `README.md` (현재 한 줄 → 풀 가이드)

- [ ] **Step 1: README 작성**

```markdown
# slidesmith

Marp 기반 Claude Code 플러그인. 자연어 입력만으로 발표 자료(PDF/HTML/PPTX)를 생성합니다.

## 설치

1. **의존성**:
   ```bash
   npm i -g @marp-team/marp-cli
   npm i -g @mermaid-js/mermaid-cli   # mermaid 사용 시
   ```

2. **플러그인 의존성 설치**:
   ```bash
   cd <plugin-root>/scripts && npm install
   ```

3. **doctor로 환경 확인**:
   ```
   /slidesmith:doctor
   ```

## 빠른 시작

```
# 1. 새 프로젝트
/slidesmith:new my-deck --theme midnight-tech --lang ko

# 2. blueprint.md 편집 (또는 그대로 sample 사용)

# 3. 한 번에 빌드
/slidesmith:build

# 결과: my-deck/build/deck.pdf
```

## 단계별 빌드

```
/slidesmith:plan         # blueprint → output.md
/slidesmith:prerender    # placeholder 변환 → build/.cache/prerendered.md
/slidesmith:export       # marp-cli → build/deck.pdf
```

## 테마

번들: `default`, `midnight-tech`, `editorial`. 사용 가능한 테마 보기:

```
/slidesmith:theme list
```

다른 사람의 테마 추가:

```
/slidesmith:theme add https://github.com/<user>/<repo>
```

## 문서

- 디자인 스펙: `docs/superpowers/specs/2026-04-30-slidesmith-design.md`
- 구현 계획: `docs/superpowers/plans/2026-04-30-slidesmith.md`

## 라이선스

레포지토리 루트의 `LICENSE` 파일을 따릅니다.
```

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: replace stub README with installation and quick-start guide"
```

---

### Task 32: 최종 점검 + 0.1.0 태그

**Files:** N/A

- [ ] **Step 1: 전체 테스트**

```bash
cd scripts && npx vitest run
```
모두 PASS 확인.

- [ ] **Step 2: 디렉토리 구조 점검**

```bash
cd .. && find . -type f -not -path './scripts/node_modules/*' -not -path './.git/*' | sort
```
스펙 §3 레이아웃과 일치하는지 확인. 빠진 것 있으면 추가.

- [ ] **Step 3: git 상태 점검**

```bash
git status
git log --oneline | head -40
```
모든 커밋이 이름 컨벤션(feat/fix/docs/test/chore) 따르는지 확인.

- [ ] **Step 4: 버전 태그**

```bash
git tag v0.1.0 -m "slidesmith v0.1.0 — initial release with 3 themes and 4 processors"
```

(원격 push는 사용자 결정.)

---

## Self-Review

다음을 점검하고 결과를 PR 본문(또는 별도 노트)에 적는다:

**1. 스펙 커버리지** — `docs/superpowers/specs/2026-04-30-slidesmith-design.md`의 각 섹션을 훑으며 어느 task가 그 요구사항을 구현하는지 매핑:

- §3 플러그인 레이아웃 → Task 1, 22-25 (prerenders), 26-28 (themes), 15-21 (commands)
- §4 테마 시스템 → Task 2 (manifest), 3 (paths), 11 (sample resolution), 14 (combineCss), 26-28 (bundled)
- §5 프로젝트 시스템 → Task 11 (bootstrap), 18 (plan)
- §6 빌드 파이프라인 → Task 6-8 (detect/dispatch/inject), 13 (cli wiring), 14 (export), 18-21 (commands)
- §7 prerender 시스템 → Task 2 (manifest), 7 (dispatch), 22-25 (bundled processors)
- §8 secrets → Task 4 (env loader), 10 (doctor env check)
- §9 테마 관리 → Task 12 (theme commands), 17 (slash command)
- §10 에러처리/doctor/테스트 → Task 10 (doctor), 19 (prerender soft-fail), 29-30 (integration)
- §11 v1 출하 범위 → Task 22-28
- §12 의사결정 로그 — 정보용, 구현 항목 없음

**2. Placeholder 스캔** — 플랜 안에 "TBD", "TODO", "implement later"가 본문에 남아있나? (의도된 LLM 동작 설명에 들어간 `# TODO: <가정>`은 예외 — 그건 *런타임* 마커지 *플랜* 누락이 아님.)

**3. 타입 일관성** — 후속 task에서 사용한 함수/타입명이 앞에서 정의한 것과 일치하나? 예: `parseProcessorManifest`, `loadProcessors`, `matchFileRef`, `injectReplacements`, `bootstrapProject`, `combineThemeCss` 등.

**4. 누락된 의존성** — `package.json`의 의존성이 코드에서 실제로 import되는 것과 일치하나? `chalk`은 import되지 않으니 제거 가능.

이슈 발견 시 인라인으로 고치고 진행.

