// Zoom and pan on top of the fit-to-box transform. Offsets are stored as
// fractions of the canvas size so a resize keeps the same part in view.
//
//   screen x = (fitted x - w/2) * zoom + w/2 + ox * w

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 64;

export const HOME = Object.freeze({ zoom: 1, ox: 0, oy: 0 });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Keep at least part of the drawing on screen: the fitted drawing spans
// about zoom canvas-widths, so the centre may move at most half of that.
function bound(view) {
  const r = view.zoom / 2;
  return { zoom: view.zoom, ox: clamp(view.ox, -r, r), oy: clamp(view.oy, -r, r) };
}

// Zoom by `factor`, keeping the point under (px, py) fixed on screen.
export function zoomAt(view, factor, px, py, w, h) {
  const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  if (zoom === MIN_ZOOM) return { ...HOME };
  const ux = (px - w / 2 - view.ox * w) / view.zoom + w / 2;
  const uy = (py - h / 2 - view.oy * h) / view.zoom + h / 2;
  return bound({
    zoom,
    ox: (px - w / 2 - (ux - w / 2) * zoom) / w,
    oy: (py - h / 2 - (uy - h / 2) * zoom) / h,
  });
}

export function panBy(view, dx, dy, w, h) {
  if (view.zoom === MIN_ZOOM) return { ...HOME };
  return bound({ zoom: view.zoom, ox: view.ox + dx / w, oy: view.oy + dy / h });
}

export function isHome(view) {
  return view.zoom === 1 && view.ox === 0 && view.oy === 0;
}

// Wrap a fitTransform result so it also applies the view.
export function applyView(view, fit, w, h) {
  const { zoom, ox, oy } = view;
  return {
    scale: fit.scale * zoom,
    x: (p) => (fit.x(p) - w / 2) * zoom + w / 2 + ox * w,
    y: (p) => (fit.y(p) - h / 2) * zoom + h / 2 + oy * h,
  };
}
