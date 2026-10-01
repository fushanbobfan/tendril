// Scene settings: defaults, clamping and share-link encoding.

import { findPreset, PRESETS } from './presets.js';

export const PALETTES = ['spring', 'autumn', 'ink', 'neon'];

export const LIMITS = {
  iterations: [0, 16],
  angle: [0, 180],
  heading: [-180, 180],
  jitter: [0, 30],
  widthDecay: [0.3, 1],
  lengthDecay: [0.3, 1],
  lineWidth: [0.25, 8],
};

export function fromPreset(id) {
  const p = findPreset(id) ?? PRESETS[0];
  return clampSettings({
    preset: p.id,
    axiom: p.axiom,
    rules: p.rules,
    iterations: p.iterations,
    angle: p.angle,
    draw: p.draw,
    heading: 90,
    jitter: 0,
    seed: 1,
    widthDecay: 0.7,
    lengthDecay: 0.8,
    lineWidth: 1.5,
    palette: p.group === 'Plants' ? 'spring' : 'ink',
  });
}

const clamp = (v, [lo, hi], fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

export function clampSettings(s) {
  const base = s.preset ? findPreset(s.preset) : null;
  const out = { ...s };
  out.iterations = Math.round(clamp(s.iterations, LIMITS.iterations, base?.iterations ?? 4));
  out.angle = clamp(s.angle, LIMITS.angle, 25);
  out.heading = clamp(s.heading, LIMITS.heading, 90);
  out.jitter = clamp(s.jitter, LIMITS.jitter, 0);
  out.widthDecay = clamp(s.widthDecay, LIMITS.widthDecay, 0.7);
  out.lengthDecay = clamp(s.lengthDecay, LIMITS.lengthDecay, 0.8);
  out.lineWidth = clamp(s.lineWidth, LIMITS.lineWidth, 1.5);
  out.seed = Math.max(0, Math.floor(clamp(s.seed, [0, 2 ** 32 - 1], 1)));
  out.palette = PALETTES.includes(s.palette) ? s.palette : 'spring';
  out.axiom = String(s.axiom ?? '').slice(0, 200);
  out.rules = String(s.rules ?? '').slice(0, 4000);
  out.draw = String(s.draw ?? 'F').replace(/[\s[\]+\-|!"f]/g, '').slice(0, 12) || 'F';
  return out;
}

const KEYS = {
  p: 'preset',
  a: 'axiom',
  r: 'rules',
  n: 'iterations',
  d: 'angle',
  h: 'heading',
  w: 'draw',
  j: 'jitter',
  s: 'seed',
  t: 'widthDecay',
  l: 'lengthDecay',
  lw: 'lineWidth',
  c: 'palette',
};

// Only fields that differ from the preset go into the link, so a link to an
// untouched preset stays short.
export function encodeHash(settings) {
  const base = fromPreset(settings.preset);
  const q = new URLSearchParams();
  q.set('p', settings.preset);
  for (const [k, name] of Object.entries(KEYS)) {
    if (name === 'preset') continue;
    if (settings[name] !== base[name]) q.set(k, String(settings[name]));
  }
  return '#' + q.toString();
}

export function decodeHash(hash) {
  const q = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const preset = findPreset(q.get('p')) ? q.get('p') : PRESETS[0].id;
  const s = fromPreset(preset);
  for (const [k, name] of Object.entries(KEYS)) {
    if (name === 'preset' || !q.has(k)) continue;
    const v = q.get(k);
    s[name] = typeof s[name] === 'number' ? Number(v) : v;
  }
  return clampSettings(s);
}
