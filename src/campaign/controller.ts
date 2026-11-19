import { createController, type DayController } from '../game/controller';
import type { GameData } from '../sim/index';
import { CAMPAIGN_DAYS, createCampaign, dayPlanFor, daySeed, endDay, rememberPlan, staffFor } from './campaign';
import { districtReview, type DistrictReview } from './district';
import { allAnswered, applyChoice, nightMessages } from './night';
import { exportFileName, saveSlot, serialise, type SaveStorage, type Slot } from './saves';
import type { CampaignState, SaveGame, Trainee } from './types';

export type CampaignPhase = 'night' | 'plan' | 'day' | 'report' | 'district';

export interface CampaignController {
  readonly phase: CampaignPhase;
  readonly state: CampaignState;
  readonly slot: Slot;
  /** Set in plan, day and report. */
  readonly day: DayController | null;
  /** Game data with today's staff (new doctor, relief). */
  readonly data: GameData;
  /** False once storage refused a save; the game still plays. */
  readonly saveAvailable: boolean;
  readonly review: DistrictReview | null;
  choose(messageId: string, choiceId: string): void;
  /** Night → plan, once every message is answered. */
  toPlan(): void;
  /** Plan phase only: the Pasangan Mentor card and who mentors whom. */
  setMentor(on: boolean, trainees: Trainee[]): void;
  continueAfterReport(): void;
  continueAfterDistrict(): void;
  exportSave(): { fileName: string; text: string };
  subscribe(listener: () => void): () => void;
}

function start(baseData: GameData, storage: SaveStorage, slot: Slot, initial: CampaignState, now: () => string): CampaignController {
  let state = initial;
  let phase: CampaignPhase = 'night';
  let day: DayController | null = null;
  let unsubscribeDay: (() => void) | null = null;
  let review: DistrictReview | null = null;
  let saveAvailable = storage.available;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const toSave = (): SaveGame => ({ version: 1, slot, savedAt: now(), state });
  const autosave = () => {
    if (!saveSlot(storage, toSave())) saveAvailable = false;
  };
  const enterNight = () => {
    phase = 'night';
    if (state.messages.length === 0) state = { ...state, messages: nightMessages(baseData, state, state.history.at(-1) ?? null) };
    autosave();
  };

  const onDay = () => {
    if (!day) return;
    const before = phase;
    if (phase === 'plan' && day.phase === 'running') {
      state = rememberPlan(state, day.plan);
      phase = 'day';
    }
    if (phase === 'day' && day.phase === 'report') phase = 'report';
    // The day screens follow the day controller themselves; stay quiet while the clock ticks.
    if (phase !== before || phase === 'plan') notify();
  };

  /** Today's game data, rebuilt only when the state changes (keeps the canvas layout cached). */
  let dataFor: CampaignState | null = null;
  let todayData: GameData = baseData;
  const currentData = () => {
    if (dataFor !== state) {
      todayData = staffFor(baseData, state);
      dataFor = state;
    }
    return todayData;
  };

  enterNight();

  return {
    get phase() { return phase; },
    get state() { return state; },
    get day() { return day; },
    get data() { return currentData(); },
    get saveAvailable() { return saveAvailable; },
    get review() { return review; },
    slot,
    choose(messageId, choiceId) {
      if (phase !== 'night') return;
      state = applyChoice(baseData, state, messageId, choiceId);
      notify();
    },
    toPlan() {
      if (phase !== 'night' || !allAnswered(state)) return;
      day = createController(staffFor(baseData, state), daySeed(state), { plan: dayPlanFor(baseData, state), scenarioId: 'biasa' });
      unsubscribeDay = day.subscribe(onDay);
      phase = 'plan';
      notify();
    },
    setMentor(on, trainees) {
      if (phase !== 'plan' || !day) return;
      state = { ...state, mentorCardOn: on, trainees: structuredClone(trainees) };
      // Keep the player's roster and cards; take tomorrow's seating and speeds from the new pairing.
      const fresh = dayPlanFor(baseData, state);
      const { extraSeats: _e, staffSpeed: _s, ...rest } = day.plan;
      day.setPlan({
        ...rest,
        ...(fresh.extraSeats ? { extraSeats: fresh.extraSeats } : {}),
        ...(fresh.staffSpeed ? { staffSpeed: fresh.staffSpeed } : {}),
      });
    },
    continueAfterReport() {
      if (phase !== 'report' || !day?.report || !day.dayPlan) return;
      const districtNext = state.mode === 'campaign' && state.day === CAMPAIGN_DAYS;
      state = endDay(baseData, state, day.report, day.dayPlan);
      unsubscribeDay?.();
      day = null;
      if (districtNext) {
        review = districtReview(state.history);
        phase = 'district';
        autosave();
      } else {
        enterNight();
      }
      notify();
    },
    continueAfterDistrict() {
      if (phase !== 'district') return;
      enterNight();
      notify();
    },
    exportSave() {
      const save = toSave();
      return { fileName: exportFileName(save), text: serialise(save) };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function newCampaign(data: GameData, storage: SaveStorage, slot: Slot, seed: number, now: () => string): CampaignController {
  return start(data, storage, slot, createCampaign(data, seed), now);
}

/** Resumes at the night the save was made (saves are only made at night). */
export function resumeCampaign(data: GameData, storage: SaveStorage, save: SaveGame, now: () => string): CampaignController {
  return start(data, storage, save.slot, structuredClone(save.state), now);
}
