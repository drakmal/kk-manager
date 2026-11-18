import { createSim, type EngineHooks, type EngineInternals, type Sim, type SimOptions, type StaffState } from './engine';
import { makePatient } from './patients';
import type { ClinicEvent, DayPlan, GameData, Minute, StationDef, Tuning } from './types';

const MCH_DOCTOR = 'mchDoctor';
const OPD_DOCTOR = 'opdDoctor';

/** True while an event of this kind covers minute t. Windows are [from, to). */
export function isActive(events: ClinicEvent[], kind: 'ccmsDown' | 'printerDown', t: Minute): boolean {
  return events.some((e) => e.kind === kind && e.from <= t && t < e.to);
}

/**
 * Service time after events. CCMS down multiplies registration time; a
 * disconnected printer adds minutes to registration and pharmacy. Effects stack:
 * multiplier first, then the extra minutes.
 */
export function serviceMinutes(base: number, station: StationDef, t: Minute, events: ClinicEvent[], tuning: Tuning): number {
  let minutes = base;
  const printerDown = isActive(events, 'printerDown', t);
  if (station.role === 'clerk') {
    if (isActive(events, 'ccmsDown', t)) minutes = Math.ceil(minutes * tuning.ccmsRegistrationMultiplier);
    if (printerDown) minutes += tuning.printerRegistrationExtra;
  }
  if (station.role === 'pharmacy' && printerDown) minutes += tuning.printerPharmacyExtra;
  return minutes;
}

function eventHooks(x: EngineInternals): Partial<EngineHooks> {
  const { data, plan, rng, staff, queues } = x;
  const events = plan.events;
  let nextId = Math.max(-1, ...x.patients.map((p) => p.id)) + 1;
  const pendingMoves: { staffId: string; at: Minute }[] = [];
  let borrowed = 0;

  const byStaffOrder = (a: StaffState, b: StaffState) =>
    data.staff.findIndex((p) => p.id === a.id) - data.staff.findIndex((p) => p.id === b.id);
  const opdDoctors = () => staff.filter((s) => s.station === OPD_DOCTOR).sort(byStaffOrder);

  const startEmergency = (t: Minute, range: [number, number]) => {
    const free = (s: StaffState) => !s.onLunch && (s.unavailableUntil === null || t >= s.unavailableUntil);
    const doctor = opdDoctors().find(free);
    if (!doctor) return;
    const duration = rng.int(range[0], range[1]);
    // A doctor who is mid-consultation finishes that patient first, then goes.
    const finishesAt = doctor.servingPatient !== null ? t + doctor.remaining - 1 : t;
    doctor.unavailableUntil = finishesAt + duration;
  };

  const pinjamDoktor = (t: Minute) => {
    const card = plan.sop.pinjamDoktor;
    if (!card.enabled) return;

    // Carry out moves whose briefing delay has passed (between patients only).
    for (const move of [...pendingMoves]) {
      const s = staff.find((p) => p.id === move.staffId)!;
      if (t >= move.at && s.servingPatient === null) {
        s.station = MCH_DOCTOR;
        pendingMoves.splice(pendingMoves.indexOf(move), 1);
      }
    }

    const seats = x.stationById.get(MCH_DOCTOR)!.seats;
    const staffed = staff.filter((s) => s.station === MCH_DOCTOR).length + pendingMoves.length;
    if (staffed >= seats || borrowed >= card.maxDoctors) return;
    if (queues.get(MCH_DOCTOR)!.length < card.queueThreshold) return;

    const pending = new Set(pendingMoves.map((m) => m.staffId));
    const idle = opdDoctors().find((s) => !pending.has(s.id) && s.servingPatient === null && x.isAvailable(s, t));
    if (!idle) return;
    pendingMoves.push({ staffId: idle.id, at: t + data.tuning.briefingDelayMinutes });
    borrowed++;
  };

  return {
    beforeMinute: (t) => {
      for (const e of events) {
        if (e.kind === 'influx' && e.at === t) {
          for (let i = 0; i < e.count; i++) x.addPatient(makePatient(data, e.visitType, t, nextId++, rng));
        }
        if (e.kind === 'emergencyWalkIn' && e.at === t) startEmergency(t, e.minutes);
      }
      pinjamDoktor(t);
    },
    serviceMinutes: (base, station, t) => serviceMinutes(base, station, t, events, data.tuning),
    appointmentInfoAvailable: (t) => !isActive(events, 'ccmsDown', t) || plan.sop.kontingensiCcms.printedList,
  };
}

/** A full clinic day: the engine plus events and the Pinjam Doktor OPD card. */
export function createDaySim(data: GameData, plan: DayPlan, options: SimOptions = {}): Sim {
  return createSim(data, plan, options, eventHooks);
}
