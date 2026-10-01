import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromPreset, clampSettings, encodeHash, decodeHash } from '../src/params.js';

test('preset settings carry the preset grammar and a palette by group', () => {
  const s = fromPreset('dragon');
  assert.equal(s.axiom, 'A');
  assert.equal(s.draw, 'AB');
  assert.equal(s.palette, 'ink');
  assert.equal(fromPreset('fern').palette, 'spring');
  assert.equal(fromPreset('no-such').preset, 'weed');
});

test('clamping bounds numbers and strips turtle commands from draw symbols', () => {
  const s = clampSettings({ ...fromPreset('herb'), iterations: 99, angle: -5, jitter: 'x', draw: 'F+[G]f', palette: 'mauve' });
  assert.equal(s.iterations, 16);
  assert.equal(s.angle, 0);
  assert.equal(s.jitter, 0);
  assert.equal(s.draw, 'FG');
  assert.equal(s.palette, 'spring');
});

test('an untouched preset encodes to a short link', () => {
  assert.equal(encodeHash(fromPreset('gosper')), '#p=gosper');
});

test('edited grammars and numbers round-trip through the link', () => {
  const s = { ...fromPreset('weed'), rules: 'F -> F[+F]\nF (2) -> F[-F]F', seed: 42, angle: 30.5, palette: 'neon' };
  const back = decodeHash(encodeHash(s));
  assert.deepEqual(back, clampSettings(s));
});

test('decoding rejects garbage without throwing', () => {
  const s = decodeHash('#p=bogus&n=abc&d=1e9');
  assert.equal(s.preset, 'weed');
  assert.equal(s.iterations, 5);
  assert.equal(s.angle, 180);
});
