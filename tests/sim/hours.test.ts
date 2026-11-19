import { fixtureData, fixturePlan, scripted } from './fixtures';
import { createDaySim, loadGameData, staffScore } from '../../src/sim/index';
import type { GameData } from '../../src/sim/types';

/** The fixture counter "a" opens at 07:30 and closes for lunch 13:00–13:30. */
const data: GameData = {
  ...fixtureData,
  stations: [{ ...fixtureData.stations[0]!, opensAt: 450, lunchBreak: [780, 810] }, fixtureData.stations[1]!],
};
const run = (patients: ReturnType<typeof scripted>[]) => {
  const sim = createDaySim(data, fixturePlan, { patients });
  while (!sim.isDone()) sim.step();
  return sim;
};

test('the counter opens at 07:30', () => {
  const sim = run([scripted(1, 455, [['a', 2]])]);
  expect(sim.patients[0]!.doneAt).toBe(457);
});

test('the counter closes 13:00–13:30 even with a queue, then reopens', () => {
  const sim = run([scripted(1, 779, [['a', 2]]), scripted(2, 781, [['a', 2]])]);
  expect(sim.patients[0]!.doneAt).toBe(781); // started 12:59, finished before going
  expect(sim.patients[1]!.doneAt).toBe(812); // waits for 13:30
  const clerk = sim.staff.find((s) => s.id === 'clerk1')!;
  expect(clerk.lunchStart).toBe(780);
  expect(clerk.lunchEnd).toBe(810);
});

test('the counter break counts as an on-time lunch', () => {
  const sim = run([scripted(1, 779, [['a', 5]])]);
  const clerk = sim.staff.find((s) => s.id === 'clerk1')!;
  expect(clerk.lunchStart).toBe(780);
  expect(staffScore(clerk, data.tuning)).toBe(100);
});

test('in the Jenis 4 data both registration counters and primary triage open at 07:30; counters close 12:30–13:30', () => {
  const real = loadGameData();
  for (const id of ['mchRegistration', 'opdRegistration', 'primaryTriage']) expect(real.stations.find((s) => s.id === id)!.opensAt).toBe(450);
  for (const id of ['mchRegistration', 'opdRegistration']) expect(real.stations.find((s) => s.id === id)!.lunchBreak).toEqual([750, 810]);
  expect(real.stations.find((s) => s.id === 'mchDoctor')!.opensAt).toBe(480);
});

test('in the real clinic, registration closes 12:30–13:30 and stops taking patients after 16:30', () => {
  const real = loadGameData();
  const plan = { ...fixturePlan, roster: Object.fromEntries(real.stations.map((s) => [s.id, real.staff.filter((p) => p.homeStation === s.id).map((p) => p.id)])) };
  const reg = (id: number, at: number) => ({ ...scripted(id, at, [['opdRegistration', 2]]), unit: 'opd' as const, visitType: 'opd_general' });
  const sim = createDaySim(real, plan, { patients: [reg(1, 755), reg(2, 991)] });
  while (!sim.isDone()) sim.step();
  expect(sim.patients[0]!.doneAt).toBe(812);
  expect(sim.patients[1]!.turnedAway).toBe(true);
});
