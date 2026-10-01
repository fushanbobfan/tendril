// Small seeded generator (mulberry32) so a stochastic plant regrows the same
// way from the same seed and a share link reproduces exactly what was seen.

export function makeRng(seed) {
  let a = hashSeed(seed) >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Accept numbers or strings; strings are folded with FNV-1a.
export function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.floor(seed) >>> 0;
  const s = String(seed ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
