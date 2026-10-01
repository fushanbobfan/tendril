import { PRESETS, findPreset } from './presets.js';
import { parseRules, derive, isStochastic } from './lsystem.js';
import { interpret, fitTransform, STRIDE } from './turtle.js';
import { buildBatches, toSVG } from './render.js';
import { background } from './palette.js';
import { fromPreset, clampSettings, encodeHash, decodeHash } from './params.js';
import { litter } from './mutate.js';
import { HOME, zoomAt, panBy, applyView, isHome } from './view.js';

const $ = (id) => document.getElementById(id);
const canvas = $('garden');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let settings = location.hash.length > 1 ? decodeHash(location.hash) : fromPreset(PRESETS[0].id);
let grown = null; // { key, word, reached, capped, lengths }
let drawn = null; // { key, turtle }
let batches = null;
let progress = 1;
let animStart = 0;
let animFrame = 0;
let rulesError = '';
let view = { ...HOME };

const GROW_MS = 2600;

// ---- controls -------------------------------------------------------------

function fillPresets() {
  const sel = $('preset');
  for (const group of [...new Set(PRESETS.map((p) => p.group))]) {
    const og = document.createElement('optgroup');
    og.label = group;
    for (const p of PRESETS.filter((q) => q.group === group)) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      og.append(o);
    }
    sel.append(og);
  }
  const custom = document.createElement('option');
  custom.value = '';
  custom.textContent = 'Edited grammar';
  custom.hidden = true;
  sel.append(custom);
}

const NUMERIC = ['iterations', 'angle', 'heading', 'jitter', 'lineWidth', 'seed'];
const FORMAT = {
  iterations: (v) => String(v),
  angle: (v) => `${v}°`,
  heading: (v) => `${v}°`,
  jitter: (v) => `±${v}°`,
  lineWidth: (v) => `${v} px`,
};

function edited() {
  const base = findPreset(settings.preset);
  return !base || base.axiom !== settings.axiom || base.rules !== settings.rules || base.draw !== settings.draw;
}

function syncControls() {
  $('preset').value = edited() ? '' : settings.preset;
  $('note').textContent = edited() ? 'Edited from ' + (findPreset(settings.preset)?.name ?? 'a preset') + '.' : findPreset(settings.preset)?.note ?? '';
  for (const k of ['axiom', 'rules', 'draw', 'palette']) if ($(k).value !== settings[k]) $(k).value = settings[k];
  for (const k of NUMERIC) {
    if (Number($(k).value) !== settings[k] || $(k).value === '') $(k).value = settings[k];
    if (FORMAT[k]) $(`${k}-out`).textContent = FORMAT[k](settings[k]);
  }
}

function update(patch, { regrow = false } = {}) {
  settings = clampSettings({ ...settings, ...patch });
  syncControls();
  history.replaceState(null, '', encodeHash(settings));
  rebuild();
  if (regrow && $('animate').checked) startGrowth();
  else draw();
}

function bind() {
  $('preset').addEventListener('change', (e) => {
    if (!e.target.value) return;
    const animate = $('animate').checked;
    settings = fromPreset(e.target.value);
    resetLineage();
    setView(HOME);
    syncControls();
    $('animate').checked = animate;
    update({}, { regrow: true });
  });
  for (const k of ['axiom', 'rules', 'draw']) {
    $(k).addEventListener('input', (e) => update({ [k]: e.target.value }));
  }
  $('palette').addEventListener('change', (e) => update({ palette: e.target.value }));
  for (const k of NUMERIC) {
    $(k).addEventListener('input', (e) => {
      if (e.target.value === '') return;
      update({ [k]: Number(e.target.value) }, { regrow: k === 'iterations' || k === 'seed' });
    });
  }
  $('grow').addEventListener('click', startGrowth);
  $('breed').addEventListener('click', breed);
  $('back').addEventListener('click', back);
  $('reseed').addEventListener('click', reseed);
  $('share').addEventListener('click', share);
  $('png').addEventListener('click', savePNG);
  $('svg').addEventListener('click', saveSVG);
  $('animate').addEventListener('change', () => {
    if (!$('animate').checked) finishGrowth();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'g') startGrowth();
    else if (key === 'n') reseed();
    else if (key === '[') update({ iterations: settings.iterations - 1 }, { regrow: true });
    else if (key === ']') update({ iterations: settings.iterations + 1 }, { regrow: true });
    else if (key === 'b') breed();
    else if (key === '+' || key === '=') zoomCentre(1.5);
    else if (key === '-') zoomCentre(1 / 1.5);
    else if (key === '0') setView(HOME, true);
    else if (key === 'z') back();
    else return;
    e.preventDefault();
  });
  window.addEventListener('hashchange', () => {
    if (location.hash === encodeHash(settings)) return;
    settings = decodeHash(location.hash);
    resetLineage();
    setView(HOME);
    syncControls();
    rebuild();
    draw();
  });
  new ResizeObserver(resize).observe(canvas);
  bindView();
}

