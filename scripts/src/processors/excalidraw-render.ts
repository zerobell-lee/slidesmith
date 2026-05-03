import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import type { Env } from '../lib/env.ts';

export async function run(inputFile: string, outputFile: string, _env: Env): Promise<void> {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const define = (key: string, value: unknown) => {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  };
  define('window', dom.window);
  define('document', dom.window.document);
  define('navigator', dom.window.navigator);
  define('HTMLElement', dom.window.HTMLElement);
  define('SVGElement', dom.window.SVGElement);
  define('Image', dom.window.Image);
  define('DOMParser', dom.window.DOMParser);
  define('XMLSerializer', dom.window.XMLSerializer);
  define('Node', dom.window.Node);
  define('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));
  define('devicePixelRatio', 1);
  if (typeof (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame !== 'function') {
    define('requestAnimationFrame', (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0));
  }

  const { exportToSvg } = await import('@excalidraw/utils');

  const raw = await fs.readFile(inputFile, 'utf-8');
  const data = JSON.parse(raw);
  const elements = data.elements ?? [];
  const appState = data.appState ?? {};
  const files = data.files ?? null;

  const svg = await exportToSvg({
    elements,
    appState,
    files,
    skipInliningFonts: true,
  });

  const serializer = new dom.window.XMLSerializer();
  const out = serializer.serializeToString(svg);
  await fs.writeFile(outputFile, out, 'utf-8');
}
