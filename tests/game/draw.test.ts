import { buildDrawList, draw } from '../../src/game/draw';
import { buildLayout } from '../../src/game/layout';
import { buildScene, moodFor, targets } from '../../src/game/scene';
import { fitView } from '../../src/game/topdown';
import type { SimSnapshot, StaffState } from '../../src/sim/engine';
import { loadGameData } from '../../src/sim/index';
import type { Patient } from '../../src/sim/types';

const data = loadGameData();
const layout = buildLayout(data);
const view = fitView(layout, 1280, 720);
const patient = (id: number, waitMinutes: number): Patient => ({
  id, visitType: 'opd_general', unit: 'opd', arrival: 480, priority: [], colour: null, steps: [], route: null,
  stepIndex: 0, waitMinutes, crowdMinutes: 0, doneAt: null, turnedAway: false,
});
const staff = (id: string, station: string): StaffState => ({
  id, station, servingPatient: null, remaining: 0, onLunch: false, lunchStart: null, lunchEnd: null, unavailableUntil: null,
  idleMinutes: 0, idleMorning: 0, overloadMinutes: 0, overtimeMinutes: 0, changeCount: 0, lastStartAt: null,
});
const sim = { patients: [patient(1, 5), patient(2, 40), patient(3, 70)], staff: [staff('mo3', 'opdRoom1'), staff('mo4', 'opdRoom1')] };
const snap: SimSnapshot = {
  now: 600,
  stations: data.stations.map((s) => ({
    id: s.id,
    queue: s.id === 'opdRoom1' ? [1, 2, 3] : [],
    seats: s.id === 'opdRoom1' ? [{ staffId: 'mo3', patientId: null, onLunch: false }, { staffId: 'mo4', patientId: null, onLunch: false }] : [],
  })),
  waitingCount: 3,
  donePatients: 0,
};
const scene = buildScene(layout, snap, sim, data, targets(layout, snap, sim));
const list = (low = false) => buildDrawList(scene, view, { lowGraphics: low, dpr: 1, highlight: null });

test('mood thresholds: 😊 under 15, 😐 15–29, 😟 30–59, 😠 60 and over', () => {
  expect([0, 14, 15, 29, 30, 59, 60, 200].map(moodFor)).toEqual(['😊', '😊', '😐', '😐', '😟', '😟', '😠', '😠']);
});

test('patients carry their mood; staff have none', () => {
  const byKey = new Map(scene.people.map((p) => [p.key, p]));
  expect(byKey.get('p1')!.mood).toBe('😊');
  expect(byKey.get('p2')!.mood).toBe('😟');
  expect(byKey.get('p3')!.mood).toBe('😠');
  expect(byKey.get('s:mo3')!.mood).toBeNull();
});

test('each patient gets a mood emoji drawn above their head, after every person', () => {
  const cmds = list();
  const moods = cmds.filter((c) => c.tag === 'mood');
  expect(moods.map((m) => (m.op === 'text' ? m.text : '')).sort()).toEqual(['😊', '😟', '😠'].sort());
  const lastPerson = cmds.map((c) => c.tag).lastIndexOf('person');
  expect(cmds.findIndex((c) => c.tag === 'mood')).toBeGreaterThan(lastPerson);
  for (const m of moods) {
    const head = cmds.filter((c) => c.tag === 'person' && c.owner === m.owner && c.op === 'ellipse');
    if (m.op !== 'text') continue;
    expect(Math.min(...head.map((h) => (h.op === 'ellipse' ? h.y : 0)))).toBeGreaterThan(m.y);
  }
  expect(list(true).filter((c) => c.tag === 'mood')).toHaveLength(3); // kept in low graphics
});

test('it is top-down: every floor and room rectangle is axis-aligned', () => {
  for (const c of list().filter((x) => x.tag === 'floor' || x.tag === 'wall')) {
    if (c.op !== 'poly') continue;
    const [x0, y0, x1, y1, x2, y2, x3, y3] = c.pts;
    expect(y0).toBeCloseTo(y1!);
    expect(x1).toBeCloseTo(x2!);
    expect(y2).toBeCloseTo(y3!);
    expect(x3).toBeCloseTo(x0!);
  }
});

