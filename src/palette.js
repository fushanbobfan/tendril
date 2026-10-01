// Colour ramps. A branching drawing is coloured by bracket depth, trunk to
// twig; an unbranched curve is coloured along its path, start to end.

const RAMPS = {
  spring: { bg: '#0f1410', stops: ['#94704a', '#7f8f3a', '#a8d65a', '#e9f7a8'] },
  autumn: { bg: '#170f0c', stops: ['#9a5230', '#c0582a', '#e8913a', '#f7d77a'] },
  ink: { bg: '#f4efe4', stops: ['#1d2433', '#2f4d6e', '#3d7d8c', '#8a5a3c'] },
  neon: { bg: '#0a0a14', stops: ['#6f63ff', '#b03bff', '#ff4fa3', '#ffd34f'] },
};

export function background(name) {
  return (RAMPS[name] ?? RAMPS.spring).bg;
}

function hex(c) {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
}

// Colour at t in [0, 1] along the named ramp, as "rgb(r, g, b)".
export function rampColor(name, t) {
  const stops = (RAMPS[name] ?? RAMPS.spring).stops;
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = hex(stops[i]);
  const b = hex(stops[i + 1]);
  const mix = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

// Relative luminance contrast between a ramp's background and its colours,
// worst case over the ramp. The tests hold every palette to the 3:1 that
// WCAG asks of graphics.
export function worstContrast(name, samples = 32) {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const bg = lum(hex(background(name)));
  let worst = Infinity;
  for (let i = 0; i <= samples; i++) {
    const rgb = rampColor(name, i / samples).match(/\d+/g).map(Number);
    const l = lum(rgb);
    const ratio = (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05);
    if (ratio < worst) worst = ratio;
  }
  return worst;
}
