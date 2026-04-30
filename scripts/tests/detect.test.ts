import { describe, it, expect } from 'vitest';
import { detectPlaceholders } from '../src/detect';

describe('detectPlaceholders', () => {
  it('classifies image with png extension as kind=image', () => {
    const md = '# Title\n\n![hero](assets/images/hero.png)\n';
    const result = detectPlaceholders(md);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('image');
    if (result[0].kind === 'image') {
      expect(result[0].path).toBe('assets/images/hero.png');
    }
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
