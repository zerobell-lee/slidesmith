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
  z.object({
    type: z.literal('internal'),
    module: z.string(),
  }),
]);

const ProcessorManifestSchema = z.object({
  name: z.string().min(1),
  provides: z.array(z.string().min(1)).min(1),
  matches: z.object({
    extensions: z.array(z.string()).optional(),
  }).default({}),
  backend: BackendSchema,
  output_ext: z.string().optional(),
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
