import { createController, type DayController } from '../game/controller';
import { IN_DAY_POPUPS, morningPopups, RELIEF_DOCTOR, type MorningPopup, type Popup } from '../popups/popups';
import type { DayPlan, GameData } from '../sim/index';
import { districtReview, type DistrictReview } from './district';
import { saveWeek } from './saves';
import type { SaveStorage } from './storage';
import type { WeekSave, WeekState } from './types';
import { createWeek, dayPlanFor, endDay, nextWeek, WEEK_DAYS } from './week';

export type WeekPhase = 'morning' | 'day' | 'report' | 'district';

export interface WeekController {
  readonly phase: WeekPhase;
  readonly state: WeekState;
  /** Set during the day and its report. */
  readonly day: DayController | null;
  /** Today's game data (with the relief doctor when one came). Stable for the whole day. */
  readonly data: GameData;
  /** The open morning popup, before the clinic opens. */
  readonly morning: Popup | null;
  readonly review: DistrictReview | null;
  /** False once storage refused a save; the game still plays. */
  readonly saveAvailable: boolean;
  answerMorning(choiceId: string): void;
  /** Report → the next morning, or the district visit after Jumaat. */
  continueAfterReport(): void;
  /** District visit → Isnin of the next week. */
  playAnotherWeek(): void;
  subscribe(listener: () => void): () => void;
}

function run(baseData: GameData, storage: SaveStorage, initial: WeekState, now: () => string): WeekController {
  let state = initial;
  let phase: WeekPhase = 'morning';
  let day: DayController | null = null;
  let offDay: (() => void) | null = null;
  let todayData = baseData;
  let morning: MorningPopup[] = [];
  let plan: DayPlan | null = null;
  let review: DistrictReview | null = null;
  let saveAvailable = storage.available;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const startDay = () => {
    const p = plan!;
    const withRelief = Object.values(p.roster).flat().includes(RELIEF_DOCTOR.id);
    todayData = withRelief ? { ...baseData, staff: [...baseData.staff, RELIEF_DOCTOR] } : baseData;
    day = createController(todayData, p.seed, { plan: p, day: state.day, flags: state.flags, popups: IN_DAY_POPUPS });
    // The day screens follow the day controller; the week only speaks up when the day ends.
    offDay = day.subscribe(() => {
      if (phase === 'day' && day?.phase === 'report') {
        phase = 'report';
        notify();
      }
    });
    phase = 'day';
    day.start();
  };

  const enterMorning = () => {
    phase = 'morning';
    day = null;
    todayData = baseData;
    if (!saveWeek(storage, { version: 2, savedAt: now(), state })) saveAvailable = false;
    plan = dayPlanFor(baseData, state);
    morning = morningPopups(state.day);
    if (morning.length === 0) startDay();
  };

  enterMorning();

  return {
    get phase() { return phase; },
    get state() { return state; },
    get day() { return day; },
    get data() { return todayData; },
    get morning() { return phase === 'morning' ? morning[0]?.popup ?? null : null; },
    get review() { return review; },
    get saveAvailable() { return saveAvailable; },
    answerMorning(choiceId) {
      const current = morning[0];
      if (phase !== 'morning' || !current || !current.popup.choices.some((c) => c.id === choiceId)) return;
      plan = current.plan(choiceId, plan!);
      morning = morning.slice(1);
      if (morning.length === 0) startDay();
      notify();
    },
    continueAfterReport() {
      if (phase !== 'report' || !day?.report) return;
      state = endDay(state, day.report, day.flags);
      offDay?.();
      offDay = null;
      if (state.day > WEEK_DAYS) {
        day = null;
        review = districtReview(state.history);
        phase = 'district';
      } else {
        enterMorning();
      }
      notify();
    },
    playAnotherWeek() {
      if (phase !== 'district') return;
      state = nextWeek(state);
      review = null;
      enterMorning();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function startWeek(data: GameData, storage: SaveStorage, seed: number, now: () => string): WeekController {
  return run(data, storage, createWeek(seed), now);
}

/** Always resumes at the morning of the saved day. */
export function resumeWeek(data: GameData, storage: SaveStorage, save: WeekSave, now: () => string): WeekController {
  return run(data, storage, structuredClone(save.state), now);
}
