import type { ClinicLayout } from './layout';

/** Top-down view. World units are tiles: x goes right, y goes down. */
export interface View {
  originX: number;
  originY: number;
  /** Size of one tile in CSS px (whole pixels, so lines stay crisp). */
  tile: number;
}

const MARGIN = 16;

export function toScreen(x: number, y: number, v: View): { sx: number; sy: number } {
  return { sx: v.originX + x * v.tile, sy: v.originY + y * v.tile };
}

export function fromScreen(sx: number, sy: number, v: View): { x: number; y: number } {
  return { x: (sx - v.originX) / v.tile, y: (sy - v.originY) / v.tile };
}

/** The largest whole-pixel tile that fits the floor inside the canvas with a margin, centred. */
export function fitView(layout: ClinicLayout, width: number, height: number): View {
  const tile = Math.max(1, Math.floor(Math.min((width - 2 * MARGIN) / layout.width, (height - 2 * MARGIN) / layout.depth)));
  return {
    tile,
    originX: (width - tile * layout.width) / 2,
    originY: (height - tile * layout.depth) / 2,
  };
}
