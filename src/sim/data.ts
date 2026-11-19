import arrivals from './data/arrivals.json';
import staff from './data/staff.json';
import stations from './data/stations.json';
import tuning from './data/tuning.json';
import visitTypes from './data/visitTypes.json';
import type { GameData, StationDef } from './types';

const SHARE_TOLERANCE = 1e-6;

/** Loads the bundled placeholder game data and validates it. */
export function loadGameData(): GameData {
  return validateGameData(structuredClone({ stations, visitTypes, staff, arrivals, tuning }));
}

function isRange(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    value[0] >= 0 &&
    value[0] <= value[1]
  );
}

function fail(message: string): never {
  throw new Error(`Invalid game data: ${message}`);
}

/**
 * Checks game data (e.g. after an edit in the Google Sheet) and throws an
 * Error naming the offending id. Returns the same object, typed.
 */
export function validateGameData(raw: unknown): GameData {
  const data = raw as GameData;
  if (!data || !Array.isArray(data.stations) || !Array.isArray(data.visitTypes) || !Array.isArray(data.staff)) {
    fail('expected stations, visitTypes and staff lists');
  }

  const stationIds = new Set<string>();
  const groupRole = new Map<string, string>();
  for (const s of data.stations) {
    if (stationIds.has(s.id)) fail(`duplicate station id "${s.id}"`);
    stationIds.add(s.id);
    if (s.lunchBreak !== undefined && !isRange(s.lunchBreak)) fail(`station "${s.id}" has a bad lunch break ${JSON.stringify(s.lunchBreak)}`);
    if (s.group !== undefined) {
      const role = groupRole.get(s.group);
      if (role !== undefined && role !== s.role) fail(`group "${s.group}" mixes roles ${role} and ${s.role}`);
      groupRole.set(s.group, s.role);
    }
    if (!isRange(s.minutes)) fail(`station "${s.id}" has a bad minutes range ${JSON.stringify(s.minutes)}`);
    if (!Number.isInteger(s.seats) || s.seats < 0) fail(`station "${s.id}" has a bad seat count ${s.seats}`);
  }

  const visitIds = new Set<string>();
  for (const v of data.visitTypes) {
    if (visitIds.has(v.id)) fail(`duplicate visit type id "${v.id}"`);
    visitIds.add(v.id);
    if (!(v.share >= 0)) fail(`visit type "${v.id}" has a bad share ${v.share}`);
    if (!Array.isArray(v.steps) || v.steps.length === 0) fail(`visit type "${v.id}" has no steps`);
    v.steps.forEach((step, i) => {
      if (!stationIds.has(step.station) && !groupRole.has(step.station)) {
        fail(`visit type "${v.id}" step ${i} uses unknown station or group "${step.station}"`);
      }
      if (step.addOn !== undefined && (!(step.addOn.chance >= 0 && step.addOn.chance <= 1) || !isRange(step.addOn.minutes))) {
        fail(`visit type "${v.id}" step ${i} has a bad add-on ${JSON.stringify(step.addOn)}`);
      }
      if (step.minutes !== undefined && !isRange(step.minutes)) {
        fail(`visit type "${v.id}" step ${i} has a bad minutes range ${JSON.stringify(step.minutes)}`);
      }
      if (step.chance !== undefined && !(step.chance > 0 && step.chance <= 1)) {
        fail(`visit type "${v.id}" step ${i} has a bad chance ${step.chance}`);
      }
    });
  }

  for (const unit of ['mch', 'opd'] as const) {
    const total = data.visitTypes.filter((v) => v.unit === unit).reduce((sum, v) => sum + v.share, 0);
    if (Math.abs(total - 1) > SHARE_TOLERANCE) fail(`visit type shares for unit "${unit}" sum to ${total}, expected 1`);
  }

  const staffIds = new Set<string>();
  for (const p of data.staff) {
    if (staffIds.has(p.id)) fail(`duplicate staff id "${p.id}"`);
    staffIds.add(p.id);
    if (!stationIds.has(p.homeStation)) fail(`staff "${p.id}" has unknown home station "${p.homeStation}"`);
  }

  const hourly = data.arrivals?.hourlyShare;
  if (!Array.isArray(hourly)) fail('arrivals.hourlyShare missing');
  hourly.forEach((h, i) => {
    if (!(h.from < h.to) || !(h.share >= 0)) fail(`arrivals.hourlyShare[${i}] is invalid`);
  });
  const hourlyTotal = hourly.reduce((sum, h) => sum + h.share, 0);
  if (Math.abs(hourlyTotal - 1) > SHARE_TOLERANCE) fail(`arrivals.hourlyShare sums to ${hourlyTotal}, expected 1`);
  for (const unit of ['mch', 'opd'] as const) {
    const n = data.arrivals.dailyVolume?.[unit];
    if (!Number.isInteger(n) || n < 0) fail(`arrivals.dailyVolume.${unit} must be a whole number ≥ 0`);
  }

  if (!data.tuning || typeof data.tuning.hardStop !== 'number') fail('tuning missing');
  if (typeof data.tuning.midDayChangePenalty !== 'number') fail('tuning.midDayChangePenalty missing');
  return data;
}

/** The rooms in a group, in data order. Empty when no station has that group. */
export function groupRooms(data: GameData, group: string): StationDef[] {
  return data.stations.filter((s) => s.group === group);
}
