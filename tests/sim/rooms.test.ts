import { fixtureData, fixturePlan, scripted } from './fixtures';
import { createDaySim, createRng, defaultDayPlan, loadGameData, makePatient, validateGameData } from '../../src/sim/index';
import { emergencyDoctor } from '../../src/sim/events';
import type { DayPlan, GameData, Patient } from '../../src/sim/types';

/** Counter "a", then a doctor group "g" made of rooms r1 and r2 (one seat each). */
const roomsData: GameData = {
  ...fixtureData,
  stations: [
    fixtureData.stations[0]!,
    { id: 'r1', unit: 'opd', label: 'Bilik 1', role: 'doctor', seats: 1, minutes: [3, 3], opensAt: 480, group: 'g' },
    { id: 'r2', unit: 'opd', label: 'Bilik 2', role: 'doctor', seats: 1, minutes: [3, 3], opensAt: 480, group: 'g' },
  ],
  visitTypes: [{ id: 'v', unit: 'opd', label: 'OPD', share: 1, appointment: false, priority: [], steps: [{ station: 'a' }, { station: 'g' }] }],
  staff: [
    { id: 'clerk1', name: 'Kak Ida', role: 'clerk', homeStation: 'a' },
    { id: 'd1', name: 'Dr. Satu', role: 'doctor', homeStation: 'r1' },
    { id: 'd2', name: 'Dr. Dua', role: 'doctor', homeStation: 'r2' },
  ],
};
const roomsPlan = () => defaultDayPlan(roomsData, 1);
const run = (data: GameData, plan: DayPlan, patients: Patient[]) => {
  const sim = createDaySim(data, plan, { patients });
  while (!sim.isDone()) sim.step();
  return sim;
};
const toRoom = (id: number, arrival = 480) => scripted(id, arrival, [['a', 2], ['g', 3]]);

test('registration assigns group steps to rooms in turn', () => {
  const sim = run(roomsData, roomsPlan(), [1, 2, 3, 4].map((i) => toRoom(i)));
  expect(sim.patients.map((p) => p.route![0]!.station)).toEqual(['r1', 'r2', 'r1', 'r2']);
});

test('a room with no staffed seat is skipped by assignment', () => {
  const plan = roomsPlan();
  plan.roster.r2 = [];
  const sim = run(roomsData, plan, [1, 2, 3].map((i) => toRoom(i)));
  expect(sim.patients.map((p) => p.route![0]!.station)).toEqual(['r1', 'r1', 'r1']);
});

test('patients already waiting at a room that loses its doctor stay there and are counted unfinished', () => {
  const plan: DayPlan = { ...roomsPlan(), events: [{ kind: 'staffAway', staffId: 'd2', from: 480, to: 1200 }] };
  const sim = run(roomsData, plan, [1, 2].map((i) => toRoom(i)));
  const [first, second] = sim.patients;
  expect(first!.doneAt).not.toBeNull();
  expect(second!.route![0]!.station).toBe('r2');
  expect(second!.doneAt).toBeNull();
  expect(second!.turnedAway).toBe(false);
});

test('an ultrasound add-on with chance 1 adds 5–10 minutes to that step', () => {
  const data: GameData = {
    ...fixtureData,
    visitTypes: [{ ...fixtureData.visitTypes[0]!, steps: [{ station: 'a' }, { station: 'b', addOn: { chance: 1, minutes: [5, 10] } }] }],
  };
  for (let seed = 1; seed < 20; seed++) {
    const p = makePatient(data, 'v', 480, 1, createRng(seed));
    expect(p.steps[1]!.minutes).toBeGreaterThanOrEqual(8);
    expect(p.steps[1]!.minutes).toBeLessThanOrEqual(13);
  }
  const none = { ...data, visitTypes: [{ ...data.visitTypes[0]!, steps: [{ station: 'a' }, { station: 'b', addOn: { chance: 0, minutes: [5, 10] as [number, number] } }] }] };
  expect(makePatient(none, 'v', 480, 1, createRng(1)).steps[1]!.minutes).toBe(3);
});

test('lunchOnTime sends a free doctor to lunch at 13:00 even with a queue', () => {
  const queue = Array.from({ length: 10 }, (_, i) => scripted(i + 1, 770, [['b', 3]]));
  const late = run(fixtureData, fixturePlan, queue);
  expect(late.staff.find((s) => s.id === 'doc1')!.lunchStart).toBe(800);
  const plan = structuredClone(fixturePlan);
  plan.sop.lunchOnTime = true;
  const onTime = run(fixtureData, plan, queue);
  expect(onTime.staff.find((s) => s.id === 'doc1')!.lunchStart).toBeLessThanOrEqual(783);
});

test('emergencyWalkIn with a station takes a doctor from that room only', () => {
  const plan: DayPlan = { ...roomsPlan(), events: [{ kind: 'emergencyWalkIn', at: 500, minutes: [30, 30], station: 'r2' }] };
  const sim = createDaySim(roomsData, plan, { patients: [] });
  while (sim.now < 500) sim.step();
  expect(emergencyDoctor(sim, 'r2')?.id).toBe('d2');
  sim.step();
  expect(sim.staff.find((s) => s.id === 'd2')!.unavailableUntil).toBe(530);
  expect(sim.staff.find((s) => s.id === 'd1')!.unavailableUntil).toBeNull();
});

test('applyChange immediate+free takes effect now and adds no changeCount', () => {
  const sim = createDaySim(roomsData, roomsPlan(), { patients: [] });
  while (sim.now < 500) sim.step();
  const sop = structuredClone(roomsPlan().sop);
  sop.lunchOnTime = true;
  expect(sim.applyChange({ sop }, { immediate: true, free: true }).effectiveAt).toBe(500);
  sim.step();
  expect(sim.staff.every((s) => s.changeCount === 0)).toBe(true);
  expect(sim.applyChange({ sop }).effectiveAt).toBe(501 + roomsData.tuning.briefingDelayMinutes);
});

test('PlanChange.events ends a printer outage early', () => {
  const plan: DayPlan = { ...structuredClone(fixturePlan), events: [{ kind: 'printerDown', from: 540, to: 720 }] };
  const slow = run(fixtureData, plan, [scripted(1, 561, [['a', 2]])]);
  expect(slow.patients[0]!.doneAt).toBe(563 + fixtureData.tuning.printerRegistrationExtra);
  const sim = createDaySim(fixtureData, plan, { patients: [scripted(1, 561, [['a', 2]])] });
  while (sim.now < 545) sim.step();
  sim.applyChange({ events: [{ kind: 'printerDown', from: 540, to: 560 }] }, { immediate: true, free: true });
  while (!sim.isDone()) sim.step();
  expect(sim.patients[0]!.doneAt).toBe(563);
});

test('validation rejects a step naming an unknown station or group, and mixed-role groups', () => {
  const bad = structuredClone(roomsData);
  bad.visitTypes[0]!.steps[1] = { station: 'nowhere' };
  expect(() => validateGameData(bad)).toThrow(/unknown station or group "nowhere"/);
  const mixed = structuredClone(roomsData);
  mixed.stations[2]!.role = 'nurse';
  expect(() => validateGameData(mixed)).toThrow(/group "g" mixes roles/);
  expect(() => validateGameData(structuredClone(loadGameData()))).not.toThrow();
});
