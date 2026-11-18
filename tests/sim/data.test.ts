import { loadGameData, validateGameData } from '../../src/sim/data';
import { defaultDayPlan } from '../../src/sim/plan';

test('default data loads', () => {
  expect(loadGameData().stations.length).toBe(11);
});

test('hourly shares sum to 1', () => {
  expect(loadGameData().arrivals.hourlyShare.reduce((s, h) => s + h.share, 0)).toBeCloseTo(1, 9);
});

test('visit shares sum to 1 per unit', () => {
  const vts = loadGameData().visitTypes;
  for (const unit of ['mch', 'opd'] as const) {
    expect(vts.filter((v) => v.unit === unit).reduce((s, v) => s + v.share, 0)).toBeCloseTo(1, 9);
  }
});

test.each([
  ['unknown station', (d: any) => { d.visitTypes[0].steps.push({ station: 'nope' }); }, /anc_booking.*nope/],
  ['min > max', (d: any) => { d.visitTypes[1].steps[3].minutes = [30, 20]; }, /anc_nurse_only/],
  ['negative', (d: any) => { d.stations[0].minutes = [-1, 2]; }, /primaryTriage/],
  ['staff home unknown', (d: any) => { d.staff[0].homeStation = 'x'; }, /mo1|x/],
])('rejects %s', (_name, mutate, msg) => {
  const d = structuredClone(loadGameData());
  mutate(d);
  expect(() => validateGameData(d)).toThrow(msg);
});

test('default plan rosters everyone at home', () => {
  const p = defaultDayPlan(loadGameData(), 1);
  expect(p.roster.mchDoctor).toHaveLength(2);
  expect(p.roster.opdDoctor).toHaveLength(4);
  expect(Object.values(p.sop.saringan.bypass).every((v) => v === false)).toBe(true);
});
