import type { StationId } from '../sim/index';
import { hash } from './appearance';
import { depth as depthOf, toScreen, WALL_HEIGHT, type View } from './iso';
import type { Person, Scene } from './scene';

export type DrawTag =
  | 'floor' | 'grid' | 'highlight' | 'wall' | 'lowWall' | 'furniture' | 'shadow' | 'person' | 'label' | 'dot' | 'bubble';

interface Meta {
  tag: DrawTag;
  /** Which object this belongs to: a person key, `desk:<station>`, `chair`, … */
  owner?: string;
  /** Sub-part of the owner, e.g. which desk. */
  part?: string;
}

export type DrawCmd = Meta &
  (
    | { op: 'poly'; pts: number[]; fill: string | null; stroke?: string; lineWidth?: number; alpha?: number }
    | { op: 'ellipse'; x: number; y: number; rx: number; ry: number; fill: string; stroke?: string; alpha?: number }
    | { op: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number; alpha?: number }
    | { op: 'text'; x: number; y: number; text: string; size: number; fill: string; halo?: string; bold?: boolean }
    | { op: 'bubble'; x: number; y: number; text: string; size: number }
  );

export interface DrawOptions {
  lowGraphics: boolean;
  dpr: number;
  highlight: StationId | null;
}

const LOW_WALL = 0.35;
const SKIN = ['#c68b59', '#a8693a', '#e0ac7e', '#8d5a34'];
const FONT = 'Nunito, "Segoe UI", system-ui, sans-serif';

