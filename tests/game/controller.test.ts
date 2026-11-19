import { createController } from '../../src/game/controller';
import { SCENARIOS } from '../../src/game/scenarios';
import { loadGameData } from '../../src/sim/data';

const data = loadGameData();

test('there are six day types', () => {
  expect(SCENARIOS.map((s) => s.id)).toEqual(['biasa', 'ccmsPagi', 'printer', 'basAsrama', 'kecemasan', 'doktorEL']);
});

test('start → running; frame advances sim; pause stops advancing', () => {
  const c = createController(data, 1);
  expect(c.phase).toBe('plan');
  expect(c.sim).toBeNull();
  c.start();
  expect(c.phase).toBe('running');
  expect(c.clock.speed).toBe(1);
  const t0 = c.sim!.now;
  c.frame(5000);
  expect(c.sim!.now).toBeGreaterThan(t0);
  c.pause();
  expect(c.phase).toBe('paused');
  const t1 = c.sim!.now;
  c.frame(5000);
  expect(c.sim!.now).toBe(t1);
  c.resume();
  expect(c.phase).toBe('running');
});

test('finishNow reaches the report with a sane DayReport', () => {
  const c = createController(data, 3);
  c.start();
  c.finishNow();
  expect(c.phase).toBe('report');
  expect(c.report!.seed).toBe(3);
  expect(c.report!.patientSatisfaction).toBeGreaterThanOrEqual(0);
  expect(c.report!.patientSatisfaction).toBeLessThanOrEqual(100);
});

test('frame moves to the report once the day is done', () => {
  const c = createController(data, 3);
  c.start();
  c.setSpeed(4);
  for (let i = 0; i < 2000 && c.phase === 'running'; i++) c.frame(1000);
  expect(c.phase).toBe('report');
});

test('an unstaffed day still reaches the report at the hard stop', () => {
  const c = createController(data, 1);
  const plan = structuredClone(c.plan);
  plan.roster.ancNurse = [];
  c.setPlan(plan);
  c.start();
  c.finishNow();
  expect(c.phase).toBe('report');
  expect(c.report!.unfinished).toBeGreaterThan(0);
  expect(JSON.stringify(c.report)).not.toMatch(/"(mean|max|patientSatisfaction|hcwSatisfaction)":null/);
});

test('doktorEL scenario leaves one MCH doctor; ccmsPagi adds the event', () => {
  const c = createController(data, 1);
  c.setScenario('doktorEL');
  c.start();
  expect(c.sim!.staff.filter((s) => s.station === 'mchDoctor')).toHaveLength(1);
  const d = createController(data, 1);
  d.setScenario('ccmsPagi');
  d.start();
  expect(d.dayPlan!.events).toContainEqual({ kind: 'ccmsDown', from: 480, to: 600 });
  expect(d.plan.events).toEqual([]); // the player's own plan is untouched
});

test('doktorEL keeps the doctor on leave out of every room, even if the player moved them', () => {
  const c = createController(data, 1);
  const plan = structuredClone(c.plan);
  plan.roster.mchDoctor = ['mo1', 'mo3'];
  plan.roster.opdDoctor = ['mo2', 'mo4', 'mo5', 'mo6'];
  c.setPlan(plan);
  c.setScenario('doktorEL');
  c.start();
  expect(c.sim!.staff.find((s) => s.id === 'mo2')!.station).toBeNull();
});

test('liveRoster shows a roster change still being briefed', () => {
  const c = createController(data, 1);
  c.start();
  c.pause();
  const moved = { ...c.liveRoster(), mchDoctor: ['mo1', 'mo3'], opdDoctor: ['mo4', 'mo5', 'mo6'] };
  c.applyChange({ roster: moved });
  expect(c.liveRoster().mchDoctor).toEqual(['mo1', 'mo3']);
});

test('setScenario rejects an unknown id', () => {
  expect(() => createController(data, 1).setScenario('nope')).toThrow(/nope/);
});

test('applyChange is rejected outside running/paused', () => {
  const c = createController(data, 1);
  expect(() => c.applyChange({ sop: c.plan.sop })).toThrow();
  c.start();
  c.pause();
  expect(c.applyChange({ sop: c.plan.sop }).effectiveAt).toBe(c.sim!.now + data.tuning.briefingDelayMinutes);
});

test('newDay increments the seed and keeps SOP settings; replay keeps the seed', () => {
  const c = createController(data, 5);
  const plan = structuredClone(c.plan);
  plan.sop.saringan.bypass.anc_doctor_only = true;
  c.setPlan(plan);
  c.start();
  c.finishNow();
  c.replay();
  expect(c.phase).toBe('plan');
  expect(c.plan.seed).toBe(5);
  c.start();
  c.finishNow();
  c.newDay();
  expect(c.phase).toBe('plan');
  expect(c.plan.seed).toBe(6);
  expect(c.plan.sop.saringan.bypass.anc_doctor_only).toBe(true);
  expect(c.sim).toBeNull();
  expect(c.report).toBeNull();
});

test('subscribers are notified on phase changes, and can unsubscribe', () => {
  const c = createController(data, 1);
  let calls = 0;
  const off = c.subscribe(() => calls++);
  c.start();
  c.pause();
  expect(calls).toBeGreaterThanOrEqual(2);
  off();
  const before = calls;
  c.resume();
  expect(calls).toBe(before);
});
