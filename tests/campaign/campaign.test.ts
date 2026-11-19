import {
  createCampaign, dayName, dayPlanFor, endDay, isUnlocked, rememberPlan, staffFor, CAMPAIGN_DAYS,
} from '../../src/campaign/campaign';
import type { CampaignState } from '../../src/campaign/types';
import { loadGameData } from '../../src/sim/index';
import { fakeReport } from './helpers';

const data = loadGameData();

/** Plays days with a fixed report until `state.day === day`. */
function advanceTo(state: CampaignState, day: number, report = fakeReport()): CampaignState {
  let s = state;
  while (s.day < day) s = endDay(data, s, report, dayPlanFor(data, s));
  return s;
}

test('a new campaign starts on day 1 with three cards and goodwill 60', () => {
  const s = createCampaign(data, 5);
  expect(s).toMatchObject({ version: 1, seed: 5, day: 1, mode: 'campaign', goodwill: 60, reliefsThisWeek: 0, history: [] });
  expect(s.unlocked).toEqual(['saringan', 'laluanKhas', 'pinjamDoktor']);
  expect(s.roster.mchDoctor).toEqual(['mo1', 'mo2']);
  expect(CAMPAIGN_DAYS).toBe(10);
});

test('dayName cycles Isnin..Jumaat', () => {
  expect([1, 2, 3, 4, 5, 6, 10, 11].map(dayName)).toEqual(['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Isnin', 'Jumaat', 'Isnin']);
});

test('dayPlanFor uses the schedule: day 3 has CCMS down 08:00–10:00, day 9 has CCMS and printer', () => {
  const s = createCampaign(data, 1);
  expect(dayPlanFor(data, s).events).toEqual([]);
  expect(dayPlanFor(data, { ...s, day: 3 }).events).toEqual([{ kind: 'ccmsDown', from: 480, to: 600 }]);
  expect(dayPlanFor(data, { ...s, day: 9 }).events.map((e) => e.kind)).toEqual(['ccmsDown', 'printerDown']);
  expect(dayPlanFor(data, { ...s, day: 6 }).events).toEqual([{ kind: 'influx', at: 600, count: 25, visitType: 'opd_general' }]);
  expect(dayPlanFor(data, s).seed).toBe(1001);
});

test('tomorrow’s events, leave and relief are applied to the day plan', () => {
  const s = createCampaign(data, 1);
  s.tomorrow = {
    events: [{ kind: 'staffAway', staffId: 'pt1', from: 540, to: 570 }],
    away: ['mo2'],
    relief: { staffId: 'relief1', station: 'mchDoctor' },
    moves: [],
  };
  const plan = dayPlanFor(data, s);
  expect(plan.roster.mchDoctor).toEqual(['mo1', 'relief1']);
  expect(plan.events).toContainEqual({ kind: 'staffAway', staffId: 'pt1', from: 540, to: 570 });
  expect(staffFor(data, s).staff.map((p) => p.id)).toContain('relief1');
});

test('locked cards are forced off in the day plan', () => {
  const s = createCampaign(data, 1);
  s.sop.temujanji.enabled = true;
  s.sop.kontingensiCcms.printedList = true;
  s.sop.saringan.bypass.anc_doctor_only = true;
  const plan = dayPlanFor(data, s);
  expect(plan.sop.temujanji.enabled).toBe(false);
  expect(plan.sop.kontingensiCcms.printedList).toBe(false);
  expect(plan.sop.saringan.bypass.anc_doctor_only).toBe(true); // saringan is unlocked
  expect(dayPlanFor(data, { ...s, unlocked: [] }).sop.saringan.bypass.anc_doctor_only).toBe(false);
});

