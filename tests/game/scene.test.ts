import { lookFor, nameFor, NAME_LISTS, PURPOSE_COLOUR } from '../../src/game/appearance';
import { LINES } from '../../src/game/jokes';
import { buildLayout, queueSpot } from '../../src/game/layout';
import { buildScene, interpolate, targets, type Spot } from '../../src/game/scene';
import type { SimSnapshot, StaffState } from '../../src/sim/engine';
import { loadGameData } from '../../src/sim/data';
import type { Patient } from '../../src/sim/types';

const data = loadGameData();
const layout = buildLayout(data);
const room = (id: string) => layout.rooms.find((r) => r.station === id)!;

const patient = (id: number, visitType: string, waitMinutes = 0): Patient => ({
  id, visitType, unit: visitType === 'opd_general' ? 'opd' : 'mch', arrival: 480, priority: [], colour: null,
  steps: [], route: null, stepIndex: 0, waitMinutes, crowdMinutes: 0, doneAt: null, turnedAway: false,
});
const staffState = (id: string, station: string, over: Partial<StaffState> = {}): StaffState => ({
  id, station, servingPatient: null, remaining: 0, onLunch: false, lunchStart: null, lunchEnd: null,
  unavailableUntil: null, idleMinutes: 0, idleMorning: 0, overloadMinutes: 0, overtimeMinutes: 0, changeCount: 0, lastStartAt: null, ...over,
});
const snap = (now: number, stations: SimSnapshot['stations']): SimSnapshot => ({
  now,
  stations: data.stations.map((s) => stations.find((x) => x.id === s.id) ?? { id: s.id, queue: [], seats: [] }),
  waitingCount: stations.reduce((n, s) => n + s.queue.length, 0),
  donePatients: 0,
});

describe('targets', () => {
  const sim = {
    patients: [patient(5, 'anc_nurse_only'), patient(6, 'anc_doctor_only'), patient(7, 'anc_nurse_doctor')],
    staff: [staffState('jk1', 'ancNurse', { servingPatient: 7 }), staffState('jk2', 'ancNurse')],
  };
  const s = snap(500, [{
    id: 'ancNurse', queue: [5, 6],
    seats: [{ staffId: 'jk1', patientId: 7, onLunch: false }, { staffId: 'jk2', patientId: null, onLunch: false }],
  }]);

  test('queued patients sit in queue order; served patients sit by their staff', () => {
    const t = targets(layout, s, sim);
    expect(t.get('p5')).toEqual({ ...queueSpot(layout, 'ancNurse', 0), pose: 'sit' });
    expect(t.get('p6')).toEqual({ ...queueSpot(layout, 'ancNurse', 1), pose: 'sit' });
    expect(t.get('p7')).toEqual({ ...room('ancNurse').chairs[0]!, pose: 'sit' });
    expect(t.get('s:jk1')).toEqual({ ...room('ancNurse').seats[0]!, pose: 'sit' });
    expect(t.get('s:jk2')).toEqual({ ...room('ancNurse').seats[1]!, pose: 'sit' });
  });

  test('staff on lunch or away on an emergency are not placed', () => {
    const lunch = snap(800, [{ id: 'ancNurse', queue: [], seats: [{ staffId: 'jk1', patientId: null, onLunch: true }] }]);
    expect(targets(layout, lunch, sim).has('s:jk1')).toBe(false);
    const away = { ...sim, staff: [staffState('mo3', 'opdDoctor', { unavailableUntil: 650 })] };
    const emergency = snap(620, [{ id: 'opdDoctor', queue: [], seats: [{ staffId: 'mo3', patientId: null, onLunch: false }] }]);
    expect(targets(layout, emergency, away).has('s:mo3')).toBe(false);
  });
});

describe('interpolate', () => {
  const from = new Map<string, Spot>([['p1', { x: 0, y: 0, pose: 'sit' }], ['p2', { x: 4, y: 4, pose: 'sit' }]]);
  const to = new Map<string, Spot>([['p1', { x: 2, y: 4, pose: 'sit' }], ['p3', { x: 10, y: 10, pose: 'sit' }]]);

  test('halfway is the midpoint; new keys start at the entrance; vanished keys head for the exit', () => {
    const mid = interpolate(from, to, 0.5, layout, false);
    expect(mid.get('p1')).toMatchObject({ x: 1, y: 2 });
    const e = layout.entrance;
    expect(mid.get('p3')).toMatchObject({ x: (e.x + 10) / 2, y: (e.y + 10) / 2 });
    const x = layout.exit;
    expect(mid.get('p2')).toMatchObject({ x: (4 + x.x) / 2, y: (4 + x.y) / 2 });
    expect(interpolate(from, to, 1, layout, false).has('p2')).toBe(false);
  });

  test('people walk standing up and sit once they arrive', () => {
    expect(interpolate(from, to, 0.5, layout, false).get('p1')!.pose).toBe('stand');
    expect(interpolate(from, to, 1, layout, false).get('p1')!.pose).toBe('sit');
  });

  test('lowGraphics jumps straight to targets', () => {
    expect([...interpolate(from, to, 0.3, layout, true)]).toEqual([...to]);
  });
});

