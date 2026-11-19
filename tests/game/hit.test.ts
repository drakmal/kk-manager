import { hitTest, toCanvasPoint } from '../../src/game/hit';
import { fitView, toScreen } from '../../src/game/iso';
import { buildLayout } from '../../src/game/layout';
import type { Scene } from '../../src/game/scene';
import { lookFor } from '../../src/game/appearance';
import { loadGameData } from '../../src/sim/data';

const layout = buildLayout(loadGameData());
const view = fitView(layout, 1280, 720);
const nurseRoom = layout.rooms.find((r) => r.station === 'ancNurse')!;
const centre = { x: nurseRoom.x + nurseRoom.w / 2, y: nurseRoom.y + nurseRoom.d / 2 };
const scene: Scene = {
  now: 540, rooms: layout.rooms, areas: layout.areas, width: layout.width, depth: layout.depth, overflow: layout.overflow,
  people: [{ key: 'p1', kind: 'patient', x: centre.x, y: centre.y, pose: 'sit', look: lookFor('p1', 'patient'), tag: null, baby: false, bubble: null }],
};

test('hitTest finds a person before the room under them', () => {
  const p = toScreen(centre.x, centre.y, 0, view);
  expect(hitTest(scene, view, p.sx, p.sy - 10)).toEqual({ kind: 'person', key: 'p1' });
});

test('hitTest finds the room under an empty floor point and null outside', () => {
  const corner = toScreen(nurseRoom.x + 0.5, nurseRoom.y + 0.5, 0, view);
  expect(hitTest(scene, view, corner.sx, corner.sy)).toEqual({ kind: 'room', station: 'ancNurse' });
  expect(hitTest(scene, view, 2, 2)).toBeNull();
});

test('toCanvasPoint maps client coords for a scaled canvas (dpr 2, resized rect)', () => {
  // The canvas thinks in 1280×720 CSS px, but the page shows it squeezed into 640×360 at (100, 50).
  // Device pixel ratio only changes the backing store, not these coordinates.
  const rect = { left: 100, top: 50, width: 640, height: 360 };
  expect(toCanvasPoint(100, 50, rect, 1280, 720)).toEqual({ sx: 0, sy: 0 });
  expect(toCanvasPoint(420, 230, rect, 1280, 720)).toEqual({ sx: 640, sy: 360 });
  expect(toCanvasPoint(740, 410, rect, 1280, 720)).toEqual({ sx: 1280, sy: 720 });
});