test('endDay records the summary, adds goodwill and advances the day', () => {
  const s = createCampaign(data, 1);
  const next = endDay(data, s, fakeReport({ patientSatisfaction: 61.5, docOnly: 33 }), dayPlanFor(data, s));
  expect(next.day).toBe(2);
  expect(next.goodwill).toBe(65);
  expect(next.history).toEqual([{
    day: 1, patient: 61.5, hcw: 75, lunch: 'onTime', balik: 'onTime', overtime: 0, docOnlyWait: 33, peakQueue: 10, ccms: false,
  }]);
  expect(s.day).toBe(1); // not mutated
  expect(endDay(data, { ...s, goodwill: 98 }, fakeReport(), dayPlanFor(data, s)).goodwill).toBe(100);
});

test('temujanji unlocks after a crowded day; kontingensi after the first CCMS day', () => {
  const s = createCampaign(data, 1);
  const crowded = endDay(data, s, fakeReport({ peak: 30 }), dayPlanFor(data, s));
  expect(isUnlocked(crowded, 'temujanji')).toBe(true);
  expect(crowded.justUnlocked).toEqual(['temujanji']);
  const calm = endDay(data, s, fakeReport({ peak: 29 }), dayPlanFor(data, s));
  expect(isUnlocked(calm, 'temujanji')).toBe(false);
  const day3 = advanceTo(createCampaign(data, 1), 3);
  expect(isUnlocked(day3, 'kontingensiCcms')).toBe(false);
  const day4 = endDay(data, day3, fakeReport(), dayPlanFor(data, day3));
  expect(isUnlocked(day4, 'kontingensiCcms')).toBe(true);
  expect(day4.justUnlocked).toEqual(['kontingensiCcms', 'pasanganMentor']);
  const day5 = endDay(data, day4, fakeReport(), dayPlanFor(data, day4));
  expect(day5.justUnlocked).toEqual([]);
});

test('day 4 brings Dr. Amir as a trainee with an extra seat and slower times; mentor slowed ×1.2', () => {
  const s = advanceTo(createCampaign(data, 1), 4);
  expect(s.extraStaff).toEqual([{ id: 'mo7', name: 'Dr. Amir (MO baru)', role: 'doctor', homeStation: 'mchDoctor' }]);
  expect(s.trainees).toEqual([{ staffId: 'mo7', experience: 0, mentor: 'mo1' }]);
  const plan = dayPlanFor(data, s);
  expect(plan.extraSeats).toEqual({ mchDoctor: ['mo7'] });
  expect(plan.staffSpeed?.mo7).toBeCloseTo(1.8);
  expect(plan.staffSpeed?.mo1).toBeCloseTo(1.2);
  expect(plan.staffSpeed?.mo2 ?? 1).toBe(1);
  expect(staffFor(data, s).staff.map((p) => p.id)).toContain('mo7');
});

test('a trainee whose mentor is on leave has no mentor slowdown and sits in their home room', () => {
  const s = advanceTo(createCampaign(data, 1), 4);
  s.tomorrow.away = ['mo1'];
  const plan = dayPlanFor(data, s);
  expect(plan.extraSeats).toEqual({ mchDoctor: ['mo7'] });
  expect(plan.staffSpeed?.mo1 ?? 1).toBe(1);
});

test('a trainee with 6 experience becomes a normal MO', () => {
  const s = advanceTo(createCampaign(data, 1), 4);
  s.trainees[0]!.experience = 5;
  const next = endDay(data, s, fakeReport(), dayPlanFor(data, s));
  expect(next.trainees).toEqual([]);
  expect(next.extraStaff.map((p) => p.id)).toEqual(['mo7']);
  const plan = dayPlanFor(data, next);
  expect(plan.extraSeats ?? {}).toEqual({});
  expect(plan.staffSpeed?.mo7 ?? 1).toBe(1);
  expect(plan.staffSpeed?.mo1 ?? 1).toBe(1);
});

test('trainee speed improves with experience: max(1, 1.8 − 0.1 × experience)', () => {
  const s = advanceTo(createCampaign(data, 1), 4);
  s.trainees[0]!.experience = 3;
  expect(dayPlanFor(data, s).staffSpeed?.mo7).toBeCloseTo(1.5);
});

