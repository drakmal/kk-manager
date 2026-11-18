import type { ClinicLayout } from './layout';

/** 2:1 isometric view. World units are tiles; z is height in tiles. */
export interface View {
  originX: number;
  originY: number;
  /** Width in px of one tile at zoom 1. */
  tile: number;
  zoom: number;
}

const BASE_TILE = 32;
const MARGIN = 24;
/** Height of the back walls, in tiles, so fitView leaves room for them. */
export const WALL_HEIGHT = 2.4;

export function toScreen(x: number, y: number, z: number, v: View): { sx: number; sy: number } {
  const half = (v.tile / 2) * v.zoom;
  return {
    sx: v.originX + (x - y) * half,
    sy: v.originY + (x + y) * (half / 2) - z * half,
  };
}

/** Inverse of toScreen on the floor (z = 0). */
export function fromScreen(sx: number, sy: number, v: View): { x: number; y: number } {
  const half = (v.tile / 2) * v.zoom;
  const a = (sx - v.originX) / half; // x - y
  const b = (sy - v.originY) / (half / 2); // x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Painter's key: larger is nearer the viewer, so it draws later. */
export function depth(x: number, y: number): number {
  return x + y;
}

/** A view that shows the whole floor (and the back walls) centred, with a margin. */
export function fitView(layout: ClinicLayout, width: number, height: number): View {
  const unit: View = { originX: 0, originY: 0, tile: BASE_TILE, zoom: 1 };
  const pts = [
    toScreen(0, 0, WALL_HEIGHT, unit),
    toScreen(layout.width, 0, WALL_HEIGHT, unit),
    toScreen(0, layout.depth, WALL_HEIGHT, unit),
    toScreen(layout.width, layout.depth, 0, unit),
    toScreen(0, layout.depth, 0, unit),
    toScreen(layout.width, 0, 0, unit),
  ];
  const minX = Math.min(...pts.map((p) => p.sx));
  const maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy));
  const maxY = Math.max(...pts.map((p) => p.sy));
  const zoom = Math.max(0.1, Math.min((width - 2 * MARGIN) / (maxX - minX), (height - 2 * MARGIN) / (maxY - minY)));
  return {
    tile: BASE_TILE,
    zoom,
    originX: width / 2 - ((minX + maxX) / 2) * zoom,
    originY: height / 2 - ((minY + maxY) / 2) * zoom,
  };
}
