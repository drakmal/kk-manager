import { districtReview } from '../../src/week/district';
import type { DaySummary } from '../../src/week/types';
import { createWeek, dayName, dayPlanFor, endDay, nextWeek, WEEK_DAYS } from '../../src/week/week';
import { loadGameData } from '../../src/sim/index';
import { fakeReport } from './helpers';

const data = loadGameData();
const noFlags = { saringan: false, laluanKhas: false };

test('a new week starts on Isnin with no flags', () => {
  expect(createWeek(7)).toEqual({ version: 2, difficulty: 'easy', seed: 7, week: 1, day: 1, flags: noFlags, history: [] });
  expect(WEEK_DAYS).toBe(5);
  expect([1, 2, 3, 4, 5].map(dayName)).toEqual(['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat']);
});

test('the schedule: Rabu has the printer, Jumaat the emergency in Bilik 1, the rest nothing', () => {
  const s = createWeek(7);
  expect(dayPlanFor(data, { ...s, day: 1 }).events).toEqual([]);
  expect(dayPlanFor(data, { ...s, day: 2 }).events).toEqual([]);
  expect(dayPlanFor(data, { ...s, day: 3 }).events).toEqual([{ kind: 'printerDown', from: 540, to: 720 }]);
  expect(dayPlanFor(data, { ...s, day: 4 }).events).toEqual([]);
  expect(dayPlanFor(data, { ...s, day: 5 }).events).toEqual([{ kind: 'emergencyWalkIn', at: 630, minutes: [30, 30], station: 'opdRoom1' }]);
  expect(dayPlanFor(data, { ...s, week: 2, day: 3 }).seed).toBe(7 * 1000 + 2 * 10 + 3);
});

test('flags reach the SOP of the day plan', () => {
  const plan = dayPlanFor(data, { ...createWeek(1), flags: { saringan: true, laluanKhas: true } });
  expect(plan.sop.saringan.bypass.anc_doctor_only).toBe(true);
  expect(plan.sop.laluanKhas.enabled).toBe(true);
});

test('endDay records the day, keeps the flags and moves on', () => {
  const s = endDay(createWeek(1), fakeReport({ patientSatisfaction: 61, docOnly: 33 }), { saringan: true, laluanKhas: false });
  expect(s.day).toBe(2);
  expect(s.flags).toEqual({ saringan: true, laluanKhas: false });
  expect(s.history).toEqual([{ day: 1, patient: 61, hcw: 75, lunch: 'onTime', balik: 'onTime', overtime: 0, docOnlyWait: 33 }]);
});

test('nextWeek starts a fresh Isnin and keeps the flags', () => {
  let s = createWeek(1);
  for (let i = 0; i < 5; i++) s = endDay(s, fakeReport(), { saringan: true, laluanKhas: false });
  expect(s.day).toBe(6);
  const n = nextWeek(s);
  expect(n).toMatchObject({ week: 2, day: 1, history: [], flags: { saringan: true, laluanKhas: false } });
});

const day = (n: number, over: Partial<DaySummary> = {}): DaySummary => ({
  day: n, patient: 60, hcw: 75, lunch: 'late', balik: 'onTime', overtime: 0, docOnlyWait: 50, ...over,
});
const week = (over: (n: number) => Partial<DaySummary> = () => ({})) => [1, 2, 3, 4, 5].map((n) => day(n, over(n)));

test('district grade for 5 days: A needs lunch on time on 3 days', () => {
  expect(districtReview(week((n) => ({ patient: 70, hcw: 80, lunch: n <= 3 ? 'onTime' : 'late' }))).grade).toBe('A');
  expect(districtReview(week((n) => ({ patient: 70, hcw: 80, lunch: n <= 2 ? 'onTime' : 'late' }))).grade).toBe('B');
  expect(districtReview(week(() => ({ patient: 55, hcw: 69.9 }))).grade).toBe('C');
  expect(districtReview(week(() => ({ patient: 39.9 }))).grade).toBe('D');
});

test('district remarks: 3–5 lines with the week summary first and the grade line last', () => {
  const r = districtReview(week((n) => ({ lunch: n <= 3 ? 'onTime' : 'missed', balik: n <= 2 ? 'overtime' : 'onTime', docOnlyWait: n === 1 ? 100 : 50 })));
  expect(r.lines[0]).toBe('Purata kepuasan pesakit minggu ini 60, kepuasan staf 75.');
  expect(r.lines).toContain('Saringan di kaunter nampak berkesan. Ibu yang jumpa doktor sahaja tak tunggu lama lagi.');
  expect(r.lines).toContain('Doktor dapat makan tengah hari. Bagus!');
  expect(r.lines).toContain('Staf selalu balik lewat. Tolong semak jadual.');
  expect(r.lines.at(-1)).toBe('Prestasi baik, ada ruang penambahbaikan.');
  expect(districtReview([]).grade).toBe('D');
  expect(districtReview([]).lines.length).toBeGreaterThanOrEqual(3);
});
