import type { GameData } from '../sim/index';
import type { CampaignState, SaveGame } from './types';

export const SLOTS = [1, 2, 3] as const;
export type Slot = (typeof SLOTS)[number];
export const slotKey = (slot: Slot) => `kkm.save.${slot}`;

/** Where saves live. Every method is safe to call even when the browser blocks storage. */
export interface SaveStorage {
  get(key: string): string | null;
  /** False when the value could not be stored. */
  set(key: string, value: string): boolean;
  remove(key: string): void;
  readonly available: boolean;
}

export function memoryStorage(): SaveStorage {
  const map = new Map<string, string>();
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => (map.set(k, v), true),
    remove: (k) => void map.delete(k),
    available: true,
  };
}

/** localStorage behind try/catch. Private windows and blocked site data give available=false. */
export function browserStorage(): SaveStorage {
  const ls = (): Storage | undefined => {
    try {
      return (globalThis as { localStorage?: Storage }).localStorage ?? undefined;
    } catch {
      return undefined;
    }
  };
  const probe = () => {
    try {
      const s = ls();
      if (!s) return false;
      s.setItem('kkm.probe', '1');
      s.removeItem('kkm.probe');
      return true;
    } catch {
      return false;
    }
  };
  return {
    get: (k) => {
      try {
        return ls()?.getItem(k) ?? null;
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        const s = ls();
        if (!s) return false;
        s.setItem(k, v);
        return true;
      } catch {
        return false;
      }
    },
    remove: (k) => {
      try {
        ls()?.removeItem(k);
      } catch {
        /* nothing to do */
      }
    },
    available: probe(),
  };
}

export const serialise = (save: SaveGame): string => JSON.stringify(save);

const NOT_A_SAVE = 'This file is not a KK Manager save';
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function checkState(st: unknown): CampaignState {
  if (!isObj(st)) throw new Error(`${NOT_A_SAVE} (no campaign state).`);
  const need = (ok: boolean, field: string) => {
    if (!ok) throw new Error(`This save is damaged: "${field}" is missing or wrong.`);
  };
  need(isNum(st.seed), 'seed');
  need(isNum(st.day) && Number.isInteger(st.day) && st.day >= 1, 'day');
  need(st.mode === 'campaign' || st.mode === 'endless', 'mode');
  need(isObj(st.roster) && Object.values(st.roster).every((ids) => Array.isArray(ids) && ids.every((i) => typeof i === 'string')), 'roster');
  const sop = st.sop;
  need(isObj(sop) && ['saringan', 'laluanKhas', 'pinjamDoktor', 'temujanji', 'kontingensiCcms'].every((k) => isObj(sop[k])), 'sop');
  need(Array.isArray(st.unlocked), 'unlocked');
  need(Array.isArray(st.justUnlocked), 'justUnlocked');
  need(isNum(st.goodwill), 'goodwill');
  need(isNum(st.reliefsThisWeek), 'reliefsThisWeek');
  need(Array.isArray(st.trainees), 'trainees');
  need(typeof st.mentorCardOn === 'boolean', 'mentorCardOn');
  need(Array.isArray(st.extraStaff), 'extraStaff');
  const t = st.tomorrow;
  need(isObj(t) && Array.isArray(t.events) && Array.isArray(t.away) && Array.isArray(t.moves), 'tomorrow');
  need(Array.isArray(st.messages), 'messages');
  need(Array.isArray(st.history), 'history');
  return st as unknown as CampaignState;
}

/** The only way to load a save shape. v1 passes through; anything else is rejected with a reason. */
export function migrate(raw: unknown): SaveGame {
  if (!isObj(raw)) throw new Error(`${NOT_A_SAVE}.`);
  if (raw.version !== 1) throw new Error(`This save is from a newer/unknown version (v${String(raw.version)}).`);
  if (raw.slot !== 1 && raw.slot !== 2 && raw.slot !== 3) throw new Error('This save has no valid slot (1–3).');
  if (typeof raw.savedAt !== 'string') throw new Error('This save is damaged: "savedAt" is missing.');
  return { version: 1, slot: raw.slot, savedAt: raw.savedAt, state: checkState(raw.state) };
}

/** Null when every staff id in the save exists in the game data or joined during the campaign. */
export function validateSaveAgainst(data: GameData, save: SaveGame): string | null {
  const known = new Set([...data.staff, ...save.state.extraStaff].map((p) => p.id));
  const unknown = [...new Set(Object.values(save.state.roster).flat())].filter((id) => !known.has(id));
  return unknown.length > 0 ? `This save mentions staff the game doesn’t know: ${unknown.join(', ')}.` : null;
}

export function parseSave(text: string, data?: GameData): { ok: true; save: SaveGame } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: `${NOT_A_SAVE} (it is not valid JSON).` };
  }
  try {
    const save = migrate(raw);
    const problem = data ? validateSaveAgainst(data, save) : null;
    return problem ? { ok: false, error: problem } : { ok: true, save };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const saveSlot = (storage: SaveStorage, save: SaveGame): boolean => storage.set(slotKey(save.slot), serialise(save));

/** A missing or damaged slot returns null; it never throws. The slot key wins over the slot inside. */
export function loadSlot(storage: SaveStorage, slot: Slot): SaveGame | null {
  const text = storage.get(slotKey(slot));
  if (text === null) return null;
  const r = parseSave(text);
  return r.ok ? { ...r.save, slot } : null;
}

export function listSlots(storage: SaveStorage): { slot: Slot; day: number; mode: string; savedAt: string }[] {
  return SLOTS.flatMap((slot) => {
    const s = loadSlot(storage, slot);
    return s ? [{ slot, day: s.state.day, mode: s.state.mode, savedAt: s.savedAt }] : [];
  });
}

export const exportFileName = (save: SaveGame): string => `kk-manager-slot${save.slot}-day${save.state.day}.json`;
