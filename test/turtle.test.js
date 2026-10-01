import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret, fitTransform, STRIDE } from '../src/turtle.js';

const close = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('a square closes on itself', () => {
  const t = interpret('F+F+F+F', { angle: 90, heading: 0 });
  assert.equal(t.count, 4);
  const s = t.segments;
  close(s[3 * STRIDE + 2], 0);
  close(s[3 * STRIDE + 3], 0);
  close(t.bounds.maxX, 1);
  close(t.bounds.maxY, 1);
});

test('f moves without drawing and unknown symbols are ignored', () => {
  const t = interpret('FXfYF', { heading: 0 });
  assert.equal(t.count, 2);
  close(t.segments[STRIDE], 2);
  close(t.bounds.maxX, 3);
});

test('brackets restore position and heading and track depth', () => {
  const t = interpret('F[+F[-F]]F', { angle: 90, heading: 90 });
  assert.equal(t.maxDepth, 2);
  const depths = [];
  for (let i = 0; i < t.count; i++) depths.push(t.segments[i * STRIDE + 4]);
  assert.deepEqual(depths, [0, 1, 2, 0]);
  close(t.segments[3 * STRIDE], 0);
  close(t.segments[3 * STRIDE + 1], 1);
  close(t.segments[3 * STRIDE + 3], 2);
});

test('only the preset draw symbols lay down ink', () => {
  const t = interpret('A+B+A', { draw: 'AB', angle: 60 });
  assert.equal(t.count, 3);
  assert.equal(interpret('A+B+A', { draw: 'F' }).count, 0);
});

test('width and length decay apply until the branch closes', () => {
  const t = interpret('[!"F]F', { widthDecay: 0.5, lengthDecay: 0.25, heading: 0 });
  close(t.segments[5], 0.5);
  close(t.segments[2], 0.25);
  close(t.segments[STRIDE + 5], 1);
  close(t.segments[STRIDE + 2], 1);
});

test('| turns around and unbalanced brackets are counted, not fatal', () => {
  const t = interpret('F|F]][', { heading: 0 });
  close(t.segments[STRIDE + 2], 0);
  assert.equal(t.unmatched, 2);
  assert.equal(t.unclosed, 1);
});

test('angle jitter is seeded', () => {
  const a = interpret('F+F+F', { jitter: 10, seed: 3 }).segments;
  const b = interpret('F+F+F', { jitter: 10, seed: 3 }).segments;
  const c = interpret('F+F+F', { jitter: 10, seed: 4 }).segments;
  assert.deepEqual([...a], [...b]);
  assert.notDeepEqual([...a], [...c]);
});

test('fitTransform centres the drawing and flips y', () => {
  const f = fitTransform({ minX: 0, maxX: 2, minY: 0, maxY: 1 }, 220, 120, 10);
  close(f.scale, 100);
  close(f.x(1), 110);
  close(f.y(1), 10);
  close(f.y(0), 110);
});
