import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBatches, toSVG, COLOR_STEPS } from '../src/render.js';
import { interpret } from '../src/turtle.js';
import { parseRules, derive } from '../src/lsystem.js';

const plant = () => {
  const { rules } = parseRules('X -> F[+X][-X]FX\nF -> FF');
  return interpret(derive('X', rules, 6).word, { angle: 25.7 });
};

test('batches cover every segment once and stay few', () => {
  const t = plant();
  const batches = buildBatches(t);
  const all = batches.flatMap((b) => b.indices).sort((a, b) => a - b);
  assert.equal(all.length, t.count);
  assert.ok(all.every((v, i) => v === i));
  assert.ok(batches.length <= COLOR_STEPS * 4, `${batches.length} batches`);
});

test('a growth limit draws only the first segments', () => {
  const t = plant();
  const n = buildBatches(t, { limit: 10 }).reduce((k, b) => k + b.indices.length, 0);
  assert.equal(n, 10);
});

test('branches taper with depth and curves colour along their path', () => {
  const batches = buildBatches(plant(), { lineWidth: 4 });
  const trunk = batches.find((b) => b.order === 0);
  const twig = batches[batches.length - 1];
  assert.ok(trunk.width > twig.width);
  const curve = interpret('F+F+F+F+F', { angle: 72 });
  const cb = buildBatches(curve, { palette: 'neon' });
  assert.equal(cb[0].indices[0], 0);
  assert.ok(cb[cb.length - 1].indices.includes(4));
  assert.notEqual(cb[0].color, cb[cb.length - 1].color);
});

test('SVG export joins consecutive segments into one subpath', () => {
  const t = interpret('F+F+F+F', { angle: 90, heading: 0 });
  const batches = [{ color: 'red', width: 2, indices: [0, 1, 2, 3] }];
  const svg = toSVG(t, batches, 100, 100, { pad: 10 });
  assert.match(svg, /^<svg xmlns/);
  assert.equal((svg.match(/M/g) || []).length, 1);
  assert.equal((svg.match(/L/g) || []).length, 4);
  assert.match(svg, /stroke="red"/);
});
