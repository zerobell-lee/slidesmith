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