function shade(hex: string, f: number): string {
  const n = hex.replace('#', '');
  const c = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(n.slice(i, i + 2), 16) * f)));
  return `#${[c(0), c(2), c(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Everything the painter will draw, in order. Pure, so the order can be tested without pixels. */
export function buildDrawList(scene: Scene, view: View, opts: DrawOptions): DrawCmd[] {
  const s = view.zoom * (view.tile / 32);
  const P = (x: number, y: number, z = 0) => toScreen(x, y, z, view);
  const quad = (x: number, y: number, w: number, d: number, z = 0) => {
    const a = P(x, y, z), b = P(x + w, y, z), c = P(x + w, y + d, z), e = P(x, y + d, z);
    return [a.sx, a.sy, b.sx, b.sy, c.sx, c.sy, e.sx, e.sy];
  };
  const box = (x: number, y: number, w: number, d: number, h: number, color: string, meta: Meta): DrawCmd[] => {
    const f = (pts: [number, number, number][]) => pts.flatMap(([px, py, pz]) => { const p = P(px, py, pz); return [p.sx, p.sy]; });
    return [
      { op: 'poly', pts: f([[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]]), fill: shade(color, 0.82), ...meta },
      { op: 'poly', pts: f([[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]]), fill: shade(color, 0.68), ...meta },
      { op: 'poly', pts: quad(x, y, w, d, h), fill: color, stroke: shade(color, 0.75), lineWidth: 0.6, ...meta },
    ];
  };

  const out: DrawCmd[] = [];

  // 1. Floors.
  for (const a of scene.areas) out.push({ op: 'poly', pts: quad(a.x, a.y, a.w, a.d), fill: a.floor, tag: 'floor', owner: a.label });
  for (const r of scene.rooms) out.push({ op: 'poly', pts: quad(r.x, r.y, r.w, r.d), fill: r.floor, stroke: shade(r.floor, 0.9), lineWidth: 1, tag: 'floor', owner: r.station });
  if (!opts.lowGraphics) {
    for (let x = 1; x < scene.width; x++) { const a = P(x, 0), b = P(x, scene.depth); out.push({ op: 'line', x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy, stroke: '#000000', width: 1, alpha: 0.04, tag: 'grid' }); }
    for (let y = 1; y < scene.depth; y++) { const a = P(0, y), b = P(scene.width, y); out.push({ op: 'line', x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy, stroke: '#000000', width: 1, alpha: 0.04, tag: 'grid' }); }
  }
  if (opts.highlight) {
    const r = scene.rooms.find((room) => room.station === opts.highlight);
    if (r) out.push({ op: 'poly', pts: quad(r.x, r.y, r.w, r.d), fill: null, stroke: '#1f4e5a', lineWidth: 3 * s, tag: 'highlight', owner: r.station });
  }

  // 2. Tall back walls along y = 0 and x = 0.
  const back = (pts: [number, number, number][]) => pts.flatMap(([x, y, z]) => { const p = P(x, y, z); return [p.sx, p.sy]; });
  out.push({ op: 'poly', pts: back([[0, 0, 0], [scene.width, 0, 0], [scene.width, 0, WALL_HEIGHT], [0, 0, WALL_HEIGHT]]), fill: '#e9e4d8', stroke: '#b9b2a2', tag: 'wall' });
  out.push({ op: 'poly', pts: back([[0, 0, 0], [0, scene.depth, 0], [0, scene.depth, WALL_HEIGHT], [0, 0, WALL_HEIGHT]]), fill: '#d4cebf', stroke: '#b9b2a2', tag: 'wall' });

  // 3. Low cut-away walls around each room (not on the back edges).
  for (const r of scene.rooms) {
    const t = 0.12;
    if (r.y + r.d < scene.depth) out.push(...box(r.x, r.y + r.d - t / 2, r.w, t, LOW_WALL, '#9a948a', { tag: 'lowWall', owner: r.station }));
    if (r.x + r.w < scene.width) out.push(...box(r.x + r.w - t / 2, r.y, t, r.d, LOW_WALL, '#9a948a', { tag: 'lowWall', owner: r.station }));
  }

  // 4. Furniture and people, sorted back to front.
  const objects: { key: number; cmds: DrawCmd[] }[] = [];
  const chairAt = (x: number, y: number) =>
    objects.push({ key: depthOf(x, y) - 0.01, cmds: box(x - 0.3, y - 0.25, 0.6, 0.55, 0.45, '#7d93ad', { tag: 'furniture', owner: 'chair' }) });
  for (const r of scene.rooms) {
    r.seats.forEach((seat, i) =>
      objects.push({ key: depthOf(seat.x, seat.y + 0.6), cmds: box(seat.x - 0.45, seat.y + 0.35, 0.9, 0.5, 0.75, '#b98a5e', { tag: 'furniture', owner: `desk:${r.station}`, part: `seat${i}` }) }));
    for (const c of r.chairs) chairAt(c.x, c.y);
    for (const q of r.queue) chairAt(q.x, q.y);
    if (r.station === 'ancNurse' || r.station === 'mchDoctor') {
      const cx = r.x + r.w - 1.4;
      objects.push({ key: depthOf(cx + 0.5, r.y + 2), cmds: box(cx, r.y + 0.5, 1.0, 2.6, 0.6, '#f4f6f8', { tag: 'furniture', owner: `couch:${r.station}` }) });
    }
  }
  for (const o of scene.overflow) chairAt(o.x, o.y);

  const overlays: DrawCmd[] = [];
  const bubbles: DrawCmd[] = [];
  for (const person of scene.people) {
    const { cmds, headY } = drawPerson(person, P, s, opts.lowGraphics);
    objects.push({ key: depthOf(person.x, person.y), cmds });
    const p = P(person.x, person.y);
    if (person.tag) overlays.push({ op: 'ellipse', x: p.sx + 9 * s, y: headY - 9 * s, rx: 4.5 * s, ry: 4.5 * s, fill: person.tag, stroke: '#ffffff', tag: 'dot', owner: person.key });
    if (person.bubble) bubbles.push({ op: 'bubble', x: p.sx, y: headY - 14 * s, text: person.bubble, size: 12 * Math.max(0.8, Math.min(1.4, s)), tag: 'bubble', owner: person.key });
  }
  objects.sort((a, b) => a.key - b.key);
  for (const o of objects) out.push(...o.cmds);

  // 5. Room labels, 6. purpose dots, 7. speech bubbles.
  for (const r of scene.rooms) {
    const c = P(r.x + r.w / 2, r.y + r.d / 2);
    out.push({ op: 'text', x: c.sx, y: c.sy + 4 * s, text: r.label.toUpperCase(), size: 10 * Math.max(0.8, s), fill: '#4d473b', halo: '#ffffff', bold: true, tag: 'label', owner: r.station });
  }
  out.push(...overlays, ...bubbles);
  return out;
}

function drawPerson(
  person: Person,
  P: (x: number, y: number, z?: number) => { sx: number; sy: number },
  s: number,
  lowGraphics: boolean,
): { cmds: DrawCmd[]; headY: number } {
  const meta = { owner: person.key };
  const { sx, sy } = P(person.x, person.y);
  const sit = person.pose === 'sit';
  const bodyH = (sit ? 13 : 20) * s;
  const lift = (sit ? 9 : 0) * s;
  const top = sy - bodyH - 6 * s - lift;
  const headY = top - 6 * s;
  const rect = (x: number, y: number, w: number, h: number) => [x, y, x + w, y, x + w, y + h, x, y + h];
  const look = person.look;
  const outline = look.body === '#ffffff' ? '#9fb3c8' : shade(look.body, 0.7);
  const cmds: DrawCmd[] = [];
  if (!lowGraphics) cmds.push({ op: 'ellipse', x: sx, y: sy, rx: 8 * s, ry: 4 * s, fill: '#000000', alpha: 0.18, tag: 'shadow', ...meta });
  if (!sit) {
    cmds.push({ op: 'poly', pts: rect(sx - 4.5 * s, sy - 8 * s, 3.5 * s, 8 * s), fill: '#3d3a45', tag: 'person', ...meta });
    cmds.push({ op: 'poly', pts: rect(sx + 1 * s, sy - 8 * s, 3.5 * s, 8 * s), fill: '#3d3a45', tag: 'person', ...meta });
  }
  cmds.push({ op: 'poly', pts: rect(sx - 7 * s, top, 14 * s, bodyH), fill: look.body, stroke: outline, lineWidth: 1, tag: 'person', ...meta });
  if (look.uniform === 'doctor') {
    cmds.push({ op: 'line', x1: sx - 3 * s, y1: top + 2 * s, x2: sx + 3 * s, y2: top + 7 * s, stroke: '#2b2f36', width: 1.4 * s, tag: 'person', ...meta });
  }
  const skin = SKIN[hash(person.key) % SKIN.length]!;
  if (look.hijab) {
    cmds.push({ op: 'ellipse', x: sx, y: headY, rx: 7 * s, ry: 7 * s, fill: look.head, stroke: look.head === '#ffffff' ? '#b0bcc8' : shade(look.head, 0.75), tag: 'person', ...meta });
    cmds.push({ op: 'ellipse', x: sx + 1.5 * s, y: headY + 0.5 * s, rx: 3.6 * s, ry: 4.2 * s, fill: skin, tag: 'person', ...meta });
  } else {
    cmds.push({ op: 'ellipse', x: sx, y: headY, rx: 6.5 * s, ry: 6.5 * s, fill: skin, tag: 'person', ...meta });
    cmds.push({ op: 'poly', pts: [sx - 6.5 * s, headY - 1 * s, sx - 4 * s, headY - 6 * s, sx + 4 * s, headY - 6 * s, sx + 6.5 * s, headY - 1 * s], fill: look.head, tag: 'person', ...meta });
  }
  if (person.baby) cmds.push({ op: 'ellipse', x: sx + 6 * s, y: top + 6 * s, rx: 4.5 * s, ry: 4.5 * s, fill: '#fff4e0', stroke: '#d8c3a0', tag: 'person', ...meta });
  return { cmds, headY };
}

/** Sends a draw list to a 2D context. */
export function paint(ctx: CanvasRenderingContext2D, list: DrawCmd[], dpr: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const canvas = (ctx as { canvas?: { width?: number; height?: number } }).canvas;
  ctx.clearRect(0, 0, (canvas?.width ?? 10000) / dpr, (canvas?.height ?? 10000) / dpr);
  for (const c of list) {
    ctx.globalAlpha = 'alpha' in c && c.alpha !== undefined ? c.alpha : 1;
    switch (c.op) {
      case 'poly': {
        ctx.beginPath();
        ctx.moveTo(c.pts[0]!, c.pts[1]!);
        for (let i = 2; i < c.pts.length; i += 2) ctx.lineTo(c.pts[i]!, c.pts[i + 1]!);
        ctx.closePath();
        if (c.fill) { ctx.fillStyle = c.fill; ctx.fill(); }
        if (c.stroke) { ctx.strokeStyle = c.stroke; ctx.lineWidth = c.lineWidth ?? 1; ctx.stroke(); }
        break;
      }
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = c.fill;
        ctx.fill();
        if (c.stroke) { ctx.strokeStyle = c.stroke; ctx.lineWidth = 1; ctx.stroke(); }
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(c.x1, c.y1);
        ctx.lineTo(c.x2, c.y2);
        ctx.strokeStyle = c.stroke;
        ctx.lineWidth = c.width;
        ctx.stroke();
        break;
      case 'text':
        ctx.font = `${c.bold ? '800 ' : ''}${c.size}px ${FONT}`;
        ctx.textAlign = 'center';
        if (c.halo) { ctx.strokeStyle = c.halo; ctx.lineWidth = 3; ctx.strokeText(c.text, c.x, c.y); }
        ctx.fillStyle = c.fill;
        ctx.fillText(c.text, c.x, c.y);
        break;
      case 'bubble': {
        ctx.font = `${c.size}px ${FONT}`;
        const w = ctx.measureText(c.text).width + c.size * 1.4;
        const h = c.size * 2;
        const x = c.x - w / 2;
        const y = c.y - h;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h);
        ctx.lineTo(c.x + 5, y + h); ctx.lineTo(c.x, y + h + 7); ctx.lineTo(c.x - 5, y + h);
        ctx.lineTo(x, y + h); ctx.closePath();
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = '#9aa5b1'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#33404d';
        ctx.textAlign = 'center';
        ctx.fillText(c.text, c.x, y + h * 0.68);
        break;
      }
    }
  }
  ctx.globalAlpha = 1;
}

export function draw(ctx: CanvasRenderingContext2D, scene: Scene, view: View, opts: DrawOptions): void {
  paint(ctx, buildDrawList(scene, view, opts), opts.dpr);
}
