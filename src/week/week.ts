import { sopWithFlags, type WeekFlags } from '../popups/popups';
import { defaultDayPlan, type ClinicEvent, type DayPlan, type DayReport, type GameData } from '../sim/index';
import type { WeekState } from './types';

export const WEEK_DAYS = 5;
export const DAY_NAMES = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat'];

/** What goes wrong on each day of the Easy week (index 0 = Isnin). The Khamis EL is a morning popup. */
const SCHEDULE: ClinicEvent[][] = [
  [],
  [],
  [{ kind: 'printerDown', from: 540, to: 720 }],
  [],
  [{ kind: 'emergencyWalkIn', at: 630, minutes: [30, 30], station: 'opdRoom1' }],
];

export const dayName = (day: number): string => DAY_NAMES[(day - 1) % DAY_NAMES.length]!;

export function createWeek(seed: number): WeekState {
  return { version: 2, difficulty: 'easy', seed, week: 1, day: 1, flags: { saringan: false, laluanKhas: false }, history: [] };
}

export function dayPlanFor(data: GameData, state: WeekState): DayPlan {
  const plan = defaultDayPlan(data, state.seed * 1000 + state.week * 10 + state.day);
  return {
    ...plan,
    sop: sopWithFlags(plan.sop, state.flags),
    events: structuredClone(SCHEDULE[state.day - 1] ?? []),
  };
}

export function endDay(state: WeekState, report: DayReport, flags: WeekFlags): WeekState {
  return {
    ...structuredClone(state),
    day: state.day + 1,
    flags: { ...flags },
    history: [
      ...state.history,
      {
        day: state.day,
        patient: report.patientSatisfaction,
        hcw: report.hcwSatisfaction,
        lunch: report.lunch.outcome,
        balik: report.balik.outcome,
        overtime: report.balik.overtimeMinutes,
        docOnlyWait: report.waitByVisitType.anc_doctor_only?.mean ?? 0,
      },
    ],
  };
}

export function nextWeek(state: WeekState): WeekState {
  return { ...structuredClone(state), week: state.week + 1, day: 1, history: [] };
}
