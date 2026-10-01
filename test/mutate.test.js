import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mutate, litter, balanced, MAX_SUCCESSOR } from '../src/mutate.js';
import { parseRules } from '../src/lsystem.js';
import { fromPreset } from '../src/params.js';
import { PRESETS } from '../src/presets.js';

test('offspring always parse, stay balanced and stay short', () => {
  for (const p of PRESETS) {
    let s = fromPreset(p.id);
    // Breed a long line so edits pile up on each other.
    for (let gen = 0; gen < 60; gen++) {
      const child = mutate(s, `${p.id}-${gen}`);
      const { rules, errors } = parseRules(child.settings.rules);
      assert.deepEqual(errors, [], `${p.id} gen ${gen}`);
      for (const options of rules.values()) {
        for (const o of options) {
          assert.ok(balanced(o.successor), `${p.id} gen ${gen}: ${o.successor}`);
          assert.ok(o.successor.length > 0 && o.successor.length <= MAX_SUCCESSOR + 1);
        }
      }
      assert.ok(child.settings.angle >= 0 && child.settings.angle <= 180);
      s = child.settings;
    }
  }
});

test('each offspring differs from its parent by one described edit', () => {
  const parent = fromPreset('herb');
  for (const child of litter(parent, 30, 'x')) {
    const changed = child.settings.rules !== parent.rules || child.settings.angle !== parent.angle;
    assert.ok(changed, child.what);
    assert.ok(child.what.length > 0);
    if (child.settings.rules !== parent.rules) assert.match(child.what, /^F: /);
  }
});

test('stochastic presets name which choice was edited and keep their weights', () => {
  const parent = fromPreset('weed');
  const edits = litter(parent, 40, 'w').filter((c) => c.settings.rules !== parent.rules);
  assert.ok(edits.length > 0);
  for (const c of edits) {
    assert.match(c.what, /^F \(choice [123]\): /);
    const weights = parseRules(c.settings.rules).rules.get('F').map((o) => o.weight);
    assert.deepEqual(weights, [0.33, 0.33, 0.34]);
  }
});

test('litters are reproducible and varied', () => {
  const parent = fromPreset('fern');
  const a = litter(parent, 6, 7).map((c) => c.what);
  const b = litter(parent, 6, 7).map((c) => c.what);
  assert.deepEqual(a, b);
  assert.ok(new Set(a).size >= 4, a.join(' | '));
});

test('a grammar with errors still breeds by nudging the angle', () => {
  const parent = { ...fromPreset('herb'), rules: 'oops' };
  const child = mutate(parent, 1);
  assert.equal(child.settings.rules, 'oops');
  assert.match(child.what, /^turn angle [+-]\d/);
});

test('balanced spots stray and missing brackets', () => {
  assert.ok(balanced('F[+F[-F]]F'));
  assert.ok(!balanced('F]['));
  assert.ok(!balanced('F[+F'));
});

test('a litter holds no two identical offspring', () => {
  for (const id of ['fern', 'herb', 'koch-island', 'dragon']) {
    const kids = litter(fromPreset(id), 6, id);
    assert.equal(kids.length, 6, id);
    assert.equal(new Set(kids.map((k) => `${k.settings.rules}|${k.settings.angle}`)).size, 6, id);
  }
});
