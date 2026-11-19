import { createCampaign, dayPlanFor, endDay } from '../../src/campaign/campaign';
import { newCampaign, resumeCampaign, type CampaignController } from '../../src/campaign/controller';
import { loadSlot, memoryStorage, parseSave, type SaveStorage } from '../../src/campaign/saves';
import type { SaveGame } from '../../src/campaign/types';
import { createController } from '../../src/game/controller';
import { defaultDayPlan, loadGameData } from '../../src/sim/index';
import { fakeReport } from './helpers';

const data = loadGameData();
const now = () => '2026-11-19T21:00:00.000Z';
const answerAll = (c: CampaignController) => {
  for (const m of c.state.messages) if (!m.chosen) c.choose(m.id, m.choices.find((x) => !x.disabledReason)!.id);
};
const playDay = (c: CampaignController) => {
  answerAll(c);
  c.toPlan();
  c.day!.start();
  c.day!.finishNow();
};

test('createController accepts an initial plan', () => {
  const plan = { ...defaultDayPlan(data, 77), events: [{ kind: 'ccmsDown' as const, from: 480, to: 600 }] };
  const c = createController(data, 1, { plan, scenarioId: 'printer' });
  expect(c.plan).toEqual(plan);
  expect(c.scenarioId).toBe('printer');
  expect(createController(data, 5).plan.seed).toBe(5);
});

test('a new campaign starts at night with the tutorial message and autosaves', () => {
  const storage = memoryStorage();
  const c = newCampaign(data, storage, 2, 4, now);
  expect(c.phase).toBe('night');
  expect(c.slot).toBe(2);
  expect(c.day).toBeNull();
  expect(c.state.messages.map((m) => m.kind)).toEqual(['tutorial']);
  expect(loadSlot(storage, 2)).toEqual({ version: 1, slot: 2, savedAt: now(), state: c.state });
  expect(c.saveAvailable).toBe(true);
});

test('toPlan is blocked until all messages are answered', () => {
  const c = newCampaign(data, memoryStorage(), 1, 4, now);
  c.toPlan();
  expect(c.phase).toBe('night');
  answerAll(c);
  c.toPlan();
  expect(c.phase).toBe('plan');
  expect(c.day!.plan).toEqual(dayPlanFor(data, c.state));
  expect(c.day!.plan.seed).toBe(4001);
});

test('the plan → day → report → night cycle advances the day and saves', () => {
  const storage = memoryStorage();
  const c = newCampaign(data, storage, 1, 4, now);
  const seen: string[] = [];
  c.subscribe(() => seen.push(c.phase));
  answerAll(c);
  c.toPlan();
  const plan = structuredClone(c.day!.plan);
  plan.sop.saringan.bypass.anc_doctor_only = true;
  c.day!.setPlan(plan);
  c.day!.start();
  expect(c.phase).toBe('day');
  expect(c.state.sop.saringan.bypass.anc_doctor_only).toBe(true);
  c.day!.finishNow();
  expect(c.phase).toBe('report');
  c.continueAfterReport();
  expect(c.phase).toBe('night');
  expect(c.day).toBeNull();
  expect(c.state.day).toBe(2);
  expect(c.state.history).toHaveLength(1);
  expect(loadSlot(storage, 1)!.state.day).toBe(2);
  expect(loadSlot(storage, 1)!.state.sop.saringan.bypass.anc_doctor_only).toBe(true);
  expect(seen).toEqual(expect.arrayContaining(['plan', 'day', 'report', 'night']));
});

test('choices at night shape tomorrow (relief doctor is in the day data)', () => {
  let state = createCampaign(data, 4);
  while (state.day < 5) state = endDay(data, state, fakeReport(), dayPlanFor(data, state));
  const save: SaveGame = { version: 1, slot: 1, savedAt: now(), state };
  const c = resumeCampaign(data, memoryStorage(), save, now);
  const el = c.state.messages.find((m) => m.kind === 'el')!;
  c.choose(el.id, 'relief');
  expect(c.state.goodwill).toBe(state.goodwill - 20);
  answerAll(c);
  c.toPlan();
  expect(c.data.staff.map((p) => p.id)).toContain('relief1');
  expect(c.day!.plan.roster.mchDoctor).toContain('relief1');
  c.day!.start();
  expect(c.state.roster.mchDoctor).toEqual(['mo1', 'mo2']); // leave and relief are for one day only
});

