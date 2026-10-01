// Turtle interpretation of an L-system word.
//
//   draw symbols (F, G, ... per preset)  step forward with the pen down
//   f                                    step forward with the pen up
//   +  -                                 turn left / right by the angle
//   |                                    turn around
//   [  ]                                 save / restore the turtle state
//   !                                    narrow the pen (times widthDecay)
//   "                                    shorten the step (times lengthDecay)
//
// Anything else is ignored, so helper symbols like X only steer the rewriting.
// Coordinates are y-up; the renderer flips them onto the canvas.

import { makeRng } from './rng.js';

export const STRIDE = 6; // x1, y1, x2, y2, depth, width

const DEG = Math.PI / 180;

export function interpret(word, opts = {}) {
  const {
    angle = 25,
    heading = 90,
    draw = 'F',
    step = 1,
    widthDecay = 0.7,
    lengthDecay = 0.8,
    jitter = 0,
    seed = 1,
  } = opts;
  const drawSet = new Set(draw);
  const rng = makeRng(seed);
  const turn = angle * DEG;
  const wobble = jitter * DEG;

  let count = 0;
  for (const ch of word) if (drawSet.has(ch)) count++;
  const seg = new Float32Array(count * STRIDE);

  let x = 0;
  let y = 0;
  let dir = heading * DEG;
  let width = 1;
  let len = step;
  let depth = 0;
  let maxDepth = 0;
  let n = 0;
  let unmatched = 0;
  const stack = [];
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  const turnBy = (sign) => {
    dir += sign * turn + (wobble ? (rng() * 2 - 1) * wobble : 0);
  };

  for (const ch of word) {
    if (drawSet.has(ch) || ch === 'f') {
      const nx = x + Math.cos(dir) * len;
      const ny = y + Math.sin(dir) * len;
      if (ch !== 'f') {
        const o = n * STRIDE;
        seg[o] = x;
        seg[o + 1] = y;
        seg[o + 2] = nx;
        seg[o + 3] = ny;
        seg[o + 4] = depth;
        seg[o + 5] = width;
        n++;
      }
      x = nx;
      y = ny;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else if (ch === '+') {
      turnBy(1);
    } else if (ch === '-') {
      turnBy(-1);
    } else if (ch === '|') {
      dir += Math.PI;
    } else if (ch === '[') {
      stack.push([x, y, dir, width, len]);
      depth++;
      if (depth > maxDepth) maxDepth = depth;
    } else if (ch === ']') {
      if (stack.length === 0) {
        unmatched++;
        continue;
      }
      [x, y, dir, width, len] = stack.pop();
      depth--;
    } else if (ch === '!') {
      width *= widthDecay;
    } else if (ch === '"') {
      len *= lengthDecay;
    }
  }

  return {
    segments: seg.subarray(0, n * STRIDE),
    count: n,
    maxDepth,
    unmatched,
    unclosed: stack.length,
    bounds: { minX, maxX, minY, maxY },
  };
}

// Scale and offset that fit `bounds` inside a w x h box with `pad` pixels
// spare, centred, with y flipped for a canvas.
export function fitTransform(bounds, w, h, pad = 16) {
  const bw = Math.max(bounds.maxX - bounds.minX, 1e-9);
  const bh = Math.max(bounds.maxY - bounds.minY, 1e-9);
  const scale = Math.max(Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh), 1e-9);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    x: (px) => w / 2 + (px - cx) * scale,
    y: (py) => h / 2 - (py - cy) * scale,
  };
}
