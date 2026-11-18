import type { Rng } from './rng';
import type { ColourCode, DayPlan, GameData, Minute, Patient, PlannedStep, PriorityGroup, UnitId, VisitTypeId } from './types';

const UNITS: UnitId[] = ['mch', 'opd'];
const REGISTRATION_CLOSES: Minute = 990;
/** Temujanji: patients turn up between 15 minutes early and 5 minutes late for their slot. */
const SLOT_EARLY = 15;
const SLOT_LATE = 5;

const OPD_ELDERLY_CHANCE = 0.2;
const OPD_OKU_CHANCE = 0.03;

/** Builds one patient of a given visit type, drawing colour, priority flags and step durations. */
export function makePatient(data: GameData, visitType: VisitTypeId, arrival: Minute, id: number, rng: Rng): Patient {
  const def = data.visitTypes.find((v) => v.id === visitType);
  if (!def) throw new Error(`Unknown visit type "${visitType}"`);

  const colour: ColourCode | null = def.colourWeights
    ? rng.weighted(def.colourWeights as Record<ColourCode, number>)
    : null;

  const priority: PriorityGroup[] = [...def.priority];
  if (def.unit === 'opd') {
    if (rng.chance(OPD_ELDERLY_CHANCE)) priority.push('elderly');
    if (rng.chance(OPD_OKU_CHANCE)) priority.push('oku');
  }

  const steps: PlannedStep[] = [];
  for (const step of def.steps) {
    if (!rng.chance(step.chance ?? 1)) continue;
    const station = data.stations.find((s) => s.id === step.station)!;
    const [min, max] = step.minutes ?? station.minutes;
    let minutes = rng.int(min, max);
    if (step.station === 'mchDoctor' && colour) {
      minutes = Math.ceil(minutes * data.tuning.colourDoctorMultiplier[colour]);
    }
    steps.push({ station: step.station, minutes, bypassable: step.bypassable === true });
  }

  return {
    id,
    visitType,
    unit: def.unit,
    arrival,
    priority,
    colour,
    steps,
    route: null,
    stepIndex: 0,
    waitMinutes: 0,
    crowdMinutes: 0,
    doneAt: null,
    turnedAway: false,
  };
}

function curveArrival(data: GameData, rng: Rng): Minute {
  const windows = data.arrivals.hourlyShare;
  const weights: Record<string, number> = {};
  windows.forEach((w, i) => (weights[String(i)] = w.share));
  const w = windows[Number(rng.weighted(weights))]!;
  return Math.min(rng.int(w.from, w.to - 1), REGISTRATION_CLOSES);
}

/** Generates the day's patients, sorted by (arrival, id). Same rng seed, same patients. */
export function generatePatients(data: GameData, plan: DayPlan, rng: Rng): Patient[] {
  const temujanji = plan.sop.temujanji;
  const patients: Patient[] = [];
  let nextId = 0;
  let appointmentIndex = 0;

  for (const unit of UNITS) {
    const types = data.visitTypes.filter((v) => v.unit === unit);
    const shares: Record<string, number> = {};
    for (const v of types) shares[v.id] = v.share;

    for (let i = 0; i < data.arrivals.dailyVolume[unit]; i++) {
      const visitType = rng.weighted(shares);
      const def = types.find((v) => v.id === visitType)!;

      let arrival: Minute | null = null;
      if (temujanji.enabled && def.appointment) {
        const slot = temujanji.from + Math.floor(appointmentIndex / temujanji.perSlot) * temujanji.slotMinutes;
        appointmentIndex++;
        if (slot < temujanji.to) arrival = rng.int(slot - SLOT_EARLY, slot + SLOT_LATE);
      }
      if (arrival === null) arrival = curveArrival(data, rng);

      patients.push(makePatient(data, visitType, arrival, nextId++, rng));
    }
  }

  return patients.sort((a, b) => a.arrival - b.arrival || a.id - b.id);
}
