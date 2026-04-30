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
