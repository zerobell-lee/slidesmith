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
