import type { BalikOutcome, ClinicEvent, LunchOutcome, SopSettings, StaffDef, StaffId, StationId } from '../sim/index';

export type CardId = 'saringan' | 'laluanKhas' | 'pinjamDoktor' | 'temujanji' | 'kontingensiCcms' | 'pasanganMentor';

export interface Trainee {
  staffId: StaffId;
  experience: number;
  mentor: StaffId | null;
}

/** What one played day leaves behind for the district review and tomorrow's messages. */
export interface DaySummary {
  day: number;
  patient: number;
  hcw: number;
  lunch: LunchOutcome;
  balik: BalikOutcome;
  overtime: number;
  /** Mean wait of "doktor sahaja" antenatal mothers, minutes. */
  docOnlyWait: number;
  /** Largest queue seen at any station. */
  peakQueue: number;
  ccms: boolean;
}

export type MessageKind = 'el' | 'newDoctor' | 'memo' | 'complaint' | 'forecast' | 'tutorial';

export interface Choice {
  id: string;
  label: string;
  /** Why this choice can't be taken right now, or null when it can. */
  disabledReason: string | null;
}

export interface Message {
  id: string;
  kind: MessageKind;
  from: string;
  text: string;
  choices: Choice[];
  chosen: string | null;
  /** The staff member a leave message is about. */
  staffId?: StaffId;
}

export interface Tomorrow {
  events: ClinicEvent[];
  /** Staff who won't come in tomorrow (emergency leave). */
  away: StaffId[];
  relief: { staffId: StaffId; station: StationId } | null;
  /** One-day moves, e.g. an OPD doctor borrowed into an MCH seat. Undone after the day. */
  moves: { staffId: StaffId; from: StationId; to: StationId }[];
}

export interface CampaignState {
  version: 1;
  seed: number;
  /** 1-based: the day about to be played. */
  day: number;
  mode: 'campaign' | 'endless';
  roster: Record<StationId, StaffId[]>;
  sop: SopSettings;
  unlocked: CardId[];
  /** Cards unlocked by the day just played; the night shows a memo for each. */
  justUnlocked: CardId[];
  goodwill: number;
  reliefsThisWeek: number;
  trainees: Trainee[];
  /** Pasangan Mentor lives here, not in the sim's SopSettings. */
  mentorCardOn: boolean;
  /** Staff who joined during the campaign (the new doctor). */
  extraStaff: StaffDef[];
  tomorrow: Tomorrow;
  /** Tonight's messages. */
  messages: Message[];
  history: DaySummary[];
}

export interface SaveGame {
  version: 1;
  slot: 1 | 2 | 3;
  /** ISO timestamp, passed in by the UI. */
  savedAt: string;
  state: CampaignState;
}
