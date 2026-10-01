// Small random edits to a grammar, for breeding: pick one production and
// graft on a branch, prune one, flip or add a turn, or lengthen a stem; or
// nudge the turn angle. Every edit keeps brackets balanced, so offspring
// always parse and draw.

import { parseRules, formatRules } from './lsystem.js';
import { makeRng } from './rng.js';

export const MAX_SUCCESSOR = 64;

const pickIndex = (n, rng) => Math.floor(rng() * n);

// Index of the "]" that closes the "[" at i, or -1.
function closing(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '[') depth++;
    else if (s[j] === ']' && --depth === 0) return j;
  }
  return -1;
}

const positions = (s, test) => [...s].map((c, i) => (test(c) ? i : -1)).filter((i) => i >= 0);

// Each operator returns { successor, what } or null when it does not apply.
const OPERATORS = {
  graft(s, ctx, rng) {
    if (s.length + 4 > MAX_SUCCESSOR) return null;
    const letter = ctx.growing[pickIndex(ctx.growing.length, rng)];
    const sign = rng() < 0.5 ? '+' : '-';
    const at = pickIndex(s.length + 1, rng);
    return { successor: s.slice(0, at) + `[${sign}${letter}]` + s.slice(at), what: `grafted a branch [${sign}${letter}]` };
  },
  prune(s, ctx, rng) {
    const opens = positions(s, (c) => c === '[');
    if (opens.length === 0) return null;
    const i = opens[pickIndex(opens.length, rng)];
    const j = closing(s, i);
    if (j < 0) return null;
    const cut = s.slice(i, j + 1);
    return { successor: s.slice(0, i) + s.slice(j + 1), what: `pruned ${cut.length > 10 ? 'a branch' : cut}` };
  },
  flip(s, ctx, rng) {
    const turns = positions(s, (c) => c === '+' || c === '-');
    if (turns.length === 0) return null;
    const i = turns[pickIndex(turns.length, rng)];
    const to = s[i] === '+' ? '-' : '+';
    return { successor: s.slice(0, i) + to + s.slice(i + 1), what: `turned a ${s[i]} into ${to}` };
  },
  bend(s, ctx, rng) {
    if (s.length + 1 > MAX_SUCCESSOR) return null;
    const at = pickIndex(s.length + 1, rng);
    const sign = rng() < 0.5 ? '+' : '-';
    return { successor: s.slice(0, at) + sign + s.slice(at), what: `added a ${sign} turn` };
  },
  stretch(s, ctx, rng) {
    const draws = positions(s, (c) => ctx.draw.includes(c));
    if (draws.length === 0 || s.length + 1 > MAX_SUCCESSOR) return null;
    const i = draws[pickIndex(draws.length, rng)];
    return { successor: s.slice(0, i) + s[i] + s.slice(i), what: `doubled a ${s[i]}` };
  },
};

const NAMES = Object.keys(OPERATORS);

// One offspring of `settings`. Returns { settings, what } where `what`
// describes the change in words for the thumbnail label.
export function mutate(settings, seed) {
  const rng = makeRng(seed);
  const { rules, errors } = parseRules(settings.rules);
  if (rules.size === 0 || errors.length) return angleNudge(settings, rng);
  if (rng() < 0.2) return angleNudge(settings, rng);

  const growing = [...new Set([...rules.keys(), ...settings.draw])].filter((c) => !'[]+-|!"f'.includes(c));
  const ctx = { draw: settings.draw, growing: growing.length ? growing : ['F'] };
  const preds = [...rules.keys()];

  for (let attempt = 0; attempt < 12; attempt++) {
    const pred = preds[pickIndex(preds.length, rng)];
    const options = rules.get(pred);
    const k = pickIndex(options.length, rng);
    const s = options[k].successor;
    const name = NAMES[pickIndex(NAMES.length, rng)];
    const out = OPERATORS[name](s, ctx, rng);
    if (!out || out.successor === s || out.successor.length === 0) continue;
    const next = new Map(rules);
    next.set(pred, options.map((o, i) => (i === k ? { ...o, successor: out.successor } : o)));
    const label = options.length > 1 ? `${pred} (choice ${k + 1})` : pred;
    return { settings: { ...settings, rules: formatRules(next) }, what: `${label}: ${out.what}` };
  }
  return angleNudge(settings, rng);
}

function angleNudge(settings, rng) {
  const step = (2 + Math.round(rng() * 6)) * (rng() < 0.5 ? -1 : 1);
  const angle = Math.min(180, Math.max(0, Math.round((settings.angle + step) * 10) / 10));
  const d = Math.round((angle - settings.angle) * 10) / 10;
  return { settings: { ...settings, angle }, what: `turn angle ${d >= 0 ? '+' : ''}${d}°` };
}

// A litter of `n` offspring with distinct seeds derived from `seed`.
export function litter(settings, n, seed) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(mutate(settings, `${seed}:${i}`));
  return out;
}

export function balanced(s) {
  let depth = 0;
  for (const c of s) {
    if (c === '[') depth++;
    else if (c === ']' && --depth < 0) return false;
  }
  return depth === 0;
}
