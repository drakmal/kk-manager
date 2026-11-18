import { CLINIC_CLOSES, LUNCH_START, type Sim, type StaffState } from './engine';
import type { DayPlan, DayReport, GameData, LunchOutcome, Minute, Patient, Tuning } from './types';

const clamp = (v: number) => Math.min(100, Math.max(0, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const mean = (xs: number[], empty: number) => (xs.length === 0 ? empty : xs.reduce((a, b) => a + b, 0) / xs.length);

/** One patient's satisfaction. Waiting beyond patience and crowding cost points; unseen patients score 0. */
export function patientScore(p: Patient, t: Tuning): number {
  if (p.turnedAway || p.doneAt === null) return 0;
  return clamp(
    100 -
      Math.max(0, p.waitMinutes - t.patienceMinutes) * t.waitPenaltyPerMinute -
      p.crowdMinutes * t.crowdPenaltyPerMinute,
  );
}

/** Lunch outcome from each doctor's lunch start: on time at 13:00, late by 13:45, otherwise missed. */
export function lunchOutcome(starts: (Minute | null)[]): LunchOutcome {
  if (starts.every((s) => s === LUNCH_START)) return 'onTime';
  if (starts.every((s) => s !== null) && Math.max(...(starts as number[])) <= 825) return 'late';
  return 'missed';
}

/** One staff member's satisfaction: overload, their own late or missed lunch, and overtime cost points. */
export function staffScore(s: StaffState, t: Tuning): number {
  const lunchPenalty = s.lunchStart === null ? t.missedLunchPenalty : s.lunchStart > LUNCH_START ? t.lateLunchPenalty : 0;
  return clamp(
    100 - s.overloadMinutes * t.overloadPenaltyPerMinute - lunchPenalty - s.overtimeMinutes * t.overtimePenaltyPerMinute,
  );
}

export function buildReport(sim: Sim, data: GameData, plan: DayPlan): DayReport {
  const { tuning } = data;
  const roleOf = new Map(data.stations.map((s) => [s.id, s.role]));
  const rostered = sim.staff.filter((s) => s.station !== null);
  const doctors = rostered.filter((s) => roleOf.get(s.station!) === 'doctor');

  const patients = sim.patients;
  const finished = patients.filter((p) => p.doneAt !== null);
  const unfinished = patients.filter((p) => !p.turnedAway && p.doneAt === null).length;
  const lastPatientDone = finished.length === 0 ? null : Math.max(...finished.map((p) => p.doneAt!));

  const waitByVisitType: DayReport['waitByVisitType'] = {};
  for (const p of patients) {
    if (p.turnedAway) continue;
    const w = (waitByVisitType[p.visitType] ??= { mean: 0, max: 0, count: 0 });
    w.mean += p.waitMinutes; // running total, divided below
    w.max = Math.max(w.max, p.waitMinutes);
    w.count += 1;
  }
  for (const w of Object.values(waitByVisitType)) w.mean = w.count === 0 ? 0 : round1(w.mean / w.count);

  const idleByStaff: DayReport['idleByStaff'] = {};
  for (const s of rostered) idleByStaff[s.id] = { morning: s.idleMorning, total: s.idleMinutes };

  return {
    seed: plan.seed,
    lunch: {
      outcome: lunchOutcome(doctors.map((d) => d.lunchStart)),
      perDoctor: doctors.map((d) => ({ staffId: d.id, lunchStart: d.lunchStart })),
    },
    balik: {
      outcome: unfinished === 0 && (lastPatientDone === null || lastPatientDone <= CLINIC_CLOSES) ? 'onTime' : 'overtime',
      lastPatientDone,
      overtimeMinutes: rostered.reduce((sum, s) => sum + s.overtimeMinutes, 0),
    },
    patientSatisfaction: round1(mean(patients.map((p) => patientScore(p, tuning)), 100)),
    hcwSatisfaction: round1(mean(rostered.map((s) => staffScore(s, tuning)), 100)),
    waitByVisitType,
    idleByStaff,
    peakQueue: structuredClone(sim.peakQueue) as DayReport['peakQueue'],
    turnedAway: patients.filter((p) => p.turnedAway).length,
    unfinished,
  };
}
