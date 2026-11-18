import type { DayPlan, GameData, StaffId, StationId } from './types';

/**
 * The starting plan: everyone sits at their home station, every SOP card is
 * off (first come first served), and no events are scheduled.
 */
export function defaultDayPlan(data: GameData, seed: number): DayPlan {
  const roster: Record<StationId, StaffId[]> = {};
  for (const station of data.stations) roster[station.id] = [];
  for (const person of data.staff) roster[person.homeStation]!.push(person.id);

  const bypass: Record<string, boolean> = {};
  for (const v of data.visitTypes) bypass[v.id] = false;

  return {
    seed,
    roster,
    sop: {
      saringan: { bypass },
      laluanKhas: { enabled: false, groups: [], stations: [] },
      pinjamDoktor: { enabled: false, queueThreshold: 6, maxDoctors: 1 },
      temujanji: { enabled: false, from: 480, to: 720, slotMinutes: 30, perSlot: 6 },
      kontingensiCcms: { printedList: false },
    },
    events: [],
  };
}
