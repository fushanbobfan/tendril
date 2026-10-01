// Parsing and rewriting for context-free L-systems, deterministic or
// stochastic.
//
// Rule text has one production per line:
//
//   F -> F[+F]F[-F]F
//   X -> F[+X][-X]FX
//
// Several lines with the same predecessor make a stochastic choice; an
// optional weight in parentheses biases it (default 1):
//
//   F (1) -> F[+F]F[-F]F
//   F (1) -> F[+F]F
//   F (2) -> F[-F]F
//
// "=" works in place of "->", and "#" starts a comment.

import { makeRng } from './rng.js';

export const MAX_SYMBOLS = 1_500_000;

const LINE = /^(\S)\s*(?:\(\s*([^)]*)\s*\))?\s*(?:->|→|=)\s*(.*)$/u;

export function parseRules(text) {
  const rules = new Map();
  const errors = [];
  const lines = String(text ?? '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const m = LINE.exec(line);
    if (!m) {
      errors.push({ line: i + 1, message: 'expected "X -> replacement"' });
      return;
    }
    const [, pred, weightText, succRaw] = m;
    let weight = 1;
    if (weightText !== undefined) {
      weight = Number(weightText);
      if (!Number.isFinite(weight) || weight <= 0) {
        errors.push({ line: i + 1, message: `weight "${weightText}" must be a positive number` });
        return;
      }
    }
    const successor = succRaw.replace(/\s+/g, '');
    if (!rules.has(pred)) rules.set(pred, []);
    rules.get(pred).push({ successor, weight });
  });
  return { rules, errors };
}

export function isStochastic(rules) {
  for (const options of rules.values()) if (options.length > 1) return true;
  return false;
}

function pick(options, rng) {
  if (options.length === 1) return options[0].successor;
  let total = 0;
  for (const o of options) total += o.weight;
  let r = rng() * total;
  for (const o of options) {
    r -= o.weight;
    if (r < 0) return o.successor;
  }
  return options[options.length - 1].successor;
}

// Apply every production once, in parallel, to each symbol of `word`.
export function rewrite(word, rules, rng = Math.random) {
  let out = '';
  for (const ch of word) {
    const options = rules.get(ch);
    out += options ? pick(options, rng) : ch;
  }
  return out;
}

// Derive generation `iterations` from the axiom. Stops early, keeping the
// last generation that fits, when a step would exceed `maxSymbols`.
export function derive(axiom, rules, iterations, { seed = 1, maxSymbols = MAX_SYMBOLS } = {}) {
  const rng = makeRng(seed);
  let word = String(axiom ?? '').replace(/\s+/g, '');
  const lengths = [word.length];
  let reached = 0;
  let capped = false;
  for (let i = 0; i < iterations; i++) {
    if (predictLength(word, rules) > maxSymbols) {
      capped = true;
      break;
    }
    word = rewrite(word, rules, rng);
    lengths.push(word.length);
    reached = i + 1;
  }
  return { word, reached, capped, lengths };
}

// Upper bound on the next generation's length, without building it.
export function predictLength(word, rules) {
  const longest = new Map();
  for (const [pred, options] of rules) {
    longest.set(pred, Math.max(...options.map((o) => o.successor.length)));
  }
  let n = 0;
  for (const ch of word) n += longest.get(ch) ?? 1;
  return n;
}
