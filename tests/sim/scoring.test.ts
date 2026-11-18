import { loadGameData } from '../../src/sim/data';
import type { StaffState } from '../../src/sim/engine';
import { runDay } from '../../src/sim/day';
import { defaultDayPlan } from '../../src/sim/plan';
import { lunchOutcome, patientScore, staffScore } from '../../src/sim/scoring';
import { scripted } from './fixtures';

const data = loadGameData();
const t = data.tuning;
const done = (wait: number, crowd = 0) => ({ ...scripted(0, 480, []), waitMinutes: wait, crowdMinutes: crowd, doneAt: 600 });
const staffState = (over: Partial<StaffState>): StaffState => ({
  id: 'mo1', station: 'mchDoctor', servingPatient: null, remaining: 0, onLunch: false,
  lunchStart: 780, lunchEnd: 840, unavailableUntil: null, idleMinutes: 0, idleMorning: 0,
  overloadMinutes: 0, overtimeMinutes: 0, ...over,
});

test('patient within patience scores 100; 10 over → 90; crowd 4 min → -2', () => {
  expect(patientScore(done(30), t)).toBe(100);
  expect(patientScore(done(40), t)).toBe(90);
  expect(patientScore(done(20, 4), t)).toBe(98);
  expect(patientScore(done(500), t)).toBe(0);
});

test('unfinished and turned-away patients score 0', () => {
  expect(patientScore({ ...done(0), doneAt: null }, t)).toBe(0);
  expect(patientScore({ ...done(0), turnedAway: true }, t)).toBe(0);
});

test('lunch outcomes', () => {
  expect(lunchOutcome([780, 780])).toBe('onTime');
  expect(lunchOutcome([780, 825])).toBe('late');
  expect(lunchOutcome([780, null])).toBe('missed');
  expect(lunchOutcome([])).toBe('onTime');
});

test('staff score with late lunch and 20 overtime min = 100 - 10 - 10 = 80', () => {
  expect(staffScore(staffState({ lunchStart: 800, overtimeMinutes: 20 }), t)).toBe(80);
  expect(staffScore(staffState({ lunchStart: null }), t)).toBe(75);
  expect(staffScore(staffState({ overloadMinutes: 50 }), t)).toBe(95);
});

test('report on default day has no NaN and sane ranges', () => {
  const r = runDay(data, defaultDayPlan(data, 3));
  expect(JSON.stringify(r)).not.toMatch(/"(mean|max|patientSatisfaction|hcwSatisfaction)":null/); // NaN serialises as null
  for (const v of [r.patientSatisfaction, r.hcwSatisfaction]) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  }
  expect(r.seed).toBe(3);
  expect(r.lunch.perDoctor.map((d) => d.staffId)).toEqual(['mo1', 'mo2', 'mo3', 'mo4', 'mo5', 'mo6']);
  expect(Object.keys(r.idleByStaff)).toContain('mo1');
  expect(r.peakQueue.ancNurse!.size).toBeGreaterThan(0);
});

test('same plan → identical report', () => {
  expect(runDay(data, defaultDayPlan(data, 12))).toEqual(runDay(data, defaultDayPlan(data, 12)));
});

test('zero volume → no NaN, satisfaction 100', () => {
  const d = structuredClone(data);
  d.arrivals.dailyVolume = { mch: 0, opd: 0 };
  const r = runDay(d, defaultDayPlan(d, 1));
  expect(r.patientSatisfaction).toBe(100);
  expect(r.hcwSatisfaction).toBe(100);
  expect(r.waitByVisitType).toEqual({});
  expect(r.balik.outcome).toBe('onTime');
  expect(r.balik.lastPatientDone).toBeNull();
  expect(r.lunch.outcome).toBe('onTime');
});

test('unfinished patients mean overtime', () => {
  const plan = defaultDayPlan(data, 1);
  plan.roster.ancNurse = []; // nobody in the ANC room: those patients can never finish
  const r = runDay(data, plan);
  expect(r.unfinished).toBeGreaterThan(0);
  expect(r.balik.outcome).toBe('overtime');
});