test('Pasangan Mentor speeds learning to 1.5 per day', () => {
  const s = advanceTo(createCampaign(data, 1), 4);
  const without = endDay(data, s, fakeReport(), dayPlanFor(data, s));
  expect(without.trainees[0]!.experience).toBe(1);
  const withCard = endDay(data, { ...s, mentorCardOn: true }, fakeReport(), dayPlanFor(data, s));
  expect(withCard.trainees[0]!.experience).toBe(1.5);
  const noMentor = { ...s, mentorCardOn: true, trainees: [{ staffId: 'mo7', experience: 0, mentor: null }] };
  expect(endDay(data, noMentor, fakeReport(), dayPlanFor(data, noMentor)).trainees[0]!.experience).toBe(1);
});

test('a day with HCW satisfaction under 50 slows everyone ×1.1 the next day', () => {
  const s = createCampaign(data, 1);
  const tired = endDay(data, s, fakeReport({ hcwSatisfaction: 49 }), dayPlanFor(data, s));
  const plan = dayPlanFor(data, tired);
  for (const p of data.staff) expect(plan.staffSpeed?.[p.id]).toBeCloseTo(1.1);
  const fine = endDay(data, s, fakeReport({ hcwSatisfaction: 50 }), dayPlanFor(data, s));
  expect(dayPlanFor(data, fine).staffSpeed ?? {}).toEqual({});
});

test('reliefs this week reset when a new week starts on day 6', () => {
  const s = advanceTo(createCampaign(data, 1), 5);
  const d5 = { ...s, reliefsThisWeek: 2 };
  const d6 = endDay(data, d5, fakeReport(), dayPlanFor(data, d5));
  expect(d6.reliefsThisWeek).toBe(0);
  const d3 = advanceTo(createCampaign(data, 1), 3);
  expect(endDay(data, { ...d3, reliefsThisWeek: 1 }, fakeReport(), dayPlanFor(data, d3)).reliefsThisWeek).toBe(1);
});

test('rememberPlan keeps the player’s choices but undoes one-day leave, relief and moves', () => {
  const s = createCampaign(data, 1);
  s.tomorrow = { events: [], away: ['mo2'], relief: null, moves: [{ staffId: 'mo3', from: 'opdDoctor', to: 'mchDoctor' }] };
  const plan = dayPlanFor(data, s);
  expect(plan.roster.mchDoctor).toEqual(['mo1', 'mo3']);
  plan.sop.saringan.bypass.anc_doctor_only = true;
  const kept = rememberPlan(s, plan);
  expect(kept.sop.saringan.bypass.anc_doctor_only).toBe(true);
  expect(kept.roster.mchDoctor).toEqual(['mo1', 'mo2']);
  expect(kept.roster.opdDoctor).toEqual(['mo3', 'mo4', 'mo5', 'mo6']);

  const r = createCampaign(data, 1);
  r.tomorrow = { events: [], away: ['mo2'], relief: { staffId: 'relief1', station: 'mchDoctor' }, moves: [] };
  expect(rememberPlan(r, dayPlanFor(data, r)).roster.mchDoctor).toEqual(['mo1', 'mo2']);
});

test('after day 10 the mode becomes endless and days keep counting', () => {
  const s = advanceTo(createCampaign(data, 1), 10);
  expect(s.mode).toBe('campaign');
  const e = endDay(data, s, fakeReport(), dayPlanFor(data, s));
  expect(e).toMatchObject({ day: 11, mode: 'endless' });
  const kinds = new Set<string>();
  let x = e;
  for (let i = 0; i < 15; i++) {
    const plan = dayPlanFor(data, x);
    expect(dayPlanFor(data, x)).toEqual(plan); // deterministic
    for (const ev of plan.events) kinds.add(ev.kind);
    x = endDay(data, x, fakeReport(), plan);
  }
  expect(x.day).toBe(26);
  expect(kinds.size).toBeGreaterThan(1);
});

test('everything in the state survives JSON round-trip', () => {
  const s = advanceTo(createCampaign(data, 1), 5);
  expect(JSON.parse(JSON.stringify(s))).toEqual(s);
});
