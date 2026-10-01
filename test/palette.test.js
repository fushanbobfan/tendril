import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rampColor, background, worstContrast } from '../src/palette.js';
import { PALETTES } from '../src/params.js';

test('ramp ends hit the first and last stops and clamp outside [0, 1]', () => {
  assert.equal(rampColor('neon', 0), 'rgb(111, 99, 255)');
  assert.equal(rampColor('neon', 1), 'rgb(255, 211, 79)');
  assert.equal(rampColor('neon', -3), rampColor('neon', 0));
  assert.equal(rampColor('neon', NaN), rampColor('neon', 0));
});

test('unknown palettes fall back to spring', () => {
  assert.equal(rampColor('plaid', 0.5), rampColor('spring', 0.5));
  assert.equal(background('plaid'), background('spring'));
});

test('every palette keeps strokes distinguishable from the background', () => {
  for (const name of PALETTES) {
    assert.ok(worstContrast(name) >= 3, `${name}: ${worstContrast(name).toFixed(2)}`);
  }
});
