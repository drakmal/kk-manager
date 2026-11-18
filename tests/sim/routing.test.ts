import { defaultDayPlan } from '../../src/sim/plan';
import { loadGameData } from '../../src/sim/data';
import { filterRoute } from '../../src/sim/routing';
import type { PlannedStep, SopSettings } from '../../src/sim/types';

const steps: PlannedStep[] = [
  { station: 'mchTriage', minutes: 4, bypassable: false },
  { station: 'ancNurse', minutes: 5, bypassable: true },
  { station: 'mchDoctor', minutes: 8, bypassable: false },
];
const sopWith = (bypass: Record<string, boolean>): SopSettings => {
  const sop = defaultDayPlan(loadGameData(), 1).sop;
  Object.assign(sop.saringan.bypass, bypass);
  return sop;
};
const stations = (s: PlannedStep[]) => s.map((x) => x.station);

test('default (first come first served) keeps the nurse step', () => {
  expect(stations(filterRoute(steps, 'anc_doctor_only', sopWith({}), true))).toEqual(['mchTriage', 'ancNurse', 'mchDoctor']);
});

test('bypass on skips nurse when appointments visible', () => {
  expect(stations(filterRoute(steps, 'anc_doctor_only', sopWith({ anc_doctor_only: true }), true))).toEqual(['mchTriage', 'mchDoctor']);
});

test('CCMS down without printed list falls back to first come first served', () => {
  expect(stations(filterRoute(steps, 'anc_doctor_only', sopWith({ anc_doctor_only: true }), false))).toContain('ancNurse');
});

test('non-bypassable steps never removed', () => {
  const fixed = steps.map((s) => ({ ...s, bypassable: false }));
  expect(stations(filterRoute(fixed, 'anc_nurse_doctor', sopWith({ anc_nurse_doctor: true }), true))).toContain('ancNurse');
});

test('does not mutate its input', () => {
  const copy = structuredClone(steps);
  filterRoute(steps, 'anc_doctor_only', sopWith({ anc_doctor_only: true }), true);
  expect(steps).toEqual(copy);
});
