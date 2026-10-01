// Group segments into a small number of stroke batches (one colour and one
// width each) so the canvas can draw half a million segments as a few dozen
// paths, and the SVG export stays compact.

import { STRIDE, fitTransform } from './turtle.js';
import { rampColor, background } from './palette.js';

export const COLOR_STEPS = 24;
const TAPER = 0.82;

export function buildBatches(turtle, { palette = 'spring', lineWidth = 1.5, limit = Infinity } = {}) {
  const { segments, count, maxDepth } = turtle;
  const n = Math.min(count, limit);
  const byDepth = maxDepth > 0;
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    const depth = segments[o + 4];
    const t = byDepth ? depth / maxDepth : count > 1 ? i / (count - 1) : 0;
    const c = Math.round(t * (COLOR_STEPS - 1));
    const taper = byDepth ? Math.max(0.35, TAPER ** depth) : 1;
    const w = lineWidth * segments[o + 5] * taper;
    const wq = Math.round(Math.log2(Math.max(w, 1 / 64)) * 2) / 2; // half-octave steps
    const k = `${c}:${wq}`;
    let b = map.get(k);
    if (!b) {
      b = { color: rampColor(palette, c / (COLOR_STEPS - 1)), width: 2 ** wq, indices: [], order: c };
      map.set(k, b);
    }
    b.indices.push(i);
  }
  // Thick, early colours first so twigs and path ends draw over trunks.
  return [...map.values()].sort((a, b) => a.order - b.order || b.width - a.width);
}

export function toSVG(turtle, batches, w, h, { palette = 'spring', pad = 16 } = {}) {
  const f = fitTransform(turtle.bounds, w, h, pad);
  const r = (v) => Math.round(v * 10) / 10;
  const s = turtle.segments;
  const paths = batches.map((b) => {
    let d = '';
    let lx = NaN;
    let ly = NaN;
    for (const i of b.indices) {
      const o = i * STRIDE;
      const x1 = r(f.x(s[o]));
      const y1 = r(f.y(s[o + 1]));
      const x2 = r(f.x(s[o + 2]));
      const y2 = r(f.y(s[o + 3]));
      d += x1 === lx && y1 === ly ? `L${x2} ${y2}` : `M${x1} ${y1}L${x2} ${y2}`;
      lx = x2;
      ly = y2;
    }
    return `<path d="${d}" stroke="${b.color}" stroke-width="${r(b.width)}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="100%" height="100%" fill="${background(palette)}"/>`,
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`,
    ...paths,
    '</g>',
    '</svg>',
  ].join('\n');
}
