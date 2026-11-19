import { resumeWeek, startWeek, type WeekController } from '../../src/week/controller';
import { loadWeek } from '../../src/week/saves';
import { memoryStorage, type SaveStorage } from '../../src/week/storage';
import { loadGameData } from '../../src/sim/index';

const data = loadGameData();
const now = () => '2026-11-19T21:00:00.000Z';

/** Plays the open day to its report, answering each popup with its first choice. */
function playDay(w: WeekController) {
  while (w.phase === 'morning' && w.morning) w.answerMorning(w.morning.choices[0]!.id);
  const d = w.day!;
  while (d.phase !== 'report') {
    d.skipAhead();
    if (d.popup) d.answer(d.popup.choices[0]!.id);
  }
}

test('a new week opens on Isnin, starts the day and autosaves', () => {
  const storage = memoryStorage();
  const w = startWeek(data, storage, 7, now);
  expect(w.state.day).toBe(1);
  expect(w.phase).toBe('day');
  expect(w.morning).toBeNull();
  expect(w.day!.phase).toBe('running');
  expect(loadWeek(storage)!.state).toEqual(w.state);
});

test('the week loop runs morning → day → report to the district visit after Jumaat, then another week', () => {
  const storage = memoryStorage();
  const w = startWeek(data, storage, 7, now);
  const days: string[] = [];
  for (let i = 1; i <= 5; i++) {
    expect(w.state.day).toBe(i);
    playDay(w);
    expect(w.phase).toBe('report');
    days.push(String(w.state.day));
    w.continueAfterReport();
  }
  expect(w.phase).toBe('district');
  expect(w.review!.grade).toMatch(/^[ABCD]$/);
  expect(w.state.history).toHaveLength(5);
  w.playAnotherWeek();
  expect(w.state).toMatchObject({ week: 2, day: 1 });
  expect(w.phase).toBe('day');
  expect(loadWeek(storage)!.state.week).toBe(2);
});

test('Khamis morning asks about the EL before the clinic opens; relief puts relief1 in the MCH room', () => {
  const storage = memoryStorage();
  const w = startWeek(data, storage, 7, now);
  for (let i = 1; i <= 3; i++) {
    playDay(w);
    w.continueAfterReport();
  }
  expect(w.state.day).toBe(4);
  expect(w.phase).toBe('morning');
  expect(w.day).toBeNull();
  expect(w.morning!.text).toBe('Dr, saya demam, esok nak EL 🙏');
  w.answerMorning('relief');
  expect(w.phase).toBe('day');
  expect(w.day!.dayPlan!.roster.mchDoctor).toEqual(['mo1', 'relief1']);
  expect(w.data.staff.map((p) => p.id)).toContain('relief1');
});

test('flags chosen on Isnin carry to the next days', () => {
  const w = startWeek(data, memoryStorage(), 7, now);
  playDay(w); // the first choice of the idle popup is Saringan
  expect(w.day!.flags.saringan).toBe(true);
  w.continueAfterReport();
  expect(w.state.flags.saringan).toBe(true);
  expect(w.day!.dayPlan!.sop.saringan.bypass.anc_doctor_only).toBe(true);
});

test('resuming a save made on Rabu opens Rabu morning with the flags kept', () => {
  const storage = memoryStorage();
  const w = startWeek(data, storage, 7, now);
  playDay(w);
  w.continueAfterReport();
  playDay(w);
  w.continueAfterReport();
  expect(w.state.day).toBe(3);
  const resumed = resumeWeek(data, storage, loadWeek(storage)!, now);
  expect(resumed.state.day).toBe(3);
  expect(resumed.state.flags).toEqual(w.state.flags);
  expect(resumed.day!.sim!.now).toBe(420); // the start of the day, not mid-day
});

test('storage that fails gives saveAvailable false and play goes on', () => {
  const failing: SaveStorage = { ...memoryStorage(), set: () => false };
  const w = startWeek(data, failing, 7, now);
  expect(w.saveAvailable).toBe(false);
  playDay(w);
  w.continueAfterReport();
  expect(w.state.day).toBe(2);
});

test('the week stays quiet while the day ticks, and today’s data keeps its identity', () => {
  const w = startWeek(data, memoryStorage(), 7, now);
  const before = w.data;
  let calls = 0;
  w.subscribe(() => calls++);
  w.day!.setSpeed(4);
  for (let i = 0; i < 10; i++) w.day!.frame(1000);
  expect(calls).toBe(0);
  expect(w.data).toBe(before);
});
