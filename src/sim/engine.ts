import { generatePatients } from './patients';
import { createRng, type Rng } from './rng';
import { filterRoute } from './routing';
import type { DayPlan, GameData, Minute, Patient, PlannedStep, StaffId, StationDef, StationId } from './types';

export const DAY_START: Minute = 420; // 07:00, the crowd starts forming
export const CLINIC_OPENS: Minute = 480; // 08:00
export const MORNING_JAM_END: Minute = 600; // 10:00, end of the window we report idle time for
export const REGISTRATION_CLOSES: Minute = 990; // 16:30, last accepted arrival
export const LUNCH_START: Minute = 780; // 13:00
export const LUNCH_END: Minute = 840; // 14:00
export const CLINIC_CLOSES: Minute = 1020; // 17:00

export interface StaffState {
  id: StaffId;
  station: StationId | null;
  servingPatient: number | null;
  remaining: number;
  onLunch: boolean;
  lunchStart: Minute | null;
  lunchEnd: Minute | null;
  unavailableUntil: Minute | null;
  idleMinutes: number;
  /** Idle minutes between 08:00 and 10:00, where the MCH jam shows. */
  idleMorning: number;
  overloadMinutes: number;
  overtimeMinutes: number;
}

export interface SimSnapshot {
  now: Minute;
  stations: {
    id: StationId;
    queue: number[];
    seats: { staffId: StaffId; patientId: number | null; onLunch: boolean }[];
  }[];
  waitingCount: number;
  donePatients: number;
}

export interface Sim {
  readonly now: Minute;
  step(): void;
  isDone(): boolean;
  snapshot(): SimSnapshot;
  readonly patients: readonly Patient[];
  readonly staff: readonly StaffState[];
  readonly peakQueue: Readonly<Record<StationId, { size: number; at: Minute }>>;
}

export interface SimOptions {
  /** Scripted patients (tutorials, tests) instead of generated ones. */
  patients?: Patient[];
}

/** Hooks that Task 6 (events) plugs into. Kept internal to the engine. */
export interface EngineHooks {
  beforeMinute(t: Minute): void;
  serviceMinutes(base: number, station: StationDef, t: Minute): number;
  appointmentInfoAvailable(t: Minute): boolean;
}

interface QueueEntry {
  patientId: number;
  joinedAt: Minute;
}

export interface EngineInternals {
  data: GameData;
  plan: DayPlan;
  rng: Rng;
  patients: Patient[];
  staff: StaffState[];
  queues: Map<StationId, QueueEntry[]>;
  stationById: Map<StationId, StationDef>;
  now(): Minute;
  enqueue(patient: Patient, station: StationId, t: Minute): void;
  isAvailable(s: StaffState, t: Minute): boolean;
}