function reseed() {
  update({ seed: Math.floor(Math.random() * 1e6) }, { regrow: true });
}

// ---- model ----------------------------------------------------------------

function rebuild() {
  const { rules, errors } = parseRules(settings.rules);
  rulesError = errors.map((e) => `Line ${e.line}: ${e.message}`).join('\n');
  $('rule-errors').textContent = rulesError;

  const growKey = JSON.stringify([settings.axiom, settings.rules, settings.iterations, settings.seed]);
  if (!grown || grown.key !== growKey) {
    grown = { key: growKey, ...derive(settings.axiom, rules, settings.iterations, { seed: settings.seed }), stochastic: isStochastic(rules) };
    drawn = null;
  }
  const s = settings;
  const drawKey = JSON.stringify([growKey, s.angle, s.heading, s.draw, s.jitter, s.widthDecay, s.lengthDecay]);
  if (!drawn || drawn.key !== drawKey) {
    drawn = {
      key: drawKey,
      turtle: interpret(grown.word, {
        angle: s.angle,
        heading: s.heading,
        draw: s.draw,
        jitter: s.jitter,
        seed: s.seed,
        widthDecay: s.widthDecay,
        lengthDecay: s.lengthDecay,
      }),
    };
  }
  batches = buildBatches(drawn.turtle, { palette: s.palette, lineWidth: s.lineWidth });
  describe();
}

const fmt = (n) => n.toLocaleString('en-US');

function describe() {
  const t = drawn.turtle;
  const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
  const parts = [plural(grown.word.length, 'symbol'), plural(t.count, 'stroke')];
  if (t.count === 0) parts.push(`nothing to draw: the word has no ${settings.draw.split('').join(' or ')}`);
  if (t.maxDepth > 0) parts.push(`branch depth ${t.maxDepth}`);
  if (grown.capped) parts.push(`stopped at generation ${grown.reached}: the next one would pass the symbol limit`);
  if (t.unmatched || t.unclosed) parts.push('unbalanced brackets');
  if (grown.stochastic && settings.jitter === 0) parts.push('random rules: try a new seed');
  $('stats').textContent = parts.join(' · ');
  const name = edited() ? 'Edited L-system' : findPreset(settings.preset)?.name;
  canvas.setAttribute(
    'aria-label',
    `${name}, generation ${grown.reached}: ${fmt(t.count)} strokes` + (t.maxDepth > 0 ? `, branching ${t.maxDepth} levels deep` : ''),
  );
}

// ---- drawing --------------------------------------------------------------

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    draw();
  }
}

function paint(target, w, h, scaleWidth, limit, t = drawn.turtle, strokes = batches, palette = settings.palette, v = HOME) {
  target.fillStyle = background(palette);
  target.fillRect(0, 0, w, h);
  if (t.count === 0) return;
  const f = applyView(v, fitTransform(t.bounds, w, h, 18 * scaleWidth), w, h);
  const s = t.segments;
  target.lineCap = 'round';
  target.lineJoin = 'round';
  for (const b of strokes) {
    target.beginPath();
    let lx = NaN;
    let ly = NaN;
    for (const i of b.indices) {
      if (i >= limit) break;
      const o = i * STRIDE;
      const x1 = f.x(s[o]);
      const y1 = f.y(s[o + 1]);
      if (x1 !== lx || y1 !== ly) target.moveTo(x1, y1);
      lx = f.x(s[o + 2]);
      ly = f.y(s[o + 3]);
      target.lineTo(lx, ly);
    }
    target.strokeStyle = b.color;
    target.lineWidth = b.width * scaleWidth;
    target.stroke();
  }
}

function draw() {
  if (!drawn) return;
  const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
  paint(ctx, canvas.width, canvas.height, dpr, Math.ceil(drawn.turtle.count * progress), drawn.turtle, batches, settings.palette, view);
}

function startGrowth() {
  if (reduceMotion && !$('animate').checked) return finishGrowth();
  cancelAnimationFrame(animFrame);
  progress = 0;
  animStart = performance.now();
  animFrame = requestAnimationFrame(tick);
}

function tick(now) {
  progress = Math.min(1, (now - animStart) / GROW_MS);
  draw();
  if (progress < 1) animFrame = requestAnimationFrame(tick);
}

function finishGrowth() {
  cancelAnimationFrame(animFrame);
  progress = 1;
  draw();
}

// ---- zoom and pan ---------------------------------------------------------

function setView(v, redraw = false) {
  view = v;
  const home = isHome(view);
  $('home').disabled = home;
  $('home').textContent = home ? 'Reset view' : `Reset view (×${view.zoom.toFixed(view.zoom < 10 ? 1 : 0)})`;
  canvas.classList.toggle('zoomed', !home);
  if (redraw) draw();
}

