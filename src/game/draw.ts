import type { StationId } from '../sim/index';
import { hash } from './appearance';
import type { Furniture } from './layout';
import type { Person, Scene } from './scene';
import { toScreen, type View } from './topdown';

export type DrawTag =
  | 'floor' | 'grid' | 'highlight' | 'wall' | 'furniture' | 'shadow' | 'person' | 'label' | 'dot' | 'mood' | 'bubble';

interface Meta {
  tag: DrawTag;
  /** Which object this belongs to: a person key, `desk:<station>`, `ultrasound:<station>`, … */
  owner?: string;
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

const SKIN = ['#c68b59', '#a8693a', '#e0ac7e', '#8d5a34'];
const FONT = 'Nunito, "Segoe UI", system-ui, sans-serif';
const WALL = '#8f8678';
const FURNITURE: Record<Furniture['kind'], string> = {
  desk: '#b98a5e', bed: '#f4f6f8', ultrasound: '#8a96a3', xray: '#9aa7b4', counter: '#c9a57a', shelf: '#b7a58c',
};

function shade(hex: string, f: number): string {
  const n = hex.replace('#', '');
  const c = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(n.slice(i, i + 2), 16) * f)));
  return `#${[c(0), c(2), c(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Everything the painter will draw, in order. Pure, so the order can be tested without pixels. */
export function buildDrawList(scene: Scene, view: View, opts: DrawOptions): DrawCmd[] {
  const s = view.tile / 32;
  const P = (x: number, y: number) => toScreen(x, y, view);
  const rect = (x: number, y: number, w: number, h: number) => {
    const a = P(x, y), b = P(x + w, y + h);
    return [a.sx, a.sy, b.sx, a.sy, b.sx, b.sy, a.sx, b.sy];
  };
  const out: DrawCmd[] = [];

  // 1. Floors: lobby, waiting areas, then rooms.
  for (const a of scene.areas) out.push({ op: 'poly', pts: rect(a.x, a.y, a.w, a.d), fill: a.floor, tag: 'floor', owner: a.label });
  for (const r of scene.rooms) out.push({ op: 'poly', pts: rect(r.x, r.y, r.w, r.d), fill: r.floor, tag: 'floor', owner: r.station });
  if (!opts.lowGraphics) {
    for (let x = 1; x < scene.width; x++) { const a = P(x, 0), b = P(x, scene.depth); out.push({ op: 'line', x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy, stroke: '#000000', width: 1, alpha: 0.04, tag: 'grid' }); }
    for (let y = 1; y < scene.depth; y++) { const a = P(0, y), b = P(scene.width, y); out.push({ op: 'line', x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy, stroke: '#000000', width: 1, alpha: 0.04, tag: 'grid' }); }
  }

  // 2. Walls: each room outlined, the whole floor framed.
  for (const r of scene.rooms) out.push({ op: 'poly', pts: rect(r.x, r.y, r.w, r.d), fill: null, stroke: WALL, lineWidth: Math.max(1, 2 * s), tag: 'wall', owner: r.station });
  out.push({ op: 'poly', pts: rect(0, 0, scene.width, scene.depth), fill: null, stroke: shade(WALL, 0.8), lineWidth: Math.max(1.5, 3 * s), tag: 'wall' });
  if (opts.highlight) {
    const r = scene.rooms.find((room) => room.station === opts.highlight);
    if (r) out.push({ op: 'poly', pts: rect(r.x, r.y, r.w, r.d), fill: null, stroke: '#1f4e5a', lineWidth: 3 * s, tag: 'highlight', owner: r.station });
  }

  // 3. Furniture. Low graphics keeps only the desks.
  const chair = (x: number, y: number) =>
    out.push({ op: 'poly', pts: rect(x + 0.22, y + 0.22, 0.56, 0.56), fill: '#7d93ad', tag: 'furniture', owner: 'chair' });
  for (const r of scene.rooms) {
    r.seats.forEach((seat, i) =>
      out.push({ op: 'poly', pts: rect(seat.x - 0.1, seat.y + 0.55, 1.2, 0.45), fill: FURNITURE.desk, stroke: shade(FURNITURE.desk, 0.75), lineWidth: 1, tag: 'furniture', owner: `desk:${r.station}`, part: `seat${i}` }));
    if (opts.lowGraphics) continue;
    for (const c of r.chairs) chair(c.x, c.y);
    for (const q of r.queue) chair(q.x, q.y);
    for (const f of r.furniture) {
      const color = FURNITURE[f.kind];
      const owner = `${f.kind}:${r.station}`;
      out.push({ op: 'poly', pts: rect(f.x, f.y, f.w, f.h), fill: color, stroke: shade(color, 0.7), lineWidth: 1, tag: 'furniture', owner });
      if (f.kind === 'ultrasound') {
        // The scanner's screen and probe cable.
        out.push({ op: 'poly', pts: rect(f.x + 0.15, f.y + 0.1, f.w - 0.3, f.h * 0.45), fill: '#1d2733', tag: 'furniture', owner });
        const a = P(f.x + f.w * 0.5, f.y + f.h * 0.7), b = P(f.x - 0.3, f.y + f.h * 0.9);
        out.push({ op: 'line', x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy, stroke: '#4a5560', width: 1.2 * s, tag: 'furniture', owner });
      }
      if (f.kind === 'bed') out.push({ op: 'poly', pts: rect(f.x + 0.1, f.y + 0.1, f.w - 0.2, Math.min(0.5, f.h * 0.25)), fill: '#dfe7ef', tag: 'furniture', owner });
    }
  }
  if (!opts.lowGraphics) for (const o of scene.overflow) chair(o.x, o.y);

  // 4. Room labels, along the bottom edge inside each room.
  for (const r of scene.rooms) {
    const c = P(r.x + r.w / 2, r.y + r.d - 0.35);
    out.push({ op: 'text', x: c.sx, y: c.sy, text: r.label.toUpperCase(), size: Math.max(8, 9 * s), fill: '#4d473b', halo: '#ffffff', bold: true, tag: 'label', owner: r.station });
  }

  // 5. People, top to bottom; then purpose dots, moods and bubbles above everyone.
  const overlays: DrawCmd[] = [];
  const moods: DrawCmd[] = [];
  const bubbles: DrawCmd[] = [];
  const people = [...scene.people].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const person of people) {
    const { cmds, headY } = drawPerson(person, P, s, opts.lowGraphics);
    out.push(...cmds);
    const p = P(person.x + 0.5, person.y + 0.5);
    if (person.tag) overlays.push({ op: 'ellipse', x: p.sx + 8 * s, y: p.sy + 6 * s, rx: 3.5 * s, ry: 3.5 * s, fill: person.tag, stroke: '#ffffff', tag: 'dot', owner: person.key });
    if (person.mood) moods.push({ op: 'text', x: p.sx, y: headY - 8 * s, text: person.mood, size: Math.max(10, 13 * s), fill: '#000000', tag: 'mood', owner: person.key });
    if (person.bubble) bubbles.push({ op: 'bubble', x: p.sx, y: headY - 22 * s, text: person.bubble, size: 12 * Math.max(0.8, Math.min(1.4, s)), tag: 'bubble', owner: person.key });
  }
  out.push(...overlays, ...moods, ...bubbles);
  return out;
}

/** A person seen from above: shoulders, then the head (hair or tudung on top). */
function drawPerson(
  person: Person,
  P: (x: number, y: number) => { sx: number; sy: number },
  s: number,
  lowGraphics: boolean,
): { cmds: DrawCmd[]; headY: number } {
  const meta = { owner: person.key };
  const { sx, sy } = P(person.x + 0.5, person.y + 0.5);
  const look = person.look;
  const outline = look.body === '#ffffff' ? '#9fb3c8' : shade(look.body, 0.7);
  const headY = sy - 2 * s;
  const cmds: DrawCmd[] = [];
  if (!lowGraphics) cmds.push({ op: 'ellipse', x: sx + 1.5 * s, y: sy + 2.5 * s, rx: 10 * s, ry: 7 * s, fill: '#000000', alpha: 0.15, tag: 'shadow', ...meta });
  cmds.push({ op: 'ellipse', x: sx, y: sy + 2 * s, rx: (person.pose === 'sit' ? 10 : 9) * s, ry: 6.5 * s, fill: look.body, stroke: outline, tag: 'person', ...meta });
  if (look.uniform === 'doctor') {
    cmds.push({ op: 'line', x1: sx - 4 * s, y1: sy + 1 * s, x2: sx + 4 * s, y2: sy + 5 * s, stroke: '#2b2f36', width: 1.3 * s, tag: 'person', ...meta });
  }
  const skin = SKIN[hash(person.key) % SKIN.length]!;
  if (look.hijab) {
    cmds.push({ op: 'ellipse', x: sx, y: headY, rx: 6 * s, ry: 6 * s, fill: look.head, stroke: look.head === '#ffffff' ? '#b0bcc8' : shade(look.head, 0.75), tag: 'person', ...meta });
  } else {
    cmds.push({ op: 'ellipse', x: sx, y: headY, rx: 5.5 * s, ry: 5.5 * s, fill: skin, tag: 'person', ...meta });
    cmds.push({ op: 'ellipse', x: sx, y: headY - 1.5 * s, rx: 5 * s, ry: 3.8 * s, fill: look.head, tag: 'person', ...meta });
  }
  if (person.baby) cmds.push({ op: 'ellipse', x: sx + 7 * s, y: sy + 3 * s, rx: 3.5 * s, ry: 3.5 * s, fill: '#fff4e0', stroke: '#d8c3a0', tag: 'person', ...meta });
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
