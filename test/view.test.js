import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME, zoomAt, panBy, applyView, isHome, MAX_ZOOM } from '../src/view.js';
import { fitTransform } from '../src/turtle.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const W = 400;
const H = 300;
const fit = fitTransform({ minX: -1, maxX: 1, minY: 0, maxY: 2 }, W, H, 10);

test('the home view leaves the fitted drawing alone', () => {
  const t = applyView(HOME, fit, W, H);
  for (const p of [-1, 0, 0.5, 1]) {
    close(t.x(p), fit.x(p));
    close(t.y(p), fit.y(p));
  }
  assert.ok(isHome(HOME));
});

test('zooming keeps the point under the cursor fixed', () => {
  const px = 123;
  const py = 77;
  // Find the drawing point currently under the cursor, zoom twice, check it.
  const wx = (px - fit.x(0)) / fit.scale;
  const wy = (fit.y(0) - py) / fit.scale;
  let v = HOME;
  for (const factor of [2, 1.7, 0.8]) {
    v = zoomAt(v, factor, px, py, W, H);
    const t = applyView(v, fit, W, H);
    close(t.x(wx), px, 1e-6);
    close(t.y(wy), py, 1e-6);
  }
  close(v.zoom, 2 * 1.7 * 0.8);
});

test('zoom is clamped and zooming all the way out goes home', () => {
  let v = HOME;
  for (let i = 0; i < 20; i++) v = zoomAt(v, 2, 10, 10, W, H);
  assert.equal(v.zoom, MAX_ZOOM);
  v = zoomAt(v, 1 / 1000, 300, 200, W, H);
  assert.deepEqual(v, HOME);
});

test('panning moves the drawing with the pointer, within bounds', () => {
  let v = zoomAt(HOME, 4, W / 2, H / 2, W, H);
  const before = applyView(v, fit, W, H).x(0);
  v = panBy(v, 30, -10, W, H);
  close(applyView(v, fit, W, H).x(0), before + 30);
  v = panBy(v, 1e6, -1e6, W, H);
  close(v.ox, 2);
  close(v.oy, -2);
});

test('panning at zoom 1 does nothing', () => {
  assert.deepEqual(panBy(HOME, 50, 50, W, H), HOME);
});