export function createSim(
  data: GameData,
  plan: DayPlan,
  options: SimOptions = {},
  makeHooks?: (internals: EngineInternals) => Partial<EngineHooks>,
): Sim {
  const rng = createRng(plan.seed);
  const patients: Patient[] = options.patients
    ? structuredClone(options.patients)
    : generatePatients(data, plan, rng);
  const patientById = new Map<number, Patient>();
  for (const p of patients) patientById.set(p.id, p);

  const stationById = new Map(data.stations.map((s) => [s.id, s]));
  const queues = new Map<StationId, QueueEntry[]>(data.stations.map((s) => [s.id, []]));

  // Seat staff in roster order, capped at the station's seat count.
  const seated = new Map<StaffId, StationId>();
  for (const station of data.stations) {
    const ids = (plan.roster[station.id] ?? []).filter((id) => !seated.has(id)).slice(0, station.seats);
    for (const id of ids) seated.set(id, station.id);
  }
  const staff: StaffState[] = data.staff.map((p) => ({
    id: p.id,
    station: seated.get(p.id) ?? null,
    servingPatient: null,
    remaining: 0,
    onLunch: false,
    lunchStart: null,
    lunchEnd: null,
    unavailableUntil: null,
    idleMinutes: 0,
    idleMorning: 0,
    overloadMinutes: 0,
    overtimeMinutes: 0,
  }));

  const peakQueue: Record<StationId, { size: number; at: Minute }> = {};
  for (const s of data.stations) peakQueue[s.id] = { size: 0, at: DAY_START };

  let now: Minute = DAY_START;

  const enqueue = (patient: Patient, station: StationId, t: Minute) => {
    queues.get(station)!.push({ patientId: patient.id, joinedAt: t });
  };

  const isOpen = (station: StationId, t: Minute) => t >= stationById.get(station)!.opensAt;
  const isAvailable = (s: StaffState, t: Minute) =>
    s.station !== null &&
    isOpen(s.station, t) &&
    !s.onLunch &&
    (s.unavailableUntil === null || t >= s.unavailableUntil);

  const internals: EngineInternals = {
    data, plan, rng, patients, staff, queues, stationById,
    now: () => now,
    enqueue,
    isAvailable,
  };
  const hooks: EngineHooks = {
    beforeMinute: () => {},
    serviceMinutes: (base) => base,
    appointmentInfoAvailable: () => true,
    ...makeHooks?.(internals),
  };

  const currentStep = (p: Patient): PlannedStep | undefined => (p.route ?? p.steps)[p.stepIndex];

  /** Moves a patient to their next step after finishing service at `station`. */
  const advance = (p: Patient, station: StationDef, t: Minute) => {
    if (station.role === 'clerk' && p.route === null) {
      p.route = filterRoute(p.steps.slice(p.stepIndex + 1), p.visitType, plan.sop, hooks.appointmentInfoAvailable(t));
      p.stepIndex = 0;
    } else {
      p.stepIndex++;
    }
    const next = currentStep(p);
    if (next) enqueue(p, next.station, t);
    else p.doneAt = t;
  };

  /** Removes and returns the next patient to serve at a station, or null. */
  const takeNext = (station: StationId): Patient | null => {
    const queue = queues.get(station)!;
    if (queue.length === 0) return null;
    const lk = plan.sop.laluanKhas;
    const priorityHere = lk.enabled && lk.stations.includes(station);
    const rank = (e: QueueEntry) =>
      priorityHere && patientById.get(e.patientId)!.priority.some((g) => lk.groups.includes(g)) ? 0 : 1;
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i]!, b = queue[best]!;
      if (rank(a) < rank(b) || (rank(a) === rank(b) && (a.joinedAt < b.joinedAt || (a.joinedAt === b.joinedAt && a.patientId < b.patientId)))) {
        best = i;
      }
    }
    const [entry] = queue.splice(best, 1);
    return patientById.get(entry!.patientId)!;
  };

  const staffedSeats = (station: StationId) => staff.filter((s) => s.station === station).length;

  const step = () => {
    const t = now;
    const { tuning } = data;

    // 1. Event hooks.
    hooks.beforeMinute(t);

    // 2. Arrivals.
    for (const p of patients) {
      if (p.arrival !== t || p.doneAt !== null || p.turnedAway) continue;
      if (t > REGISTRATION_CLOSES) {
        p.turnedAway = true;
        continue;
      }
      const first = currentStep(p);
      if (first) enqueue(p, first.station, t);
      else p.doneAt = t;
    }

    // 3. Service progresses; finished patients move on.
    for (const station of data.stations) {
      for (const s of staff) {
        if (s.station !== station.id || s.servingPatient === null) continue;
        s.remaining -= 1;
        if (s.remaining <= 0) {
          const p = patientById.get(s.servingPatient)!;
          s.servingPatient = null;
          s.remaining = 0;
          advance(p, station, t);
        }
      }
    }

    // 4. Lunch.
    for (const s of staff) {
      if (s.station === null) continue;
      if (s.onLunch && s.lunchStart !== null && t >= Math.max(LUNCH_END, s.lunchStart + tuning.lunchMinMinutes)) {
        s.onLunch = false;
        s.lunchEnd = t;
      }
      if (
        s.lunchStart === null &&
        t >= LUNCH_START &&
        t <= tuning.lunchLateCutoff &&
        s.servingPatient === null &&
        queues.get(s.station)!.length === 0
      ) {
        s.onLunch = true;
        s.lunchStart = t;
      }
    }

    // 5. Free seats take the next patient.
    for (const station of data.stations) {
      for (const s of staff) {
        if (s.station !== station.id || s.servingPatient !== null || !isAvailable(s, t)) continue;
        const p = takeNext(station.id);
        if (!p) break;
        s.servingPatient = p.id;
        s.remaining = hooks.serviceMinutes(currentStep(p)!.minutes, station, t);
      }
    }

    // 6. Stats.
    let waiting = 0;
    for (const q of queues.values()) waiting += q.length;
    const crowded = waiting > tuning.crowdCapacity;
    for (const [stationId, q] of queues) {
      for (const e of q) {
        const p = patientById.get(e.patientId)!;
        p.waitMinutes += 1;
        if (crowded) p.crowdMinutes += 1;
      }
      if (q.length > peakQueue[stationId]!.size) peakQueue[stationId] = { size: q.length, at: t };
      const seats = staffedSeats(stationId);
      if (seats > 0 && q.length > tuning.overloadQueuePerSeat * seats) {
        for (const s of staff) if (s.station === stationId) s.overloadMinutes += 1;
      }
    }
    for (const s of staff) {
      if (s.station === null) continue;
      if (s.servingPatient !== null) {
        if (t >= CLINIC_CLOSES) s.overtimeMinutes += 1;
      } else if (t < CLINIC_CLOSES && isAvailable(s, t)) {
        s.idleMinutes += 1;
        if (t >= CLINIC_OPENS && t < MORNING_JAM_END) s.idleMorning += 1;
      }
    }

    // 7. Clock.
    now = t + 1;
  };

  const isDone = () =>
    now >= data.tuning.hardStop ||
    (now >= CLINIC_CLOSES && patients.every((p) => p.turnedAway || p.doneAt !== null));

  const snapshot = (): SimSnapshot => {
    let waitingCount = 0;
    const stations = data.stations.map((station) => {
      const queue = queues.get(station.id)!.map((e) => e.patientId);
      waitingCount += queue.length;
      return {
        id: station.id,
        queue,
        seats: staff
          .filter((s) => s.station === station.id)
          .map((s) => ({ staffId: s.id, patientId: s.servingPatient, onLunch: s.onLunch })),
      };
    });
    return { now, stations, waitingCount, donePatients: patients.filter((p) => p.doneAt !== null).length };
  };

  return {
    get now() {
      return now;
    },
    step,
    isDone,
    snapshot,
    patients,
    staff,
    peakQueue,
  };
}
