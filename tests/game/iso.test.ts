import { buildLayout } from '../../src/game/layout';
import { depth, fitView, fromScreen, toScreen, type View } from '../../src/game/iso';
import { loadGameData } from '../../src/sim/data';

const view: View = { originX: 400, originY: 100, tile: 32, zoom: 1.5 };

test('toScreen/fromScreen round-trip at z=0', () => {
  for (const [x, y] of [[0, 0], [3, 7], [12.5, 4.25], [29, 19]] as const) {
    const { sx, sy } = toScreen(x, y, 0, view);
    const back = fromScreen(sx, sy, view);
    expect(back.x).toBeCloseTo(x, 9);
    expect(back.y).toBeCloseTo(y, 9);
  }
});

test('toScreen follows the 2:1 formula', () => {
  expect(toScreen(1, 0, 0, view)).toEqual({ sx: 400 + 24, sy: 100 + 12 });
  expect(toScreen(0, 1, 0, view)).toEqual({ sx: 400 - 24, sy: 100 + 12 });
});

test('higher z draws higher on screen', () => {
  expect(toScreen(2, 2, 1, view).sy).toBeLessThan(toScreen(2, 2, 0, view).sy);
});

test('depth is x + y', () => {
  expect(depth(3, 4)).toBe(7);
});

test('fitView keeps all four floor corners inside the canvas with margin', () => {
  const layout = buildLayout(loadGameData());
  for (const [W, H] of [[1280, 720], [1024, 600], [1920, 1080]] as const) {
    const v = fitView(layout, W, H);
    for (const [x, y] of [[0, 0], [layout.width, 0], [layout.width, layout.depth], [0, layout.depth]] as const) {
      const { sx, sy } = toScreen(x, y, 0, v);
      expect(sx).toBeGreaterThanOrEqual(24 - 1e-9);
      expect(sx).toBeLessThanOrEqual(W - 24 + 1e-9);
      expect(sy).toBeGreaterThanOrEqual(24 - 1e-9);
      expect(sy).toBeLessThanOrEqual(H - 24 + 1e-9);
    }
  }
});
