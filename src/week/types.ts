import type { WeekFlags } from '../popups/popups';
import type { BalikOutcome, LunchOutcome } from '../sim/index';

/** What one played day leaves behind for the district review. */
export interface DaySummary {
  day: number;
  patient: number;
  hcw: number;
  lunch: LunchOutcome;
  balik: BalikOutcome;
  overtime: number;
  /** Mean wait of "doktor sahaja" antenatal mothers, minutes. */
  docOnlyWait: number;
}

export interface WeekState {
  version: 2;
  difficulty: 'easy';
  seed: number;
  /** 1-based week number. */
  week: number;
  /** 1 = Isnin … 5 = Jumaat; 6 once Jumaat has been played. */
  day: number;
  flags: WeekFlags;
  history: DaySummary[];
}

export interface WeekSave {
  version: 2;
  /** ISO timestamp, passed in by the UI. */
  savedAt: string;
  state: WeekState;
}
