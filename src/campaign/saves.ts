import type { GameData } from '../sim/index';
import { dayPlanFor } from './campaign';
import { nightMessages } from './night';
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
const isStr = (x: unknown): x is string => typeof x === 'string';
const isBool = (x: unknown): x is boolean => typeof x === 'boolean';
const all = (xs: unknown, ok: (x: Record<string, unknown>) => boolean) =>
  Array.isArray(xs) && xs.every((x) => isObj(x) && ok(x));
const strings = (xs: unknown) => Array.isArray(xs) && xs.every(isStr);

/** Every SOP card's settings must be there with the right types, or the clinic day can't run. */
function sopOk(sop: unknown): boolean {
  if (!isObj(sop)) return false;
  const { saringan: sa, laluanKhas: lk, pinjamDoktor: pd, temujanji: tj, kontingensiCcms: kc } = sop;
  return (
    isObj(sa) && isObj(sa.bypass) && Object.values(sa.bypass).every(isBool) &&
    isObj(lk) && isBool(lk.enabled) && strings(lk.groups) && strings(lk.stations) &&
    isObj(pd) && isBool(pd.enabled) && isNum(pd.queueThreshold) && isNum(pd.maxDoctors) &&
    isObj(tj) && isBool(tj.enabled) && isNum(tj.from) && isNum(tj.to) && isNum(tj.slotMinutes) && isNum(tj.perSlot) &&
    isObj(kc) && isBool(kc.printedList)
  );
}

function checkState(st: unknown): CampaignState {
  if (!isObj(st)) throw new Error(`${NOT_A_SAVE} (no campaign state).`);
  const need = (ok: boolean, field: string) => {
    if (!ok) throw new Error(`This save is damaged: "${field}" is missing or wrong.`);
  };
  need(isNum(st.seed), 'seed');
  need(isNum(st.day) && Number.isInteger(st.day) && st.day >= 1, 'day');
  need(st.mode === 'campaign' || st.mode === 'endless', 'mode');
  need(isObj(st.roster) && Object.values(st.roster).every((ids) => Array.isArray(ids) && ids.every((i) => typeof i === 'string')), 'roster');
  need(sopOk(st.sop), 'sop');
  need(strings(st.unlocked), 'unlocked');
  need(strings(st.justUnlocked), 'justUnlocked');
  need(isNum(st.goodwill), 'goodwill');
  need(isNum(st.reliefsThisWeek), 'reliefsThisWeek');
  need(all(st.trainees, (t) => isStr(t.staffId) && isNum(t.experience) && (t.mentor === null || isStr(t.mentor))), 'trainees');
  need(isBool(st.mentorCardOn), 'mentorCardOn');
  need(all(st.extraStaff, (p) => isStr(p.id) && isStr(p.name) && isStr(p.role) && isStr(p.homeStation)), 'extraStaff');
  const t = st.tomorrow;
  need(
    isObj(t) && all(t.events, (e) => isStr(e.kind)) && strings(t.away) &&
      all(t.moves, (m) => isStr(m.staffId) && isStr(m.from) && isStr(m.to)) &&
      (t.relief === null || (isObj(t.relief) && isStr(t.relief.staffId) && isStr(t.relief.station))),
    'tomorrow',
  );
  need(all(st.messages, (m) =>
    isStr(m.id) && isStr(m.kind) && isStr(m.from) && isStr(m.text) && (m.chosen === null || isStr(m.chosen)) &&
    all(m.choices, (c) => isStr(c.id) && isStr(c.label))), 'messages');
  need(all(st.history, (d) => ['day', 'patient', 'hcw', 'overtime', 'docOnlyWait', 'peakQueue'].every((k) => isNum(d[k]))), 'history');
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

/** Null when the save fits this game's clinic: known rooms and staff, and tomorrow can be planned from it. */
export function validateSaveAgainst(data: GameData, save: SaveGame): string | null {
  const rooms = new Set(data.stations.map((s) => s.id));
  const badRooms = Object.keys(save.state.roster).filter((id) => !rooms.has(id));
  if (badRooms.length > 0) return `This save is damaged: it mentions rooms the clinic doesn’t have (${badRooms.join(', ')}).`;
  const known = new Set([...data.staff, ...save.state.extraStaff].map((p) => p.id));
  const unknown = [...new Set(Object.values(save.state.roster).flat())].filter((id) => !known.has(id));
  if (unknown.length > 0) return `This save mentions staff the game doesn’t know: ${unknown.join(', ')}.`;
  try {
    // A dry run of what loading does next: plan tomorrow and read tonight's messages.
    dayPlanFor(data, save.state);
    nightMessages(data, save.state, save.state.history.at(-1) ?? null);
  } catch {
    return 'This save is damaged and can’t be loaded.';
  }
  return null;
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
