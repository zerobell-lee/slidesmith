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
