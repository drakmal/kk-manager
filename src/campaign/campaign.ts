import { SCENARIOS } from '../game/scenarios';
import { createRng, defaultDayPlan, type DayPlan, type DayReport, type GameData, type SopSettings, type StaffDef, type StaffId, type StationId } from '../sim/index';
import type { CampaignState, CardId, DaySummary, Tomorrow } from './types';

// Tuning placeholders (also listed on the sheet's Tuning tab, "Campaign" group).
export const CAMPAIGN_DAYS = 10;
export const GOODWILL_START = 60;
export const GOODWILL_RECOVERY = 5;
export const GOODWILL_MAX = 100;
export const RELIEF_COST = 20;
export const RELIEF_LIMIT = 2;
export const TRAINEE_START_FACTOR = 1.8;
export const TRAINEE_FACTOR_STEP = 0.1;
export const MENTOR_FACTOR = 1.2;
export const INDEPENDENT_AT = 6;
export const LEARN_PER_DAY = 1;
export const LEARN_WITH_MENTOR = 1.5;
export const LOW_MORALE_HCW = 50;
export const LOW_MORALE_FACTOR = 1.1;
export const CROWDED_PEAK = 30;
export const NEW_DOCTOR_DAY = 4;

export const DAY_NAMES = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat'];
export const STARTING_CARDS: CardId[] = ['saringan', 'laluanKhas', 'pinjamDoktor'];

export const NEW_DOCTOR: StaffDef = { id: 'mo7', name: 'Dr. Amir (MO baru)', role: 'doctor', homeStation: 'mchDoctor' };
export const RELIEF_DOCTOR: Omit<StaffDef, 'homeStation'> = { id: 'relief1', name: 'Dr. Relief (KK Seri Melur)', role: 'doctor' };

/** Scenario ids per campaign day (index 0 = day 1). */
const SCHEDULE: string[][] = [
  ['biasa'], ['biasa'], ['ccmsPagi'], ['biasa'], ['printer'],
  ['basAsrama'], ['kecemasan'], ['biasa'], ['ccmsPagi', 'printer'], ['biasa'],
];
const ENDLESS_POOL = SCENARIOS.filter((s) => s.id !== 'doktorEL').map((s) => s.id);

export const dayName = (day: number): string => DAY_NAMES[(day - 1) % DAY_NAMES.length]!;
export const isUnlocked = (state: CampaignState, card: CardId): boolean => state.unlocked.includes(card);
/** The seed for anything random about this day or the night before it. */
export const daySeed = (state: CampaignState): number => state.seed * 1000 + state.day;

const emptyTomorrow = (): Tomorrow => ({ events: [], away: [], relief: null, moves: [] });

export function createCampaign(data: GameData, seed: number): CampaignState {
  const base = defaultDayPlan(data, seed);
  return {
    version: 1,
    seed,
    day: 1,
    mode: 'campaign',
    roster: base.roster,
    sop: base.sop,
    unlocked: [...STARTING_CARDS],
    justUnlocked: [],
    goodwill: GOODWILL_START,
    reliefsThisWeek: 0,
    trainees: [],
    mentorCardOn: false,
    extraStaff: [],
    tomorrow: emptyTomorrow(),
    messages: [],
    history: [],
  };
}

/** The scenario ids that shape this day. */
export function scheduleFor(state: CampaignState): string[] {
  if (state.mode === 'campaign' && state.day <= CAMPAIGN_DAYS) return SCHEDULE[state.day - 1]!;
  return [createRng(daySeed(state)).pick(ENDLESS_POOL)];
}

/** Game data with everyone who works here today: campaign joiners and tomorrow's relief doctor. */
export function staffFor(data: GameData, state: CampaignState): GameData {
  const staff = [...data.staff, ...state.extraStaff];
  const relief = state.tomorrow.relief;
  if (relief) staff.push({ ...RELIEF_DOCTOR, id: relief.staffId, homeStation: relief.station });
  return { ...data, staff };
}

/** Settings of locked cards are forced off, so an imported save can't use a card early. */
function lockedOff(state: CampaignState, sopIn: SopSettings): SopSettings {
  const sop = structuredClone(sopIn);
  if (!isUnlocked(state, 'saringan')) for (const id of Object.keys(sop.saringan.bypass)) sop.saringan.bypass[id] = false;
  if (!isUnlocked(state, 'laluanKhas')) sop.laluanKhas.enabled = false;
  if (!isUnlocked(state, 'pinjamDoktor')) sop.pinjamDoktor.enabled = false;
  if (!isUnlocked(state, 'temujanji')) sop.temujanji.enabled = false;
  if (!isUnlocked(state, 'kontingensiCcms')) sop.kontingensiCcms.printedList = false;
  return sop;
}

const stationOf = (roster: Record<StationId, StaffId[]>, id: StaffId): StationId | null =>
  Object.keys(roster).find((st) => roster[st]!.includes(id)) ?? null;

