import { CAMPAIGN_DAYS } from './campaign';
import type { DaySummary } from './types';

export interface DistrictReview {
  grade: 'A' | 'B' | 'C' | 'D';
  /** Mean patient satisfaction, one decimal. */
  patient: number;
  /** Mean staff satisfaction, one decimal. */
  hcw: number;
  lunchOnTime: number;
  overtimeDays: number;
  docOnlyWaitFirst: number;
  docOnlyWaitLast: number;
  /** 3–5 remarks from the district officer. */
  lines: string[];
}

const GRADE_LINE: Record<DistrictReview['grade'], string> = {
  A: 'PKD sangat berpuas hati.',
  B: 'Prestasi baik, ada ruang penambahbaikan.',
  C: 'Perlu tindakan segera.',
  D: 'Kita perlu berbincang…',
};
const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

/** The district officer's verdict on the campaign's first 10 days. */
export function districtReview(history: DaySummary[]): DistrictReview {
  const days = history.slice(0, CAMPAIGN_DAYS);
  const patient = round1(mean(days.map((d) => d.patient)));
  const hcw = round1(mean(days.map((d) => d.hcw)));
  const lunchOnTime = days.filter((d) => d.lunch === 'onTime').length;
  const overtimeDays = days.filter((d) => d.balik === 'overtime').length;
  const docOnlyWaitFirst = round1(days[0]?.docOnlyWait ?? 0);
  const docOnlyWaitLast = round1(days.at(-1)?.docOnlyWait ?? 0);

  const grade: DistrictReview['grade'] =
    patient >= 70 && hcw >= 80 && lunchOnTime >= 6 ? 'A' : patient >= 55 && hcw >= 70 ? 'B' : patient >= 40 ? 'C' : 'D';

  const lines = [`Purata kepuasan pesakit ${patient}, kepuasan staf ${hcw}.`];
  if (docOnlyWaitFirst > 0 && docOnlyWaitLast <= docOnlyWaitFirst * 0.6) {
    lines.push('Saringan di kaunter nampak berkesan. Ibu yang jumpa doktor sahaja tak tunggu lama lagi.');
  }
  lines.push(lunchOnTime >= 6 ? 'Doktor dapat makan tengah hari. Bagus!' : 'Doktor jarang dapat makan tepat pada masanya.');
  if (overtimeDays >= 3) lines.push('Staf selalu balik lewat. Tolong semak jadual.');
  lines.push(GRADE_LINE[grade]);

  return { grade, patient, hcw, lunchOnTime, overtimeDays, docOnlyWaitFirst, docOnlyWaitLast, lines };
}
