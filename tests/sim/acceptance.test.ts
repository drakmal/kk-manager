import { loadGameData } from '../../src/sim/data';
import { runDay } from '../../src/sim/day';
import { defaultDayPlan } from '../../src/sim/plan';
import type { DayPlan, DayReport } from '../../src/sim/types';

const data = loadGameData();
const days = (mut?: (p: DayPlan) => void) =>
  Array.from({ length: 20 }, (_, i) => {
    const p = defaultDayPlan(data, i + 1);
    mut?.(p);
    return runDay(data, p);
  });
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const mchIdle = (r: DayReport) => mean(['mo1', 'mo2'].map((id) => r.idleByStaff[id]!.morning));
const docOnlyWait = (r: DayReport) => r.waitByVisitType.anc_doctor_only?.mean ?? 0;

test('first come first served reproduces the jam: MCH doctors idle ≥ 25 min between 08:00–10:00', () => {
  expect(mean(days().map(mchIdle))).toBeGreaterThanOrEqual(25);
});

test('Saringan bypass for doctor-only cuts their wait by ≥ 40% and reduces MCH doctor idle', () => {
  const base = days();
  const fix = days((p) => { p.sop.saringan.bypass.anc_doctor_only = true; });
  expect(mean(fix.map(docOnlyWait))).toBeLessThanOrEqual(0.6 * mean(base.map(docOnlyWait)));
  expect(mean(fix.map(mchIdle))).toBeLessThan(mean(base.map(mchIdle)));
});

test('CCMS down 08:00–10:00 undoes the fix unless the list was printed', () => {
  const ccms = (printed: boolean) =>
    days((p) => {
      p.sop.saringan.bypass.anc_doctor_only = true;
      p.sop.kontingensiCcms.printedList = printed;
      p.events.push({ kind: 'ccmsDown', from: 480, to: 600 });
    });
  expect(mean(ccms(false).map(docOnlyWait))).toBeGreaterThan(mean(ccms(true).map(docOnlyWait)));
});
