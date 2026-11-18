import { loadGameData } from '../../src/sim/data';
import { createDaySim } from '../../src/sim/events';
import { isActive, serviceMinutes } from '../../src/sim/events';
import { defaultDayPlan } from '../../src/sim/plan';
import type { ClinicEvent, DayPlan } from '../../src/sim/types';
import type { Sim } from '../../src/sim/engine';

const data = loadGameData();
const tuning = data.tuning;
const reg = data.stations.find((s) => s.id === 'mchRegistration')!;
const pharmacy = data.stations.find((s) => s.id === 'pharmacy')!;
const doctor = data.stations.find((s) => s.id === 'mchDoctor')!;
const ccms = (from: number, to: number): ClinicEvent => ({ kind: 'ccmsDown', from, to });
const printer = (from: number, to: number): ClinicEvent => ({ kind: 'printerDown', from, to });
const finish = (sim: Sim) => {
  while (!sim.isDone()) sim.step();
  return sim;
};
const plan = (seed: number, edit?: (p: DayPlan) => void) => {
  const p = defaultDayPlan(data, seed);
  edit?.(p);
  return p;
};

test('isActive uses [from, to)', () => {
  expect(isActive([ccms(480, 600)], 'ccmsDown', 480)).toBe(true);
  expect(isActive([ccms(480, 600)], 'ccmsDown', 600)).toBe(false);
  expect(isActive([ccms(480, 600)], 'printerDown', 500)).toBe(false);
});

test('CCMS down doubles registration minutes', () => {
  expect(serviceMinutes(3, reg, 500, [ccms(480, 600)], tuning)).toBe(6);
});

test('CCMS + printer stack', () => {
  expect(serviceMinutes(3, reg, 500, [ccms(480, 600), printer(480, 600)], tuning)).toBe(7);
});

test('printer adds to pharmacy only inside its window, and never to doctors', () => {
  expect(serviceMinutes(5, pharmacy, 500, [printer(480, 600)], tuning)).toBe(7);
  expect(serviceMinutes(5, pharmacy, 700, [printer(480, 600)], tuning)).toBe(5);
  expect(serviceMinutes(5, doctor, 500, [printer(480, 600), ccms(480, 600)], tuning)).toBe(5);
});

describe('CCMS downtime and the Saringan card', () => {
  const docOnlyRoutes = (printed: boolean) => {
    const sim = finish(createDaySim(data, plan(4, (p) => {
      p.sop.saringan.bypass.anc_doctor_only = true;
      p.sop.kontingensiCcms.printedList = printed;
      p.events.push(ccms(420, 1140));
    })));
    return sim.patients.filter((p) => p.visitType === 'anc_doctor_only').map((p) => p.route!.map((s) => s.station));
  };
  test('registered during CCMS down → nurse step kept even with bypass', () => {
    const routes = docOnlyRoutes(false);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) expect(r).toContain('ancNurse');
  });
  test('printed list keeps bypass working during CCMS down', () => {
    for (const r of docOnlyRoutes(true)) expect(r).not.toContain('ancNurse');
  });
});

test('influx adds patients at the given minute', () => {
  const base = finish(createDaySim(data, plan(6)));
  const sim = finish(createDaySim(data, plan(6, (p) => p.events.push({ kind: 'influx', at: 600, count: 20, visitType: 'opd_general' }))));
  const added = sim.patients.filter((p) => !base.patients.some((b) => b.id === p.id));
  expect(added).toHaveLength(20);
  expect(added.every((p) => p.arrival === 600 && p.visitType === 'opd_general')).toBe(true);
  expect(new Set(sim.patients.map((p) => p.id)).size).toBe(sim.patients.length);
});

test('emergency walk-in removes one OPD doctor for its duration', () => {
  const sim = createDaySim(data, plan(7, (p) => p.events.push({ kind: 'emergencyWalkIn', at: 600, minutes: [40, 40] })));
  while (sim.now <= 600) sim.step();
  const opd = sim.staff.filter((s) => s.station === 'opdDoctor');
  const away = opd.filter((s) => s.unavailableUntil !== null);
  expect(away).toHaveLength(1);
  const until = away[0]!.unavailableUntil!;
  expect(until).toBeGreaterThanOrEqual(640);
  // Once they finish any current patient, they take no one until they're back.
  while (sim.now < until) {
    sim.step();
    const s = sim.staff.find((x) => x.id === away[0]!.id)!;
    if (sim.now > until - 40 + 1) expect(s.servingPatient).toBeNull();
  }
});

test('a doctor away on an emergency does not start lunch until back', () => {
  const sim = finish(createDaySim(data, plan(8, (p) => p.events.push({ kind: 'emergencyWalkIn', at: 770, minutes: [45, 45] }))));
  const away = sim.staff.find((s) => s.unavailableUntil !== null)!;
  if (away.lunchStart !== null) expect(away.lunchStart).toBeGreaterThanOrEqual(away.unavailableUntil!);
});

test('Pinjam fills an empty MCH seat after the briefing delay', () => {
  // Saringan on: doctor-only mothers skip the nurse, so the single doctor's queue builds up.
  // (Without it the ANC nurse bottleneck keeps the doctor queue ≤ 2 — that's the jam itself.)
  // Seed 1: the queue hits 3 at 08:59 while an OPD doctor is free. (On seed 2 it only
  // hits 3 at 13:46, when the free OPD doctors are at lunch, so correctly no one is borrowed.)
  const sim = createDaySim(data, plan(1, (p) => {
    p.roster.mchDoctor = ['mo1'];
    p.sop.saringan.bypass.anc_doctor_only = true;
    p.sop.pinjamDoktor = { enabled: true, queueThreshold: 3, maxDoctors: 1 };
  }));
  let firstReached: number | null = null;
  let movedAt: number | null = null;
  while (!sim.isDone()) {
    const mchQueue = sim.snapshot().stations.find((s) => s.id === 'mchDoctor')!.queue.length;
    if (firstReached === null && mchQueue >= 3) firstReached = sim.now;
    sim.step();
    if (movedAt === null && sim.staff.filter((s) => s.station === 'mchDoctor').length === 2) movedAt = sim.now;
  }
  expect(firstReached).not.toBeNull();
  expect(movedAt).not.toBeNull();
  expect(movedAt! - firstReached!).toBeGreaterThanOrEqual(tuning.briefingDelayMinutes);
  expect(sim.staff.filter((s) => s.station === 'opdDoctor')).toHaveLength(3);
  expect(sim.staff.filter((s) => s.station === 'mchDoctor')).toHaveLength(2);
});

test('Pinjam never borrows when the MCH room is full', () => {
  const sim = finish(createDaySim(data, plan(2, (p) => {
    p.sop.pinjamDoktor = { enabled: true, queueThreshold: 1, maxDoctors: 2 };
  })));
  expect(sim.staff.filter((s) => s.station === 'opdDoctor')).toHaveLength(4);
});
