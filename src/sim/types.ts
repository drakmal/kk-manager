/** Minutes since midnight. 480 = 08:00. */
export type Minute = number;
export type StationId = string;
export type VisitTypeId = string;
export type StaffId = string;

export type Role = 'doctor' | 'nurse' | 'jm' | 'ppk' | 'clerk' | 'lab' | 'pharmacy' | 'radiographer' | 'therapist' | 'dietitian';
export type UnitId = 'mch' | 'opd';
export type PriorityGroup = 'pregnant' | 'elderly' | 'oku' | 'childUnder2';
export type ColourCode = 'putih' | 'hijau' | 'kuning' | 'merah';

export interface StationDef {
  id: StationId;
  unit: UnitId | 'shared';
  label: string;
  role: Role;
  /** Capacity. Rooms are fixed: the roster decides who fills these seats. */
  seats: number;
  /** Default service time range [min, max], inclusive. */
  minutes: [number, number];
  opensAt: Minute;
  /** Rooms that share a routing name (e.g. OPD Bilik 1 and 2 are group "opdDoctor"). Each room keeps its own queue. */
  group?: string;
  /**
   * A fixed lunch break [from, to) when the station closes even if patients are queuing
   * (registration counters: 13:00–13:30). Anyone mid-service finishes that patient first.
   */
  lunchBreak?: [Minute, Minute];
}

export interface StepDef {
  station: StationId;
  minutes?: [number, number];
  /** Probability this step happens for a given patient. Default 1. */
  chance?: number;
  /** Can be skipped by the Saringan di Kaunter SOP card. */
  bypassable?: boolean;
  /** Extra minutes some patients need at this step (e.g. an ultrasound scan in the MCH doctor room). */
  addOn?: { chance: number; minutes: [number, number] };
}

export interface VisitTypeDef {
  id: VisitTypeId;
  unit: UnitId;
  label: string;
  /** Share of the unit's daily volume. Shares per unit sum to 1. */
  share: number;
  appointment: boolean;
  priority: PriorityGroup[];
  colourWeights?: Partial<Record<ColourCode, number>>;
  steps: StepDef[];
}

export interface StaffDef {
  id: StaffId;
  name: string;
  role: Role;
  homeStation: StationId;
}

export interface ArrivalProfile {
  dailyVolume: Record<UnitId, number>;
  /** Windows are [from, to). Shares sum to 1. */
  hourlyShare: { from: Minute; to: Minute; share: number }[];
}

export interface Tuning {
  patienceMinutes: number;
  waitPenaltyPerMinute: number;
  crowdCapacity: number;
  crowdPenaltyPerMinute: number;
  overloadQueuePerSeat: number;
  overloadPenaltyPerMinute: number;
  lateLunchPenalty: number;
  missedLunchPenalty: number;
  overtimePenaltyPerMinute: number;
  briefingDelayMinutes: number;
  lunchMinMinutes: number;
  lunchLateCutoff: Minute;
  hardStop: Minute;
  colourDoctorMultiplier: Record<ColourCode, number>;
  ccmsRegistrationMultiplier: number;
  printerRegistrationExtra: number;
  printerPharmacyExtra: number;
  /** Staff satisfaction points lost per mid-day SOP or roster change. */
  midDayChangePenalty: number;
}

/** A mid-day change to the plan. It takes effect after the briefing delay. */
export interface PlanChange {
  sop?: SopSettings;
  /** Listed stations get exactly these staff (capped at seats); people moved off a listed station are unseated. */
  roster?: Record<StationId, StaffId[]>;
  /** Replaces the day's events (e.g. the printer fixed early). */
  events?: ClinicEvent[];
}

export interface GameData {
  stations: StationDef[];
  visitTypes: VisitTypeDef[];
  staff: StaffDef[];
  arrivals: ArrivalProfile;
  tuning: Tuning;
}

export interface SopSettings {
  saringan: { bypass: Record<VisitTypeId, boolean> };
  laluanKhas: { enabled: boolean; groups: PriorityGroup[]; stations: StationId[] };
  pinjamDoktor: { enabled: boolean; queueThreshold: number; maxDoctors: number };
  temujanji: { enabled: boolean; from: Minute; to: Minute; slotMinutes: number; perSlot: number };
  kontingensiCcms: { printedList: boolean };
  /** "Doktor makan dulu": doctors start lunch at 13:00 even if patients are still waiting. */
  lunchOnTime: boolean;
}

export type ClinicEvent =
  | { kind: 'ccmsDown'; from: Minute; to: Minute }
  | { kind: 'printerDown'; from: Minute; to: Minute }
  | { kind: 'influx'; at: Minute; count: number; visitType: VisitTypeId }
  /** Takes the first free doctor seated in `station` (default: the first OPD doctor room). */
  | { kind: 'emergencyWalkIn'; at: Minute; minutes: [number, number]; station?: StationId }
  /** That person is unavailable for [from, to). Someone mid-consultation finishes that patient first. */
  | { kind: 'staffAway'; staffId: StaffId; from: Minute; to: Minute };

/** A step with its duration already drawn for this patient. */
export interface PlannedStep {
  station: StationId;
  minutes: number;
  bypassable: boolean;
}

export interface Patient {
  id: number;
  visitType: VisitTypeId;
  unit: UnitId;
  arrival: Minute;
  priority: PriorityGroup[];
  colour: ColourCode | null;
  /** Full planned path, including the steps before registration. */
  steps: PlannedStep[];
  /** Set when registration finishes: the steps after registration, filtered by SOP. */
  route: PlannedStep[] | null;
  /** Indexes `steps` until `route` is set, then indexes `route` (reset to 0). */
  stepIndex: number;
  waitMinutes: number;
  crowdMinutes: number;
  doneAt: Minute | null;
  turnedAway: boolean;
}

export type LunchOutcome = 'onTime' | 'late' | 'missed';
export type BalikOutcome = 'onTime' | 'overtime';

export interface DayReport {
  seed: number;
  lunch: { outcome: LunchOutcome; perDoctor: { staffId: StaffId; lunchStart: Minute | null }[] };
  balik: { outcome: BalikOutcome; lastPatientDone: Minute | null; overtimeMinutes: number };
  /** 0..100, one decimal. */
  patientSatisfaction: number;
  /** 0..100, one decimal. */
  hcwSatisfaction: number;
  waitByVisitType: Record<VisitTypeId, { mean: number; max: number; count: number }>;
  idleByStaff: Record<StaffId, { morning: number; total: number }>;
  peakQueue: Record<StationId, { size: number; at: Minute }>;
  turnedAway: number;
  unfinished: number;
}

export interface DayPlan {
  seed: number;
  roster: Record<StationId, StaffId[]>;
  sop: SopSettings;
  events: ClinicEvent[];
  /** Service-time multiplier per person (trainees, mentors, low morale). Default 1, floor 0.1. */
  staffSpeed?: Record<StaffId, number>;
  /** Staff seated beyond a station's `seats` (trainees), in order. They take this seat even if also rostered. */
  extraSeats?: Record<StationId, StaffId[]>;
}
