import { createCampaign, dayPlanFor, endDay } from '../../src/campaign/campaign';
import {
  browserStorage, exportFileName, listSlots, loadSlot, memoryStorage, migrate, parseSave, saveSlot, serialise, validateSaveAgainst,
} from '../../src/campaign/saves';
import type { SaveGame } from '../../src/campaign/types';
import { loadGameData } from '../../src/sim/index';
import { fakeReport } from './helpers';

const data = loadGameData();
const makeSave = (day = 4, slot: 1 | 2 | 3 = 1): SaveGame => {
  let state = createCampaign(data, 3);
  while (state.day < day) state = endDay(data, state, fakeReport(), dayPlanFor(data, state));
  return { version: 1, slot, savedAt: '2026-11-19T21:00:00.000Z', state };
};
afterEach(() => vi.unstubAllGlobals());

test('round-trip: serialise → parseSave gives the same save', () => {
  const save = makeSave();
  const parsed = parseSave(serialise(save), data);
  expect(parsed).toEqual({ ok: true, save });
});

test('parseSave rejects bad JSON, wrong version, missing fields, unknown staff — with a message, no throw', () => {
  const good = JSON.parse(serialise(makeSave()));
  const bad = (text: string) => {
    const r = parseSave(text, data);
    expect(r.ok).toBe(false);
    return r.ok ? '' : r.error;
  };
  expect(bad('{not json')).toBe('This file is not a KK Manager save (it is not valid JSON).');
  expect(bad('42')).toMatch(/not a KK Manager save/);
  expect(bad(JSON.stringify({ ...good, version: 2 }))).toBe('This save is from a newer/unknown version (v2).');
  expect(bad(JSON.stringify({ ...good, slot: 4 }))).toMatch(/slot/);
  expect(bad(JSON.stringify({ ...good, state: { ...good.state, day: 0 } }))).toMatch(/day/);
  expect(bad(JSON.stringify({ ...good, state: { ...good.state, day: 2.5 } }))).toMatch(/day/);
  const { roster: _r, ...noRoster } = good.state;
  expect(bad(JSON.stringify({ ...good, state: noRoster }))).toMatch(/roster/);
  expect(bad(JSON.stringify({ ...good, state: { ...good.state, history: 'x' } }))).toMatch(/history/);
  expect(bad(JSON.stringify({ ...good, state: { ...good.state, sop: {} } }))).toMatch(/sop/);
  const ghost = { ...good, state: { ...good.state, roster: { ...good.state.roster, mchDoctor: ['mo1', 'ghost9'] } } };
  expect(bad(JSON.stringify(ghost))).toBe('This save mentions staff the game doesn’t know: ghost9.');
});

test('migrate passes v1 through and throws a named error otherwise', () => {
  const save = makeSave();
  expect(migrate(JSON.parse(serialise(save)))).toEqual(save);
  expect(() => migrate({ version: 'old' })).toThrow('This save is from a newer/unknown version (vold).');
  expect(() => migrate(null)).toThrow(/not a KK Manager save/);
});

test('validateSaveAgainst accepts staff who joined during the campaign', () => {
  const save = makeSave(5);
  save.state.roster.opdDoctor!.push('mo7');
  expect(validateSaveAgainst(data, save)).toBeNull();
});

test('saveSlot/loadSlot/listSlots with memoryStorage', () => {
  const storage = memoryStorage();
  expect(listSlots(storage)).toEqual([]);
  expect(saveSlot(storage, makeSave(4, 1))).toBe(true);
  expect(saveSlot(storage, makeSave(2, 3))).toBe(true);
  expect(loadSlot(storage, 1)).toEqual(makeSave(4, 1));
  expect(loadSlot(storage, 2)).toBeNull();
  expect(storage.get('kkm.save.3')).not.toBeNull();
  expect(listSlots(storage)).toEqual([
    { slot: 1, day: 4, mode: 'campaign', savedAt: '2026-11-19T21:00:00.000Z' },
    { slot: 3, day: 2, mode: 'campaign', savedAt: '2026-11-19T21:00:00.000Z' },
  ]);
});

test('a corrupt slot loads as null and is skipped by listSlots', () => {
  const storage = memoryStorage();
  saveSlot(storage, makeSave(4, 1));
  storage.set('kkm.save.2', '{"version":1,');
  storage.set('kkm.save.3', JSON.stringify({ ...makeSave(2, 3), version: 9 }));
  expect(loadSlot(storage, 2)).toBeNull();
  expect(loadSlot(storage, 3)).toBeNull();
  expect(listSlots(storage).map((s) => s.slot)).toEqual([1]);
});

test('a save stored under the wrong slot key loads as that slot', () => {
  const storage = memoryStorage();
  storage.set('kkm.save.2', serialise(makeSave(4, 1)));
  expect(loadSlot(storage, 2)?.slot).toBe(2);
});

test('browserStorage with a throwing localStorage reports available=false and never throws', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  });
  const s = browserStorage();
  expect(s.available).toBe(false);
  expect(s.get('kkm.save.1')).toBeNull();
  expect(s.set('kkm.save.1', 'x')).toBe(false);
  expect(() => s.remove('kkm.save.1')).not.toThrow();
  expect(saveSlot(s, makeSave())).toBe(false);
  expect(listSlots(s)).toEqual([]);
});

test('browserStorage with a missing localStorage is unavailable too', () => {
  vi.stubGlobal('localStorage', undefined);
  expect(browserStorage().available).toBe(false);
});

test('browserStorage uses a working localStorage', () => {
  const map = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  });
  const s = browserStorage();
  expect(s.available).toBe(true);
  expect(saveSlot(s, makeSave())).toBe(true);
  expect(loadSlot(s, 1)?.state.day).toBe(4);
  expect([...map.keys()]).toEqual(['kkm.save.1']);
});

test('exportFileName', () => {
  expect(exportFileName(makeSave(4, 1))).toBe('kk-manager-slot1-day4.json');
});
