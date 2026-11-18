import { loadGameData } from '../../src/sim/data';
import { createSim, type Sim } from '../../src/sim/engine';
import { defaultDayPlan } from '../../src/sim/plan';
import type { DayPlan } from '../../src/sim/types';
import { fixtureData, fixturePlan, scripted } from './fixtures';

const finish = (sim: Sim) => {
  while (!sim.isDone()) sim.step();
  return sim;
};
const staffOf = (sim: Sim, id: string) => sim.staff.find((s) => s.id === id)!;

test('single patient walks the route', () => {
  const sim = finish(createSim(fixtureData, fixturePlan, { patients: [scripted(0, 480, [['a', 2], ['b', 3]])] }));
  expect(sim.patients[0]!.doneAt).toBe(485);
});

test('two-seat shared queue serves two at once', () => {
  const data = structuredClone(fixtureData);
  data.stations[1]!.seats = 2;
  data.staff.push({ id: 'doc2', name: 'Dr. Hafiz', role: 'doctor', homeStation: 'b' });
  const plan = defaultDayPlan(data, 1);
  const sim = finish(createSim(data, plan, { patients: [scripted(0, 480, [['b', 10]]), scripted(1, 480, [['b', 10]])] }));
  expect(sim.patients.map((p) => p.doneAt)).toEqual([490, 490]);
});

describe('queue order', () => {
  const trio = () => [
    scripted(0, 480, [['b', 5]]),
    scripted(1, 481, [['b', 5]]),
    scripted(2, 482, [['b', 5]], ['pregnant']),
  ];
  test('first come first served without Laluan Khas', () => {
    const sim = finish(createSim(fixtureData, fixturePlan, { patients: trio() }));
    expect(sim.patients.find((p) => p.id === 1)!.doneAt).toBe(490);
    expect(sim.patients.find((p) => p.id === 2)!.doneAt).toBe(495);
  });
  test('priority group first with Laluan Khas on that station', () => {
    const plan: DayPlan = structuredClone(fixturePlan);
    plan.sop.laluanKhas = { enabled: true, groups: ['pregnant'], stations: ['b'] };
    const sim = finish(createSim(fixtureData, plan, { patients: trio() }));
    expect(sim.patients.find((p) => p.id === 2)!.doneAt).toBe(490);
    expect(sim.patients.find((p) => p.id === 1)!.doneAt).toBe(495);
  });
});

test('arrival at 990 registered, 991 turned away', () => {
  const sim = finish(createSim(fixtureData, fixturePlan, {
    patients: [scripted(0, 990, [['a', 2], ['b', 3]]), scripted(1, 991, [['a', 2], ['b', 3]])],
  }));
  expect(sim.patients.find((p) => p.id === 0)!.turnedAway).toBe(false);
  expect(sim.patients.find((p) => p.id === 0)!.doneAt).toBe(995);
  expect(sim.patients.find((p) => p.id === 1)!.turnedAway).toBe(true);
});

test('a patient arriving before 07:00 joins the crowd at 07:00 instead of vanishing', () => {
  const sim = finish(createSim(fixtureData, fixturePlan, { patients: [scripted(0, 400, [['a', 2], ['b', 3]])] }));
  expect(sim.patients[0]!.doneAt).toBe(485);
  expect(sim.now).toBeLessThan(1140);
});

test('lunch on time when free at 13:00', () => {
  const doc = staffOf(finish(createSim(fixtureData, fixturePlan, { patients: [] })), 'doc1');
  expect([doc.lunchStart, doc.lunchEnd]).toEqual([780, 840]);
});

test('late lunch when busy until 13:20', () => {
  const doc = staffOf(finish(createSim(fixtureData, fixturePlan, { patients: [scripted(0, 760, [['b', 40]])] })), 'doc1');
  expect([doc.lunchStart, doc.lunchEnd]).toEqual([800, 840]);
});

test('no lunch when never free before 825', () => {
  const doc = staffOf(finish(createSim(fixtureData, fixturePlan, { patients: [scripted(0, 770, [['b', 100]])] })), 'doc1');
  expect(doc.lunchStart).toBeNull();
});

test('unstaffed station ends at hard stop with unfinished patients', () => {
  const plan: DayPlan = { ...fixturePlan, roster: { ...fixturePlan.roster, b: [] } };
  const sim = finish(createSim(fixtureData, plan, { patients: [scripted(0, 480, [['a', 2], ['b', 3]])] }));
  expect(sim.now).toBe(1140);
  expect(sim.patients.some((p) => p.doneAt === null)).toBe(true);
});

test('idle minutes count only open, available, non-serving time before closing', () => {
  const doc = staffOf(finish(createSim(fixtureData, fixturePlan, { patients: [scripted(0, 480, [['b', 30]])] })), 'doc1');
  expect(doc.idleMorning).toBe(120 - 30); // 08:00–10:00 minus 30 min of service
  expect(doc.idleMinutes).toBe(540 - 60 - 30); // 08:00–17:00 minus lunch minus service
});

test('same plan → identical patients and staff after a full day', () => {
  const data = loadGameData();
  const a = finish(createSim(data, defaultDayPlan(data, 11)));
  const b = finish(createSim(data, defaultDayPlan(data, 11)));
  expect(a.patients).toEqual(b.patients);
  expect(a.staff).toEqual(b.staff);
});

test('default day finishes before the hard stop with everyone seen', () => {
  const data = loadGameData();
  const sim = finish(createSim(data, defaultDayPlan(data, 3)));
  expect(sim.now).toBeLessThan(1140);
  expect(sim.patients.every((p) => p.doneAt !== null)).toBe(true);
});

test('snapshot lists queues and seats', () => {
  const sim = createSim(fixtureData, fixturePlan, {
    patients: [scripted(0, 480, [['a', 2], ['b', 3]]), scripted(1, 480, [['a', 2], ['b', 3]])],
  });
  while (sim.now < 481) sim.step();
  const snap = sim.snapshot();
  expect(snap.now).toBe(481);
  const a = snap.stations.find((s) => s.id === 'a')!;
  expect(a.seats).toEqual([{ staffId: 'clerk1', patientId: 0, onLunch: false }]);
  expect(a.queue).toEqual([1]);
  expect(snap.waitingCount).toBe(1);
  expect(snap.donePatients).toBe(0);
});
