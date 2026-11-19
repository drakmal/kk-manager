import { buildDrawList, draw } from '../../src/game/draw';
import { depth, fitView } from '../../src/game/iso';
import { buildLayout } from '../../src/game/layout';
import { buildScene, targets } from '../../src/game/scene';
import type { SimSnapshot, StaffState } from '../../src/sim/engine';
import { loadGameData } from '../../src/sim/data';
import type { Patient } from '../../src/sim/types';

const data = loadGameData();
const layout = buildLayout(data);
const view = fitView(layout, 1280, 720);

const patient = (id: number, visitType: string, waitMinutes = 0): Patient => ({
  id, visitType, unit: 'mch', arrival: 480, priority: [], colour: null, steps: [], route: null,
  stepIndex: 0, waitMinutes, crowdMinutes: 0, doneAt: null, turnedAway: false,
});
const staffState = (id: string, station: string): StaffState => ({
  id, station, servingPatient: null, remaining: 0, onLunch: false, lunchStart: null, lunchEnd: null,
  unavailableUntil: null, idleMinutes: 0, idleMorning: 0, overloadMinutes: 0, overtimeMinutes: 0, changeCount: 0,
});
const sim = {
  patients: [patient(1, 'anc_doctor_only', 50), patient(2, 'anc_nurse_only'), patient(3, 'opd_general', 60)],
  staff: [staffState('jk1', 'ancNurse'), staffState('mo1', 'mchDoctor')],
};
const snap: SimSnapshot = {
  now: 540,
  stations: data.stations.map((s) =>
    s.id === 'ancNurse' ? { id: s.id, queue: [1, 2], seats: [{ staffId: 'jk1', patientId: null, onLunch: false }] }
      : s.id === 'opdTriage' ? { id: s.id, queue: [3], seats: [] }
        : s.id === 'mchDoctor' ? { id: s.id, queue: [], seats: [{ staffId: 'mo1', patientId: null, onLunch: false }] }
          : { id: s.id, queue: [], seats: [] }),
  waitingCount: 3,
  donePatients: 0,
};
const scene = buildScene(layout, snap, sim, data, targets(layout, snap, sim));
const opts = { lowGraphics: false, dpr: 1, highlight: null };

test('floors are drawn before any person, bubbles after every person', () => {
  const list = buildDrawList(scene, view, opts);
  const firstPerson = list.findIndex((c) => c.tag === 'person');
  const lastPerson = list.map((c) => c.tag).lastIndexOf('person');
  expect(firstPerson).toBeGreaterThan(0);
  list.forEach((c, i) => { if (c.tag === 'floor') expect(i).toBeLessThan(firstPerson); });
  const bubbles = list.flatMap((c, i) => (c.tag === 'bubble' ? [i] : []));
  expect(bubbles.length).toBeGreaterThan(0);
  for (const i of bubbles) expect(i).toBeGreaterThan(lastPerson);
});

test('people are drawn in ascending depth', () => {
  const owners = buildDrawList(scene, view, opts).filter((c) => c.tag === 'person').map((c) => c.owner!);
  const byKey = new Map(scene.people.map((p) => [p.key, depth(p.x, p.y)]));
  const depths = owners.map((k) => byKey.get(k)!);
  for (let i = 1; i < depths.length; i++) expect(depths[i]!).toBeGreaterThanOrEqual(depths[i - 1]!);
});

test('lowGraphics draws no shadows', () => {
  expect(buildDrawList(scene, view, opts).some((c) => c.tag === 'shadow')).toBe(true);
  expect(buildDrawList(scene, view, { ...opts, lowGraphics: true }).some((c) => c.tag === 'shadow')).toBe(false);
});

test('doctor rooms show two desks', () => {
  const desks = buildDrawList(scene, view, opts).filter((c) => c.tag === 'furniture' && c.owner === 'desk:mchDoctor');
  expect(new Set(desks.map((c) => c.part)).size).toBe(2);
});

test('the highlighted room gets an outline', () => {
  expect(buildDrawList(scene, view, { ...opts, highlight: 'ancNurse' }).some((c) => c.tag === 'highlight')).toBe(true);
  expect(buildDrawList(scene, view, opts).some((c) => c.tag === 'highlight')).toBe(false);
});

test('draw paints onto a 2D context, scaled by devicePixelRatio', () => {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, prop: string) => {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (t: string) => ({ width: t.length * 7 });
      return (...args: unknown[]) => { calls.push(`${prop}(${args.length})`); };
    },
    set: (target, prop: string, value) => { target[prop] = value; return true; },
  });
  draw(ctx as unknown as CanvasRenderingContext2D, scene, view, { ...opts, dpr: 2 });
  expect(calls[0]).toBe('setTransform(6)');
  expect(calls.filter((c) => c.startsWith('fill')).length).toBeGreaterThan(50);
  expect(calls).toContain('fillText(3)');
});
