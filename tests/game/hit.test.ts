import { lookFor } from '../../src/game/appearance';
import { hitTest, toCanvasPoint } from '../../src/game/hit';
import { buildLayout } from '../../src/game/layout';
import type { Scene } from '../../src/game/scene';
import { fitView, toScreen } from '../../src/game/topdown';
import { loadGameData } from '../../src/sim/index';

const layout = buildLayout(loadGameData());
const view = fitView(layout, 1280, 720);
const scene: Scene = {
  now: 600, rooms: layout.rooms, areas: layout.areas, width: layout.width, depth: layout.depth, overflow: layout.overflow,
  people: [{ key: 'p7', kind: 'patient', x: 21.5, y: 2.5, pose: 'sit', look: lookFor('p7', 'patient'), tag: null, baby: false, bubble: null, mood: '😊' }],
};

test('hitTest finds a person before the room under them', () => {
  const p = toScreen(22, 3, view); // people are drawn at the centre of their tile
  expect(hitTest(scene, view, p.sx, p.sy)).toEqual({ kind: 'person', key: 'p7' });
});

test('hitTest finds the room under an empty floor point and null outside', () => {
  const p = toScreen(28, 1, view);
  expect(hitTest(scene, view, p.sx, p.sy)).toEqual({ kind: 'room', station: 'opdRoom2' });
  expect(hitTest(scene, view, 1, 1)).toBeNull();
});

test('toCanvasPoint maps client coords for a scaled canvas (dpr 2, resized rect)', () => {
  expect(toCanvasPoint(150, 100, { left: 50, top: 0, width: 640, height: 360 }, 1280, 720)).toEqual({ sx: 200, sy: 200 });
});
