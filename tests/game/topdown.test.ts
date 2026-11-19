import { buildLayout } from '../../src/game/layout';
import { fitView, fromScreen, toScreen } from '../../src/game/topdown';
import { loadGameData } from '../../src/sim/index';

const layout = buildLayout(loadGameData());

test('toScreen and fromScreen round-trip', () => {
  const v = fitView(layout, 1280, 720);
  for (const [x, y] of [[0, 0], [3.5, 7.25], [32, 20]] as const) {
    const p = toScreen(x, y, v);
    const back = fromScreen(p.sx, p.sy, v);
    expect(back.x).toBeCloseTo(x);
    expect(back.y).toBeCloseTo(y);
  }
});

test('toScreen is a plain top-down grid: x goes right, y goes down, equal scale', () => {
  const v = fitView(layout, 1280, 720);
  const o = toScreen(0, 0, v);
  const r = toScreen(1, 0, v);
  const d = toScreen(0, 1, v);
  expect(r.sy).toBeCloseTo(o.sy);
  expect(d.sx).toBeCloseTo(o.sx);
  expect(r.sx - o.sx).toBeCloseTo(d.sy - o.sy);
  expect(r.sx - o.sx).toBeGreaterThan(0);
});

test('fitView keeps the whole floor inside the canvas with a margin, centred', () => {
  for (const [w, h] of [[1280, 720], [1024, 900], [800, 400]] as const) {
    const v = fitView(layout, w, h);
    const a = toScreen(0, 0, v);
    const b = toScreen(layout.width, layout.depth, v);
    expect(a.sx).toBeGreaterThanOrEqual(16 - 1e-6);
    expect(a.sy).toBeGreaterThanOrEqual(16 - 1e-6);
    expect(b.sx).toBeLessThanOrEqual(w - 16 + 1e-6);
    expect(b.sy).toBeLessThanOrEqual(h - 16 + 1e-6);
    expect(Math.abs((a.sx + b.sx) / 2 - w / 2)).toBeLessThan(1);
  }
});