export function dayPlanFor(data: GameData, state: CampaignState): DayPlan {
  const today = staffFor(data, state);
  let plan: DayPlan = { ...defaultDayPlan(today, daySeed(state)), sop: lockedOff(state, state.sop) };

  // Roster: today's choices, minus leave, plus one-day moves and relief.
  const away = new Set(state.tomorrow.away);
  const roster: Record<StationId, StaffId[]> = {};
  for (const st of Object.keys(plan.roster)) roster[st] = (state.roster[st] ?? []).filter((id) => !away.has(id));
  for (const m of state.tomorrow.moves) {
    if (away.has(m.staffId)) continue;
    for (const st of Object.keys(roster)) roster[st] = roster[st]!.filter((id) => id !== m.staffId);
    roster[m.to]!.push(m.staffId);
  }
  if (state.tomorrow.relief) roster[state.tomorrow.relief.station]!.push(state.tomorrow.relief.staffId);
  plan.roster = roster;

  for (const id of scheduleFor(state)) plan = SCENARIOS.find((s) => s.id === id)!.apply(plan, today);
  plan.events = [...plan.events, ...structuredClone(state.tomorrow.events)];

  // Trainees sit beside their mentor; both are slower while paired.
  const speed: Record<StaffId, number> = {};
  const extraSeats: Record<StationId, StaffId[]> = {};
  for (const t of state.trainees) {
    const mentorAt = t.mentor ? stationOf(roster, t.mentor) : null;
    const home = today.staff.find((p) => p.id === t.staffId)?.homeStation ?? 'mchDoctor';
    const station = mentorAt ?? home;
    (extraSeats[station] ??= []).push(t.staffId);
    speed[t.staffId] = Math.max(1, TRAINEE_START_FACTOR - TRAINEE_FACTOR_STEP * t.experience);
    if (mentorAt && t.mentor) speed[t.mentor] = MENTOR_FACTOR;
  }
  const last = state.history[state.history.length - 1];
  if (last && last.hcw < LOW_MORALE_HCW) {
    for (const p of today.staff) speed[p.id] = (speed[p.id] ?? 1) * LOW_MORALE_FACTOR;
  }
  if (Object.keys(extraSeats).length > 0) plan.extraSeats = extraSeats;
  if (Object.keys(speed).length > 0) plan.staffSpeed = speed;
  return plan;
}

/**
 * Keeps the roster and SOP the player chose on the plan screen, minus today's
 * one-off changes: leave, relief and borrowed seats go back to normal.
 */
export function rememberPlan(state: CampaignState, plan: DayPlan): CampaignState {
  const roster = structuredClone(plan.roster);
  /** Puts someone back where they were last night, in the same position. */
  const restore = (id: StaffId) => {
    const was = stationOf(state.roster, id);
    if (!was) return;
    const list = (roster[was] ??= []);
    list.splice(Math.min(state.roster[was]!.indexOf(id), list.length), 0, id);
  };
  const relief = state.tomorrow.relief?.staffId;
  for (const st of Object.keys(roster)) roster[st] = roster[st]!.filter((id) => id !== relief);
  for (const m of state.tomorrow.moves) {
    if (!roster[m.to]?.includes(m.staffId)) continue;
    roster[m.to] = roster[m.to]!.filter((id) => id !== m.staffId);
    restore(m.staffId);
  }
  for (const id of state.tomorrow.away) if (!stationOf(roster, id)) restore(id);
  return { ...structuredClone(state), roster, sop: structuredClone(plan.sop) };
}

function summarise(state: CampaignState, report: DayReport, plan: DayPlan): DaySummary {
  return {
    day: state.day,
    patient: report.patientSatisfaction,
    hcw: report.hcwSatisfaction,
    lunch: report.lunch.outcome,
    balik: report.balik.outcome,
    overtime: report.balik.overtimeMinutes,
    docOnlyWait: report.waitByVisitType.anc_doctor_only?.mean ?? 0,
    peakQueue: Math.max(0, ...Object.values(report.peakQueue).map((p) => p.size)),
    ccms: plan.events.some((e) => e.kind === 'ccmsDown'),
  };
}

/** Folds a played day into the campaign and moves to the night before the next one. */
export function endDay(_data: GameData, stateIn: CampaignState, report: DayReport, plan: DayPlan): CampaignState {
  const state = structuredClone(stateIn);
  const summary = summarise(state, report, plan);
  const justUnlocked: CardId[] = [];
  const unlock = (card: CardId) => {
    if (state.unlocked.includes(card)) return;
    state.unlocked.push(card);
    justUnlocked.push(card);
  };

  const trainees = state.trainees
    .map((t) => ({ ...t, experience: t.experience + (state.mentorCardOn && t.mentor ? LEARN_WITH_MENTOR : LEARN_PER_DAY) }))
    .filter((t) => t.experience < INDEPENDENT_AT);

  if (summary.peakQueue >= CROWDED_PEAK) unlock('temujanji');
  if (summary.ccms) unlock('kontingensiCcms');

  const day = state.day + 1;
  if (day === NEW_DOCTOR_DAY && !state.extraStaff.some((p) => p.id === NEW_DOCTOR.id)) {
    state.extraStaff.push({ ...NEW_DOCTOR });
    trainees.push({ staffId: NEW_DOCTOR.id, experience: 0, mentor: state.roster.mchDoctor?.[0] ?? null });
    unlock('pasanganMentor');
  }

  return {
    ...state,
    day,
    mode: state.mode === 'campaign' && state.day >= CAMPAIGN_DAYS ? 'endless' : state.mode,
    justUnlocked,
    goodwill: Math.min(GOODWILL_MAX, state.goodwill + GOODWILL_RECOVERY),
    reliefsThisWeek: (day - 1) % DAY_NAMES.length === 0 ? 0 : state.reliefsThisWeek,
    trainees,
    tomorrow: emptyTomorrow(),
    messages: [],
    history: [...state.history, summary],
  };
}
