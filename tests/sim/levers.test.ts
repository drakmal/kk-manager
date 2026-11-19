import baseline from './baseline/reports.json';
import { fixtureData, fixturePlan, scripted } from './fixtures';
import { createDaySim, defaultDayPlan, loadGameData, runDay } from '../../src/sim/index';
import type { DayPlan, GameData } from '../../src/sim/types';

const run = (data: GameData, plan: DayPlan, patients: ReturnType<typeof scripted>[]) => {
  const sim = createDaySim(data, plan, { patients });
  while (!sim.isDone()) sim.step();
  return sim;
};

test('staffSpeed 2 doubles that person’s service time only', () => {
  const plan: DayPlan = { ...structuredClone(fixturePlan), staffSpeed: { doc1: 2 } };
  const sim = run(fixtureData, plan, [scripted(1, 480, [['a', 2], ['b', 3]])]);
  // a: 480–482 (2 min, clerk unaffected), b: 482–488 (6 min)
  expect(sim.patients[0]!.doneAt).toBe(488);
  const normal = run(fixtureData, fixturePlan, [scripted(1, 480, [['a', 2], ['b', 3]])]);
  expect(normal.patients[0]!.doneAt).toBe(485);
});

test('staffSpeed applies before CCMS and printer', () => {
  const plan: DayPlan = {
    ...structuredClone(fixturePlan),
    staffSpeed: { clerk1: 1.5 },
    events: [{ kind: 'ccmsDown', from: 480, to: 600 }, { kind: 'printerDown', from: 480, to: 600 }],
  };
  // base 2 → ×1.5 = 3 → CCMS ×2 = 6 → printer +1 = 7; then doctor 3
  const sim = run(fixtureData, plan, [scripted(1, 480, [['a', 2], ['b', 3]])]);
  expect(sim.patients[0]!.doneAt).toBe(480 + 7 + 3);
});

test('extraSeats lets a trainee see patients beside the normal seats', () => {
  const data: GameData = {
    ...fixtureData,
    staff: [...fixtureData.staff, { id: 'mo7', name: 'Dr. Amir', role: 'doctor', homeStation: 'b' }],
  };
  const plan: DayPlan = { ...defaultDayPlan(data, 1), extraSeats: { b: ['mo7'] } };
  const sim = createDaySim(data, plan, { patients: [scripted(1, 480, [['b', 10]]), scripted(2, 480, [['b', 10]])] });
  for (let i = 0; i < 70; i++) sim.step(); // to 490 → both started at 480
  sim.step();
  const seats = sim.snapshot().stations.find((s) => s.id === 'b')!.seats;
  expect(seats.map((s) => s.staffId)).toEqual(['doc1', 'mo7']);
  while (!sim.isDone()) sim.step();
  expect(sim.patients.map((p) => p.doneAt)).toEqual([490, 490]);
});

test('staffAway removes a person for the window, finishing a patient first', () => {
  const plan: DayPlan = { ...structuredClone(fixturePlan), events: [{ kind: 'staffAway', staffId: 'doc1', from: 482, to: 500 }] };
  // Patient 1 starts with doc1 at 480 (10 min, ends 490). Patient 2 waits until doc1 is back at 500.
  const sim = run(fixtureData, plan, [scripted(1, 480, [['b', 10]]), scripted(2, 481, [['b', 3]])]);
  expect(sim.patients[0]!.doneAt).toBe(490);
  expect(sim.patients[1]!.doneAt).toBe(503);
});

test('a person listed in both roster and extraSeats is seated once', () => {
  const data: GameData = {
    ...fixtureData,
    staff: [...fixtureData.staff, { id: 'mo7', name: 'Dr. Amir', role: 'doctor', homeStation: 'b' }],
  };
  const plan: DayPlan = { ...defaultDayPlan(data, 1), extraSeats: { b: ['mo7'] } };
  plan.roster.b = ['mo7', 'doc1'];
  const sim = createDaySim(data, plan, { patients: [] });
  sim.step();
  const seats = sim.snapshot().stations.find((s) => s.id === 'b')!.seats.map((s) => s.staffId);
  expect(seats).toEqual(['doc1', 'mo7']);
});

test('Plan 1 and 2 behaviour is unchanged when the new fields are absent', () => {
  const data = loadGameData();
  for (const seed of [1, 7]) {
    const plan = defaultDayPlan(data, seed);
    plan.events = [{ kind: 'ccmsDown', from: 480, to: 600 }, { kind: 'emergencyWalkIn', at: 600, minutes: [20, 30] }];
    expect(JSON.parse(JSON.stringify(runDay(data, plan)))).toEqual((baseline as Record<string, unknown>)[String(seed)]);
  }
});