test('day 10 → district → endless night 11', () => {
  let state = createCampaign(data, 4);
  while (state.day < 10) state = endDay(data, state, fakeReport(), dayPlanFor(data, state));
  const storage = memoryStorage();
  const c = resumeCampaign(data, storage, { version: 1, slot: 3, savedAt: now(), state }, now);
  playDay(c);
  c.continueAfterReport();
  expect(c.phase).toBe('district');
  expect(c.review!.grade).toMatch(/[ABCD]/);
  expect(c.state).toMatchObject({ day: 11, mode: 'endless' });
  c.continueAfterDistrict();
  expect(c.phase).toBe('night');
  expect(loadSlot(storage, 3)!.state).toMatchObject({ day: 11, mode: 'endless' });
  playDay(c);
  c.continueAfterReport();
  expect(c.phase).toBe('night'); // the district visit happens once
  expect(c.state.day).toBe(12);
});

test('resuming a save made at night 3 returns to night 3 with the same messages', () => {
  const storage = memoryStorage();
  const c = newCampaign(data, storage, 1, 6, now);
  playDay(c);
  c.continueAfterReport();
  playDay(c);
  c.continueAfterReport();
  expect(c.state.day).toBe(3);
  const messages = c.state.messages;
  const resumed = resumeCampaign(data, storage, loadSlot(storage, 1)!, now);
  expect(resumed.phase).toBe('night');
  expect(resumed.state.day).toBe(3);
  expect(resumed.state.messages).toEqual(messages);
});

test('with storage whose set fails, saveAvailable is false and play continues', () => {
  const failing: SaveStorage = { ...memoryStorage(), set: () => false };
  const c = newCampaign(data, failing, 1, 4, now);
  expect(c.saveAvailable).toBe(false);
  playDay(c);
  c.continueAfterReport();
  expect(c.state.day).toBe(2);
});

test('exportSave gives the file name and a parseable save', () => {
  const c = newCampaign(data, memoryStorage(), 1, 4, now);
  const out = c.exportSave();
  expect(out.fileName).toBe('kk-manager-slot1-day1.json');
  const parsed = parseSave(out.text, data);
  expect(parsed.ok && parsed.save.state).toEqual(c.state);
});

test('setMentor turns on Pasangan Mentor and re-pairs the trainee for tomorrow', () => {
  let state = createCampaign(data, 4);
  while (state.day < 4) state = endDay(data, state, fakeReport(), dayPlanFor(data, state));
  const c = resumeCampaign(data, memoryStorage(), { version: 1, slot: 1, savedAt: now(), state }, now);
  answerAll(c);
  c.toPlan();
  expect(c.day!.plan.staffSpeed?.mo1).toBeCloseTo(1.2);
  c.setMentor(true, [{ staffId: 'mo7', experience: 0, mentor: 'mo2' }]);
  expect(c.state.mentorCardOn).toBe(true);
  expect(c.day!.plan.staffSpeed?.mo2).toBeCloseTo(1.2);
  expect(c.day!.plan.staffSpeed?.mo1 ?? 1).toBe(1);
});

test('the campaign stays quiet while the day runs, and its day data keeps its identity', () => {
  const c = newCampaign(data, memoryStorage(), 1, 4, now);
  answerAll(c);
  c.toPlan();
  expect(c.data).toBe(c.data);
  c.day!.start();
  const dayData = c.data;
  let calls = 0;
  c.subscribe(() => calls++);
  c.day!.setSpeed(4);
  for (let i = 0; i < 20; i++) c.day!.frame(1000);
  expect(c.phase).toBe('day');
  expect(calls).toBe(0);
  expect(c.data).toBe(dayData);
  c.day!.finishNow();
  expect(calls).toBe(1);
  expect(c.phase).toBe('report');
});
