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
