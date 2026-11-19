import { loadWeek, parseWeekSave, saveWeek, WEEK_KEY } from '../../src/week/saves';
import { browserStorage, memoryStorage } from '../../src/week/storage';
import { createWeek, endDay } from '../../src/week/week';
import { fakeReport } from './helpers';

const save = () => ({ version: 2 as const, savedAt: '2026-11-19T21:00:00.000Z', state: endDay(createWeek(3), fakeReport(), { saringan: true, laluanKhas: false }) });
afterEach(() => vi.unstubAllGlobals());

test('saveWeek and loadWeek round-trip under kkm.week.easy', () => {
  const storage = memoryStorage();
  expect(loadWeek(storage)).toBeNull();
  expect(saveWeek(storage, save())).toBe(true);
  expect(WEEK_KEY).toBe('kkm.week.easy');
  expect(storage.get('kkm.week.easy')).not.toBeNull();
  expect(loadWeek(storage)).toEqual(save());
});

test('a v1 save under kkm.save.1 is ignored', () => {
  const storage = memoryStorage();
  storage.set('kkm.save.1', JSON.stringify({ version: 1, slot: 1, savedAt: 'x', state: {} }));
  expect(loadWeek(storage)).toBeNull();
});

test('a damaged or other-version week save loads as null, never throws', () => {
  const storage = memoryStorage();
  for (const bad of ['{nope', '42', JSON.stringify({ ...save(), version: 1 }), JSON.stringify({ ...save(), state: { ...save().state, day: 9 } }),
    JSON.stringify({ ...save(), state: { ...save().state, flags: null } }), JSON.stringify({ ...save(), state: { ...save().state, history: [{}] } })]) {
    storage.set(WEEK_KEY, bad);
    expect(loadWeek(storage)).toBeNull();
  }
  expect(parseWeekSave('{nope').ok).toBe(false);
});

test('browserStorage with a throwing localStorage is unavailable and never throws', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } });
  const s = browserStorage();
  expect(s.available).toBe(false);
  expect(saveWeek(s, save())).toBe(false);
  expect(loadWeek(s)).toBeNull();
});
