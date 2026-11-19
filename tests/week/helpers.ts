import type { DayReport } from '../../src/sim/index';

/** A minimal day report for week tests. */
export function fakeReport(over: Partial<DayReport> & { peak?: number; docOnly?: number } = {}): DayReport {
  const { peak = 10, docOnly = 40, ...rest } = over;
  return {
    seed: 1,
    lunch: { outcome: 'onTime', perDoctor: [] },
    balik: { outcome: 'onTime', lastPatientDone: 1000, overtimeMinutes: 0 },
    patientSatisfaction: 60,
    hcwSatisfaction: 75,
    waitByVisitType: { anc_doctor_only: { mean: docOnly, max: docOnly, count: 8 } },
    idleByStaff: {},
    peakQueue: { mchDoctor: { size: peak, at: 540 }, opdDoctor: { size: 3, at: 600 } },
    turnedAway: 0,
    unfinished: 0,
    ...rest,
  };
}
