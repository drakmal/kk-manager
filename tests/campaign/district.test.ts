import { districtReview } from '../../src/campaign/district';
import type { DaySummary } from '../../src/campaign/types';

const day = (n: number, over: Partial<DaySummary> = {}): DaySummary => ({
  day: n, patient: 60, hcw: 75, lunch: 'late', balik: 'onTime', overtime: 0, docOnlyWait: 50, peakQueue: 10, ccms: false, ...over,
});
const days = (over: (n: number) => Partial<DaySummary> = () => ({})) => Array.from({ length: 10 }, (_, i) => day(i + 1, over(i + 1)));

test('grade A needs P ≥ 70, H ≥ 80 and lunch on time on 6+ days', () => {
  const a = districtReview(days((n) => ({ patient: 70, hcw: 80, lunch: n <= 6 ? 'onTime' : 'late' })));
  expect(a).toMatchObject({ grade: 'A', patient: 70, hcw: 80, lunchOnTime: 6 });
  expect(districtReview(days((n) => ({ patient: 70, hcw: 80, lunch: n <= 5 ? 'onTime' : 'late' }))).grade).toBe('B');
  expect(districtReview(days(() => ({ patient: 69.9, hcw: 90, lunch: 'onTime' }))).grade).toBe('B');
});

test('grade B needs P ≥ 55 and H ≥ 70; C needs P ≥ 40; otherwise D', () => {
  expect(districtReview(days(() => ({ patient: 55, hcw: 70 }))).grade).toBe('B');
  expect(districtReview(days(() => ({ patient: 55, hcw: 69.9 }))).grade).toBe('C');
  expect(districtReview(days(() => ({ patient: 40, hcw: 10 }))).grade).toBe('C');
  expect(districtReview(days(() => ({ patient: 39.9, hcw: 99 }))).grade).toBe('D');
});

test('grade lines', () => {
  const line = (g: string) => districtReview(days(() => (
    g === 'A' ? { patient: 80, hcw: 85, lunch: 'onTime' } : g === 'B' ? { patient: 60, hcw: 75 } : g === 'C' ? { patient: 45 } : { patient: 20 }
  ))).lines;
  expect(line('A')).toContain('PKD sangat berpuas hati.');
  expect(line('B')).toContain('Prestasi baik, ada ruang penambahbaikan.');
  expect(line('C')).toContain('Perlu tindakan segera.');
  expect(line('D')).toContain('Kita perlu berbincang…');
});

test('a 40% drop in doctor-only waits earns the Saringan remark', () => {
  const r = districtReview(days((n) => ({ docOnlyWait: n === 1 ? 100 : n === 10 ? 60 : 80 })));
  expect(r).toMatchObject({ docOnlyWaitFirst: 100, docOnlyWaitLast: 60 });
  expect(r.lines).toContain('Saringan di kaunter nampak berkesan. Ibu yang jumpa doktor sahaja tak tunggu lama lagi.');
  expect(districtReview(days((n) => ({ docOnlyWait: n === 1 ? 100 : 61 }))).lines.some((l) => l.startsWith('Saringan'))).toBe(false);
});

test('lunch and overtime remarks', () => {
  const r = districtReview(days((n) => ({ lunch: n <= 6 ? 'onTime' : 'missed', balik: n <= 3 ? 'overtime' : 'onTime' })));
  expect(r).toMatchObject({ lunchOnTime: 6, overtimeDays: 3 });
  expect(r.lines).toContain('Doktor dapat makan tengah hari. Bagus!');
  expect(r.lines).toContain('Staf selalu balik lewat. Tolong semak jadual.');
  expect(r.lines.length).toBeGreaterThanOrEqual(3);
  expect(r.lines.length).toBeLessThanOrEqual(5);
});

test('there are always 3 to 5 lines', () => {
  for (const p of [20, 45, 60, 80]) {
    const n = districtReview(days(() => ({ patient: p }))).lines.length;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5);
  }
});

test('only the first 10 days count', () => {
  const extra = [...days(() => ({ patient: 80, hcw: 85, lunch: 'onTime' })), day(11, { patient: 0, hcw: 0 })];
  expect(districtReview(extra).grade).toBe('A');
});

test('an empty history gives D with no NaN', () => {
  const r = districtReview([]);
  expect(r.grade).toBe('D');
  for (const v of [r.patient, r.hcw, r.lunchOnTime, r.overtimeDays, r.docOnlyWaitFirst, r.docOnlyWaitLast]) expect(Number.isNaN(v)).toBe(false);
  expect(r.lines.length).toBeGreaterThanOrEqual(3);
});