test('floors come first, then furniture, then people; the ultrasound is drawn', () => {
  const tags = list().map((c) => c.tag);
  expect(tags.lastIndexOf('floor')).toBeLessThan(tags.indexOf('furniture'));
  expect(tags.lastIndexOf('furniture')).toBeLessThan(tags.indexOf('person'));
  expect(list().some((c) => c.owner === 'ultrasound:mchDoctor')).toBe(true);
});

test('low graphics drops shadows and furniture detail', () => {
  expect(list(true).some((c) => c.tag === 'shadow')).toBe(false);
  expect(list().some((c) => c.tag === 'shadow')).toBe(true);
  expect(list(true).filter((c) => c.tag === 'furniture').length).toBeLessThan(list().filter((c) => c.tag === 'furniture').length);
});

test('the highlighted room gets an outline', () => {
  const cmds = buildDrawList(scene, view, { lowGraphics: false, dpr: 1, highlight: 'opdRoom1' });
  expect(cmds.some((c) => c.tag === 'highlight' && c.owner === 'opdRoom1')).toBe(true);
});

test('draw paints onto a 2D context, scaled by devicePixelRatio', () => {
  const calls: string[] = [];
  const ctx = new Proxy({}, {
    get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'canvas' ? { width: 2560, height: 1440 } : (...a: unknown[]) => calls.push(`${String(k)}:${a.length}`)),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  draw(ctx, scene, view, { lowGraphics: false, dpr: 2, highlight: null });
  expect(calls[0]).toBe('setTransform:6');
  expect(calls.some((c) => c.startsWith('fillText'))).toBe(true);
});

test('waiting areas have no chair grid: chairs only in front of desks', () => {
  const seats = layout.rooms.reduce((n, r) => n + r.seats.length, 0);
  expect(list().filter((c) => c.owner === 'chair')).toHaveLength(seats);
});

test('speech bubbles never overlap each other', () => {
  const crowd: typeof scene = {
    ...scene,
    people: Array.from({ length: 8 }, (_, i) => ({
      key: `p${100 + i}`, kind: 'patient' as const, x: 20 + i, y: 7, pose: 'sit' as const, look: scene.people[0]!.look,
      tag: null, baby: false, bubble: 'Lama gila tunggu ni…', mood: '😠' as const,
    })),
  };
  const bubbles = buildDrawList(crowd, view, { lowGraphics: false, dpr: 1, highlight: null }).filter((c) => c.op === 'bubble');
  expect(bubbles.length).toBeGreaterThan(0);
  expect(bubbles.length).toBeLessThan(8);
  const boxes = bubbles.map((b) => {
    if (b.op !== 'bubble') throw new Error();
    const w = b.text.length * b.size * 0.55 + b.size * 1.4;
    return { l: b.x - w / 2, r: b.x + w / 2, t: b.y - b.size * 2, btm: b.y + 7 };
  });
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!;
      expect(a.r <= b.l || b.r <= a.l || a.btm <= b.t || b.btm <= a.t).toBe(true);
    }
  }
});

test('a bubble sits above its speaker’s mood emoji', () => {
  const one: typeof scene = { ...scene, people: [{ ...scene.people.find((p) => p.mood)!, bubble: 'Bila nak giliran saya?' }] };
  const cmds = buildDrawList(one, view, { lowGraphics: false, dpr: 1, highlight: null });
  const bubble = cmds.find((c) => c.op === 'bubble')!;
  const mood = cmds.find((c) => c.tag === 'mood')!;
  if (bubble.op !== 'bubble' || mood.op !== 'text') throw new Error();
  expect(bubble.y + 7).toBeLessThanOrEqual(mood.y - mood.size); // tail tip above the top of the emoji
});
