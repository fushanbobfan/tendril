import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, findPreset } from '../src/presets.js';
import { parseRules, derive } from '../src/lsystem.js';
import { interpret, STRIDE } from '../src/turtle.js';

function grow(id, iterations) {
  const p = findPreset(id);
  const { rules } = parseRules(p.rules);
  const { word } = derive(p.axiom, rules, iterations ?? p.iterations);
  return interpret(word, { angle: p.angle, draw: p.draw, heading: 0 });
}

const key = (x, y) => `${Math.round(x * 1e3)},${Math.round(y * 1e3)}`;

test('every preset parses, fits under the cap and keeps brackets balanced', () => {
  const ids = new Set();
  for (const p of PRESETS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    const { rules, errors } = parseRules(p.rules);
    assert.deepEqual(errors, [], p.id);
    const out = derive(p.axiom, rules, p.iterations);
    assert.equal(out.capped, false, p.id);
    const t = interpret(out.word, { angle: p.angle, draw: p.draw });
    assert.ok(t.count > 0, p.id);
    assert.equal(t.unmatched + t.unclosed, 0, p.id);
  }
});

test('the quadratic Koch island closes on its starting point', () => {
  const t = grow('koch-island', 2);
  const s = t.segments;
  const last = (t.count - 1) * STRIDE;
  assert.equal(key(s[last + 2], s[last + 3]), key(0, 0));
  assert.equal(t.count, 4 * 8 ** 2);
});

test('the Hilbert curve visits every cell of its grid exactly once', () => {
  const n = 4;
  const t = grow('hilbert', n);
  assert.equal(t.count, 4 ** n - 1);
  const seen = new Set([key(0, 0)]);
  for (let i = 0; i < t.count; i++) seen.add(key(t.segments[i * STRIDE + 2], t.segments[i * STRIDE + 3]));
  assert.equal(seen.size, 4 ** n);
});

test('the dragon curve never retraces an edge', () => {
  const t = grow('dragon', 10);
  assert.equal(t.count, 2 ** 10);
  const edges = new Set();
  for (let i = 0; i < t.count; i++) {
    const o = i * STRIDE;
    const a = key(t.segments[o], t.segments[o + 1]);
    const b = key(t.segments[o + 2], t.segments[o + 3]);
    edges.add(a < b ? a + b : b + a);
  }
  assert.equal(edges.size, t.count);
});

test('the gasket and Gosper curves grow by 3 and 7 segments per segment', () => {
  assert.equal(grow('gasket', 5).count, 3 ** 5);
  assert.equal(grow('gosper', 3).count, 7 ** 3);
});
