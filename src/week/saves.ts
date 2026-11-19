import type { SaveStorage } from './storage';
import type { WeekSave, WeekState } from './types';
import { WEEK_DAYS } from './week';

export const WEEK_KEY = 'kkm.week.easy';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isInt = (x: unknown, min: number, max = Infinity): boolean => isNum(x) && Number.isInteger(x) && x >= min && x <= max;

function stateOk(st: unknown): st is WeekState {
  if (!isObj(st)) return false;
  const f = st.flags;
  return (
    st.version === 2 && st.difficulty === 'easy' && isNum(st.seed) && isInt(st.week, 1) && isInt(st.day, 1, WEEK_DAYS) &&
    isObj(f) && typeof f.saringan === 'boolean' && typeof f.laluanKhas === 'boolean' &&
    Array.isArray(st.history) &&
    st.history.every((d) => isObj(d) && ['day', 'patient', 'hcw', 'overtime', 'docOnlyWait'].every((k) => isNum(d[k])) &&
      typeof d.lunch === 'string' && typeof d.balik === 'string')
  );
}

export function parseWeekSave(text: string): { ok: true; save: WeekSave } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not valid JSON' };
  }
  if (!isObj(raw) || raw.version !== 2) return { ok: false, error: 'not a version 2 week save' };
  if (typeof raw.savedAt !== 'string' || !stateOk(raw.state)) return { ok: false, error: 'damaged week save' };
  return { ok: true, save: { version: 2, savedAt: raw.savedAt, state: raw.state } };
}

export const saveWeek = (storage: SaveStorage, save: WeekSave): boolean => storage.set(WEEK_KEY, JSON.stringify(save));

/** The saved Easy week, or null when there is none or it can't be used. Never throws. */
export function loadWeek(storage: SaveStorage): WeekSave | null {
  const text = storage.get(WEEK_KEY);
  if (text === null) return null;
  const r = parseWeekSave(text);
  return r.ok ? r.save : null;
}

export const clearWeek = (storage: SaveStorage): void => storage.remove(WEEK_KEY);
