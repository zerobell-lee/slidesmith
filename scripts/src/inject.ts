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