// Pointer position in canvas pixels.
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) * canvas.width) / r.width, ((e.clientY - r.top) * canvas.height) / r.height];
}

function zoomCentre(factor) {
  setView(zoomAt(view, factor, canvas.width / 2, canvas.height / 2, canvas.width, canvas.height), true);
}

function bindView() {
  const pointers = new Map();
  let pinch = 0;

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const [px, py] = canvasPoint(e);
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      setView(zoomAt(view, factor, px, py, canvas.width, canvas.height), true);
    },
    { passive: false },
  );
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, canvasPoint(e));
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const now = canvasPoint(e);
    pointers.set(e.pointerId, now);
    if (pointers.size === 1) {
      setView(panBy(view, now[0] - prev[0], now[1] - prev[1], canvas.width, canvas.height), true);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0) setView(zoomAt(view, dist / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, canvas.width, canvas.height), true);
      pinch = dist;
    }
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('dblclick', () => setView(HOME, true));
  canvas.addEventListener('keydown', (e) => {
    const step = 40 * (window.devicePixelRatio || 1);
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setView(panBy(view, m[0], m[1], canvas.width, canvas.height), true);
  });
  $('home').addEventListener('click', () => setView(HOME, true));
}

// ---- breeding -------------------------------------------------------------

const LITTER = 6;
const THUMB_SYMBOLS = 250_000;
let lineage = []; // parents of the current grammar, oldest first
let rounds = 0;

function resetLineage() {
  lineage = [];
  $('litter').replaceChildren();
  showLineage();
}

function showLineage() {
  $('back').disabled = lineage.length === 0;
  const root = findPreset((lineage[0] ?? settings).preset)?.name ?? 'the grammar';
  $('lineage').textContent = lineage.length
    ? `${lineage.length} ${lineage.length === 1 ? 'pick' : 'picks'} away from ${root}. Pick again, or step back to the parent.`
    : 'Each offspring changes one thing in the grammar. Pick the one you like and breed again.';
}

function grow(s) {
  const { rules } = parseRules(s.rules);
  const { word } = derive(s.axiom, rules, s.iterations, { seed: s.seed, maxSymbols: THUMB_SYMBOLS });
  return interpret(word, { angle: s.angle, heading: s.heading, draw: s.draw, jitter: s.jitter, seed: s.seed, widthDecay: s.widthDecay, lengthDecay: s.lengthDecay });
}

function breed() {
  rounds++;
  const kids = litter(settings, LITTER, `${settings.seed}:${lineage.length}:${rounds}`);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.round(220 * dpr);
  const items = kids.map((kid, i) => {
    const child = clampSettings(kid.settings);
    const turtle = grow(child);
    const strokes = buildBatches(turtle, { palette: child.palette, lineWidth: Math.max(0.5, child.lineWidth * 0.6) });
    const thumb = document.createElement('canvas');
    thumb.width = size;
    thumb.height = size;
    thumb.setAttribute('aria-hidden', 'true');
    paint(thumb.getContext('2d'), size, size, dpr, Infinity, turtle, strokes, child.palette);
    const caption = document.createElement('span');
    caption.className = 'what';
    caption.textContent = kid.what;
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Offspring ${i + 1}: ${kid.what}, ${turtle.count.toLocaleString('en-US')} strokes`);
    button.append(thumb, caption);
    button.addEventListener('click', () => adopt(child));
    const li = document.createElement('li');
    li.append(button);
    return li;
  });
  $('litter').replaceChildren(...items);
  showLineage();
}

function adopt(child) {
  lineage.push(settings);
  settings = child;
  setView(HOME);
  update({}, { regrow: true });
  breed();
  $('litter').querySelector('button')?.focus();
}

function back() {
  if (lineage.length === 0) return;
  settings = lineage.pop();
  setView(HOME);
  update({}, { regrow: true });
  breed();
}

// ---- export ---------------------------------------------------------------

function fileStem() {
  return `tendril-${edited() ? 'custom' : settings.preset}-g${grown.reached}`;
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function toast(msg) {
  $('toast').textContent = msg;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($('toast').textContent = ''), 3000);
}

function savePNG() {
  const size = 2048;
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  paint(off.getContext('2d'), size, size, size / 800, Infinity);
  off.toBlob((blob) => {
    download(`${fileStem()}.png`, blob);
    toast('PNG saved.');
  });
}

function saveSVG() {
  const svg = toSVG(drawn.turtle, batches, 1000, 1000, { palette: settings.palette, pad: 22 });
  download(`${fileStem()}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
  toast('SVG saved.');
}

async function share() {
  const url = location.href.split('#')[0] + encodeHash(settings);
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied.');
  } catch {
    toast(url);
  }
}

// ---- start ----------------------------------------------------------------

fillPresets();
$('animate').checked = !reduceMotion;
syncControls();
bind();
rebuild();
resize();
startGrowth();