test('at most 4 bubbles, highest priority first', () => {
  const ids = [10, 11, 12, 13, 14, 15];
  const sim = {
    patients: [
      patient(10, 'anc_doctor_only', 35), patient(11, 'anc_doctor_only', 40),
      ...[12, 13, 14, 15].map((i) => patient(i, 'opd_general', 60)),
    ],
    staff: [staffState('mo1', 'mchDoctor')],
  };
  const s = snap(540, [
    { id: 'ancNurse', queue: [10, 11], seats: [] },
    { id: 'opdTriage', queue: [12, 13, 14, 15], seats: [] },
    { id: 'mchDoctor', queue: [], seats: [{ staffId: 'mo1', patientId: null, onLunch: false }] },
  ]);
  const positions = targets(layout, s, sim);
  const scene = buildScene(layout, s, sim, data, positions);
  const withBubble = scene.people.filter((p) => p.bubble !== null);
  expect(withBubble).toHaveLength(4);
  expect(withBubble.filter((p) => LINES.resultOnly.includes(p.bubble!)).map((p) => p.key).sort()).toEqual(['p10', 'p11']);
  expect(scene.people.find((p) => p.key === 's:mo1')!.bubble).toBeNull(); // 4 patients outrank the idle doctor
  expect(ids.length).toBe(6);
});

test('an idle doctor in the morning gets a bubble when nothing outranks it', () => {
  const sim = { patients: [], staff: [staffState('mo1', 'mchDoctor')] };
  const s = snap(540, [{ id: 'mchDoctor', queue: [], seats: [{ staffId: 'mo1', patientId: null, onLunch: false }] }]);
  const scene = buildScene(layout, s, sim, data, targets(layout, s, sim));
  expect(LINES.doctorIdle).toContain(scene.people.find((p) => p.key === 's:mo1')!.bubble);
});

test('patients carry their purpose colour; staff carry none', () => {
  const sim = { patients: [patient(5, 'anc_doctor_only')], staff: [staffState('jk1', 'ancNurse')] };
  const s = snap(500, [{ id: 'ancNurse', queue: [5], seats: [{ staffId: 'jk1', patientId: null, onLunch: false }] }]);
  const scene = buildScene(layout, s, sim, data, targets(layout, s, sim));
  expect(scene.people.find((p) => p.key === 'p5')!.tag).toBe(PURPOSE_COLOUR.anc_doctor_only);
  expect(scene.people.find((p) => p.key === 's:jk1')!.tag).toBeNull();
  for (const v of data.visitTypes) expect(PURPOSE_COLOUR[v.id], v.id).toMatch(/^#[0-9a-f]{6}$/i);
});

test('lookFor and nameFor are deterministic', () => {
  expect(lookFor('p42', 'patient')).toEqual(lookFor('p42', 'patient'));
  expect(nameFor('p42')).toBe(nameFor('p42'));
  expect(lookFor('s:mo1', 'doctor').uniform).toBe('doctor');
  expect(lookFor('s:jk1', 'nurse').uniform).toBe('nurse');
});

test('nameFor draws from Malay, Chinese and Indian name lists', () => {
  const names = Array.from({ length: 300 }, (_, i) => nameFor(`p${i}`, 'f'));
  for (const list of [NAME_LISTS.malay, NAME_LISTS.chinese, NAME_LISTS.indian] as readonly (readonly string[])[]) {
    expect(names.some((n) => list.includes(n))).toBe(true);
  }
});

test('a trainee in an extra seat sits beside, not on top of, the normal seat', () => {
  const r = room('mchDoctor');
  const sim = { patients: [], staff: [staffState('mo1', 'mchDoctor'), staffState('mo2', 'mchDoctor'), staffState('mo7', 'mchDoctor')] };
  const s = snap(500, [{
    id: 'mchDoctor', queue: [],
    seats: ['mo1', 'mo2', 'mo7'].map((staffId) => ({ staffId, patientId: null, onLunch: false })),
  }]);
  const t = targets(layout, s, sim);
  expect(r.seats.length).toBe(2);
  expect(t.get('s:mo7')).not.toEqual(t.get('s:mo1'));
});
