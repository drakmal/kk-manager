import { loadGameData } from '../../src/sim/data';
import { createDaySim } from '../../src/sim/events';
import type { Sim, StaffState } from '../../src/sim/engine';
import { defaultDayPlan } from '../../src/sim/plan';
import { liveScores, staffScore } from '../../src/sim/scoring';
import type { GameData, Patient, SopSettings } from '../../src/sim/types';

const real = loadGameData();

/** Counter "a" (2 min) → nurse "n" (5 min, Saringan can skip) → doctor "b" (3 min). A second doctor room "c". */
const data: GameData = {
  stations: [
    { id: 'a', unit: 'mch', label: 'Kaunter', role: 'clerk', seats: 1, minutes: [2, 2], opensAt: 480 },
    { id: 'n', unit: 'mch', label: 'Jururawat', role: 'nurse', seats: 1, minutes: [5, 5], opensAt: 480 },
    { id: 'b', unit: 'mch', label: 'Doktor B', role: 'doctor', seats: 1, minutes: [3, 3], opensAt: 480 },
    { id: 'c', unit: 'mch', label: 'Doktor C', role: 'doctor', seats: 1, minutes: [3, 3], opensAt: 480 },
  ],
  visitTypes: [
    { id: 'v', unit: 'mch', label: 'Lawatan', share: 1, appointment: false, priority: [], steps: [{ station: 'a' }, { station: 'n', bypassable: true }, { station: 'b' }] },
    { id: 'o', unit: 'opd', label: 'OPD', share: 1, appointment: false, priority: [], steps: [{ station: 'b' }] },
  ],
  staff: [
    { id: 'clerk1', name: 'Kak Ida', role: 'clerk', homeStation: 'a' },
    { id: 'jk1', name: 'JK Rohana', role: 'nurse', homeStation: 'n' },
    { id: 'doc1', name: 'Dr. Aina', role: 'doctor', homeStation: 'b' },
  ],
  arrivals: { dailyVolume: { mch: 0, opd: 0 }, hourlyShare: [{ from: 480, to: 481, share: 1 }] },
  tuning: real.tuning,
};

const patient = (id: number, arrival: number, steps: [string, number, boolean?][]): Patient => ({
  id, visitType: 'v', unit: 'mch', arrival, priority: [], colour: null,
  steps: steps.map(([station, minutes, bypassable]) => ({ station, minutes, bypassable: bypassable === true })),
  route: null, stepIndex: 0, waitMinutes: 0, crowdMinutes: 0, doneAt: null, turnedAway: false,
});
const visit = (id: number, arrival: number) => patient(id, arrival, [['a', 2], ['n', 5, true], ['b', 3]]);
const withBypass = (on: boolean): SopSettings => {
  const sop = structuredClone(defaultDayPlan(data, 1).sop);
  sop.saringan.bypass.v = on;
  return sop;
};
const stepTo = (sim: Sim, minute: number) => { while (sim.now < minute && !sim.isDone()) sim.step(); };
const finish = (sim: Sim) => { while (!sim.isDone()) sim.step(); return sim; };
const route = (sim: Sim, id: number) => sim.patients.find((p) => p.id === id)!.route!.map((s) => s.station);
const staff = (sim: Sim, id: string) => sim.staff.find((s) => s.id === id)!;

test('createSim does not mutate the caller plan', () => {
  const plan = defaultDayPlan(real, 1);
  const sim = createDaySim(real, plan);
  stepTo(sim, 540);
  sim.applyChange({ sop: { ...structuredClone(plan.sop), saringan: { bypass: { ...plan.sop.saringan.bypass, anc_doctor_only: true } } } });
  finish(sim);
  expect(plan.sop.saringan.bypass.anc_doctor_only).toBe(false);
});

test('a change takes effect after the briefing delay', () => {
  const sim = createDaySim(data, defaultDayPlan(data, 1), { patients: [visit(0, 540), visit(1, 556)] });
  stepTo(sim, 540);
  expect(sim.applyChange({ sop: withBypass(true) })).toEqual({ effectiveAt: 550 });
  expect(sim.pendingChanges).toHaveLength(1);
  finish(sim);
  expect(route(sim, 0)).toContain('n'); // registered at 542, before 550
  expect(route(sim, 1)).not.toContain('n'); // registered at 558
  expect(sim.pendingChanges).toHaveLength(0);
});

test('two changes inside one delay apply in order and both cost', () => {
  const sim = createDaySim(data, defaultDayPlan(data, 1), { patients: [visit(0, 551), visit(1, 560)] });
  stepTo(sim, 540);
  sim.applyChange({ sop: withBypass(true) }); // effective 550
  stepTo(sim, 545);
  sim.applyChange({ sop: withBypass(false) }); // effective 555
  finish(sim);
  expect(route(sim, 0)).not.toContain('n'); // registered 553: bypass on
  expect(route(sim, 1)).toContain('n'); // registered 562: bypass off again
  expect(staff(sim, 'doc1').changeCount).toBe(2);
});

test('roster change moves a doctor between patients only', () => {
  const sim = createDaySim(data, defaultDayPlan(data, 1), { patients: [patient(0, 540, [['b', 30]])] });
  stepTo(sim, 541);
  sim.applyChange({ roster: { b: [], c: ['doc1'] } }); // effective 551, but doc1 is busy until 570
  stepTo(sim, 560);
  expect(staff(sim, 'doc1').station).toBe('b');
  stepTo(sim, 572);
  expect(staff(sim, 'doc1').station).toBe('c');
});

test('staffScore subtracts the mid-day change penalty', () => {
  const s: StaffState = {
    id: 'mo1', station: 'mchDoctor', servingPatient: null, remaining: 0, onLunch: false, lunchStart: 780,
    lunchEnd: 840, unavailableUntil: null, idleMinutes: 0, idleMorning: 0, overloadMinutes: 0,
    overtimeMinutes: 0, changeCount: 2,
  };
  expect(staffScore(s, real.tuning)).toBe(100 - 2 * real.tuning.midDayChangePenalty);
  expect(real.tuning.midDayChangePenalty).toBe(5);
});

test('liveScores: 100 with nobody yet, pending lunch before 13:00, numbers in 0..100 mid-day', () => {
  const sim = createDaySim(real, defaultDayPlan(real, 2));
  expect(liveScores(sim, real)).toEqual({ patient: 100, hcw: 100, lunch: 'pending' });
  stepTo(sim, 600);
  const mid = liveScores(sim, real);
  expect(mid.lunch).toBe('pending');
  for (const v of [mid.patient, mid.hcw]) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  }
  expect(mid.patient).toBeLessThan(100); // the morning crowd has been waiting
});

test('liveScores reports the lunch outcome once it is decided', () => {
  const sim = createDaySim(real, defaultDayPlan(real, 2));
  finish(sim);
  expect(['onTime', 'late', 'missed']).toContain(liveScores(sim, real).lunch);
});
