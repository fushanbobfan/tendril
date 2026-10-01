import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRules, rewrite, derive, isStochastic, predictLength } from '../src/lsystem.js';
import { makeRng, hashSeed } from '../src/rng.js';

test('parses arrow, unicode arrow and equals forms, skipping comments', () => {
  const { rules, errors } = parseRules('# algae\nA -> AB\nB = A\nC → C C  # spaces dropped');
  assert.deepEqual(errors, []);
  assert.equal(rules.get('A')[0].successor, 'AB');
  assert.equal(rules.get('B')[0].successor, 'A');
  assert.equal(rules.get('C')[0].successor, 'CC');
});

test('reports malformed lines and bad weights with line numbers', () => {
  const { errors } = parseRules('F -> FF\nnonsense\nG (0) -> G\nH (x) -> H');
  assert.deepEqual(errors.map((e) => e.line), [2, 3, 4]);
});

test('Lindenmayer algae: lengths follow the Fibonacci numbers', () => {
  const { rules } = parseRules('A -> AB\nB -> A');
  const { word, lengths } = derive('A', rules, 7);
  assert.deepEqual(lengths, [1, 2, 3, 5, 8, 13, 21, 34]);
  assert.equal(word.slice(0, 8), 'ABAABABA');
});

test('symbols without a production are copied unchanged', () => {
  const { rules } = parseRules('F -> F+F');
  assert.equal(rewrite('F[-F]', rules), 'F+F[-F+F]');
});

test('stochastic rules are reproducible per seed and respect weights', () => {
  const { rules } = parseRules('X (1) -> a\nX (3) -> b');
  assert.ok(isStochastic(rules));
  const a = derive('X'.repeat(4000), rules, 1, { seed: 7 }).word;
  const b = derive('X'.repeat(4000), rules, 1, { seed: 7 }).word;
  assert.equal(a, b);
  const share = [...a].filter((c) => c === 'b').length / a.length;
  assert.ok(Math.abs(share - 0.75) < 0.03, `share of b was ${share}`);
  assert.notEqual(derive('X'.repeat(50), rules, 1, { seed: 8 }).word, a.slice(0, 50));
});

test('derivation stops before exceeding the symbol cap', () => {
  const { rules } = parseRules('F -> FFFF');
  const out = derive('F', rules, 20, { maxSymbols: 1000 });
  assert.equal(out.reached, 4);
  assert.equal(out.word.length, 256);
  assert.ok(out.capped);
});

test('predictLength is an upper bound using the longest alternative', () => {
  const { rules } = parseRules('F -> FF\nF -> FFF');
  assert.equal(predictLength('F+F', rules), 7);
});

test('seeded generator is deterministic and string seeds hash stably', () => {
  const r1 = makeRng('fern');
  const r2 = makeRng('fern');
  for (let i = 0; i < 5; i++) assert.equal(r1(), r2());
  assert.equal(hashSeed(42), 42);
  assert.notEqual(hashSeed('a'), hashSeed('b'));
});

test('formatRules writes rules that parse back to the same productions', async () => {
  const { formatRules } = await import('../src/lsystem.js');
  const text = 'X -> F[+X][-X]FX\nF (0.25) -> FF\nF (0.75) -> F';
  const { rules } = parseRules(text);
  assert.equal(formatRules(rules), text);
  assert.deepEqual(parseRules(formatRules(rules)).rules, rules);
});
