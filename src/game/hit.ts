import type { StationId } from '../sim/index';
import { fromScreen, toScreen, type View } from './topdown';
import type { Scene } from './scene';

export type Hit = { kind: 'person'; key: string } | { kind: 'room'; station: StationId } | null;

/** What's under a point (in canvas CSS px). People win over the room they're standing in. */
export function hitTest(scene: Scene, view: View, sx: number, sy: number): Hit {
  const s = view.tile / 32;
  // Lower on screen is drawn later (on top), so check it first.
  const topFirst = [...scene.people].sort((a, b) => b.y - a.y || b.x - a.x);
  for (const p of topFirst) {
    const at = toScreen(p.x + 0.5, p.y + 0.5, view);
    if (Math.abs(sx - at.sx) <= 10 * s && sy >= at.sy - 10 * s && sy <= at.sy + 9 * s) return { kind: 'person', key: p.key };
  }
  const f = fromScreen(sx, sy, view);
  const room = scene.rooms.find((r) => f.x >= r.x && f.x < r.x + r.w && f.y >= r.y && f.y < r.y + r.d);
  return room ? { kind: 'room', station: room.station } : null;
}

/** Converts a pointer position to the canvas's own CSS-pixel frame, even if the page has resized the canvas. */
export function toCanvasPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  cssWidth: number,
  cssHeight: number,
): { sx: number; sy: number } {
  return {
    sx: ((clientX - rect.left) * cssWidth) / rect.width,
    sy: ((clientY - rect.top) * cssHeight) / rect.height,
  };
}
