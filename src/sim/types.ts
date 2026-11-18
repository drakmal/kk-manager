/** Minutes since midnight. 480 = 08:00. */
export type Minute = number;
export type StationId = string;
export type VisitTypeId = string;
export type StaffId = string;

export type Role = 'doctor' | 'nurse' | 'jm' | 'ppk' | 'clerk' | 'lab' | 'pharmacy';
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
}

export interface StepDef {
  station: StationId;
  minutes?: [number, number];
  /** Probability this step happens for a given patient. Default 1. */
  chance?: number;
  /** Can be skipped by the Saringan di Kaunter SOP card. */
  bypassable?: boolean;
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
}

export type ClinicEvent =
  | { kind: 'ccmsDown'; from: Minute; to: Minute }
  | { kind: 'printerDown'; from: Minute; to: Minute }
  | { kind: 'influx'; at: Minute; count: number; visitType: VisitTypeId }
  | { kind: 'emergencyWalkIn'; at: Minute; minutes: [number, number] };

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

export interface DayPlan {
  seed: number;
  roster: Record<StationId, StaffId[]>;
  sop: SopSettings;
  events: ClinicEvent[];
}
