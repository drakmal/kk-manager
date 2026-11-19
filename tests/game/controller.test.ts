import { createController } from '../../src/game/controller';
import { IN_DAY_POPUPS, type PopupDef } from '../../src/popups/popups';
import { defaultDayPlan, loadGameData } from '../../src/sim/index';

const data = loadGameData();
/** A popup that fires once at `at`, with choices a/b. */
const at = (id: string, minute: number): PopupDef => ({
  id,
  due: (c) => c.now === minute,
  build: (c) => ({ id: `${id}@${c.now}`, from: 'Test', text: id, choices: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }),
  effect: () => ({}),
});

test('start → running; frame advances sim; pause stops advancing', () => {
  const c = createController(data, 1);
  expect(c.phase).toBe('plan');
  c.start();
  expect(c.phase).toBe('running');
  const t0 = c.sim!.now;
  c.frame(5000);
  expect(c.sim!.now).toBeGreaterThan(t0);
  c.pause();
  const t1 = c.sim!.now;
  c.frame(5000);
  expect(c.sim!.now).toBe(t1);
  c.resume();
  expect(c.phase).toBe('running');
});

test('a popup stops the clock until it is answered', () => {
  const c = createController(data, 1, { popups: [at('p', 430)] });
  c.start();
  c.setSpeed(4);
  for (let i = 0; i < 10; i++) c.frame(1000);
  expect(c.sim!.now).toBe(430);
  expect(c.popup).toMatchObject({ id: 'p@430', text: 'p' });
  c.frame(5000);
  expect(c.sim!.now).toBe(430);
  c.answer('a');
  expect(c.popup).toBeNull();
  c.frame(1000);
  expect(c.sim!.now).toBeGreaterThan(430);
});

test('two popups due at the same minute open one after the other', () => {
  const c = createController(data, 1, { popups: [at('first', 425), at('second', 425)] });
  c.start();
  c.skipAhead();
  expect(c.popup?.text).toBe('first');
  c.answer('a');
  expect(c.popup?.text).toBe('second');
  expect(c.sim!.now).toBe(425);
  c.answer('b');
  expect(c.popup).toBeNull();
  c.skipAhead();
  expect(c.phase).toBe('report');
});

test('skipAhead stops at a due popup and never answers it', () => {
  const c = createController(data, 1, { popups: [at('p', 600)] });
  c.start();
  c.skipAhead();
  expect(c.phase).toBe('running');
  expect(c.sim!.now).toBe(600);
  expect(c.popup?.id).toBe('p@600');
  c.skipAhead();
  expect(c.sim!.now).toBe(600);
  c.answer('a');
  c.skipAhead();
  expect(c.phase).toBe('report');
  expect(c.report!.patientSatisfaction).toBeGreaterThanOrEqual(0);
});

test('the idle-doctor Saringan choice sets the flag and the live SOP', () => {
  const c = createController(data, 1, { day: 1, popups: IN_DAY_POPUPS });
  c.start();
  c.skipAhead();
  expect(c.popup?.id).toBe('idleDoctor@510');
  c.answer('saringan');
  expect(c.flags.saringan).toBe(true);
  expect(c.liveSop!.saringan.bypass.anc_doctor_only).toBe(true);
  expect(c.sim!.staff.every((s) => s.changeCount === 0)).toBe(true);
});

test('Ikut giliran biasa keeps the idle popup away for the rest of the day', () => {
  const c = createController(data, 1, { day: 1, popups: IN_DAY_POPUPS });
  c.start();
  c.skipAhead();
  expect(c.popup?.id).toBe('idleDoctor@510');
  c.answer('biasa');
  while (c.phase !== 'report') {
    c.skipAhead();
    if (c.popup) {
      expect(c.popup.id).not.toMatch(/^idleDoctor/);
      c.answer(c.popup.choices[0]!.id);
    }
  }
});

test('flags from earlier days switch the SOP on at start', () => {
  const c = createController(data, 1, { flags: { saringan: true, laluanKhas: true } });
  c.start();
  expect(c.dayPlan!.sop.saringan.bypass.anc_doctor_only).toBe(true);
  expect(c.dayPlan!.sop.laluanKhas.enabled).toBe(true);
});

test('the printer IT choice ends the outage early and stops the counters for 20 minutes', () => {
  const plan = { ...defaultDayPlan(data, 1), events: [{ kind: 'printerDown' as const, from: 540, to: 720 }] };
  const c = createController(data, 1, { plan, day: 3, popups: IN_DAY_POPUPS });
  c.start();
  for (;;) {
    c.skipAhead();
    if (!c.popup || c.popup.id.startsWith('printer')) break;
    c.answer(c.popup.choices[1]!.id);
  }
  expect(c.popup?.id).toBe('printer@540');
  c.answer('it');
  c.skipAhead(); // to the next popup or the end
  const pt2 = c.sim!.staff.find((s) => s.id === 'pt2')!;
  expect(pt2.unavailableUntil).toBe(560);
});

test('pausing costs nothing', () => {
  const c = createController(data, 1);
  c.start();
  c.pause();
  c.resume();
  c.skipAhead();
  expect(c.sim!.staff.every((s) => s.changeCount === 0)).toBe(true);
});

test('an unstaffed day still reaches the report at the hard stop', () => {
  const plan = defaultDayPlan(data, 1);
  for (const id of Object.keys(plan.roster)) plan.roster[id] = [];
  const c = createController(data, 1, { plan });
  c.start();
  c.skipAhead();
  expect(c.phase).toBe('report');
  expect(c.report!.unfinished).toBeGreaterThan(0);
});

test('subscribers are notified on phase changes and popups, and can unsubscribe', () => {
  const c = createController(data, 1, { popups: [at('p', 430)] });
  let calls = 0;
  const off = c.subscribe(() => calls++);
  c.start();
  c.skipAhead();
  const n = calls;
  expect(n).toBeGreaterThanOrEqual(2);
  off();
  c.answer('a');
  expect(calls).toBe(n);
});
