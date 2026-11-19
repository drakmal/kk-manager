import {
  buildReport,
  createDaySim,
  defaultDayPlan,
  type DayPlan,
  type DayReport,
  type GameData,
  type Minute,
  type PlanChange,
  type Sim,
  type SopSettings,
  type StaffId,
  type StationId,
} from '../sim/index';
import { createClock, type GameClock, type Speed } from './clock';
import { SCENARIOS } from './scenarios';

export type Phase = 'plan' | 'running' | 'paused' | 'report';

export interface DayController {
  readonly phase: Phase;
  /** The player's plan (roster and SOP cards). */
  readonly plan: DayPlan;
  /** Today's plan after the day type was applied (events, leave). Null before the day starts. */
  readonly dayPlan: DayPlan | null;
  readonly scenarioId: string;
  readonly sim: Sim | null;
  readonly report: DayReport | null;
  readonly clock: GameClock;
  /** The SOP the clinic is working to now, including changes still being briefed. Null outside the day. */
  readonly liveSop: SopSettings | null;
  /** Who sits where right now. Empty outside the day. */
  liveRoster(): Record<StationId, StaffId[]>;
  setPlan(plan: DayPlan): void;
  setScenario(id: string): void;
  start(): void;
  pause(): void;
  resume(): void;
  setSpeed(s: Speed): void;
  frame(dtMs: number): void;
  applyChange(change: PlanChange): { effectiveAt: Minute };
  finishNow(): void;
  replay(): void;
  newDay(): void;
  subscribe(listener: () => void): () => void;
}

/** Starting plan and day type; the campaign passes tomorrow's plan here. */
export interface ControllerInit {
  plan?: DayPlan;
  scenarioId?: string;
}

export function createController(data: GameData, seed: number, init: ControllerInit = {}): DayController {
  let phase: Phase = 'plan';
  let plan: DayPlan = init.plan ? structuredClone(init.plan) : defaultDayPlan(data, seed);
  let dayPlan: DayPlan | null = null;
  let scenarioId = init.scenarioId ?? 'biasa';
  let sim: Sim | null = null;
  let report: DayReport | null = null;
  let liveSop: SopSettings | null = null;
  /** The last roster the player asked for mid-day; staff move to it between patients. */
  let requestedRoster: Record<StationId, StaffId[]> | null = null;
  const clock = createClock();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const finish = () => {
    report = buildReport(sim!, data, dayPlan!);
    phase = 'report';
    clock.speed = 0;
    notify();
  };

  const quiet = (s: Sim) =>
    s.now >= 480 && !s.staff.some((p) => p.servingPatient !== null) && s.snapshot().waitingCount === 0;

  const backToPlan = (nextSeed: number) => {
    plan = { ...plan, seed: nextSeed };
    sim = null;
    dayPlan = null;
    liveSop = null;
    requestedRoster = null;
    report = null;
    phase = 'plan';
    clock.speed = 0;
    notify();
  };

  return {
    get phase() { return phase; },
    get plan() { return plan; },
    get dayPlan() { return dayPlan; },
    get scenarioId() { return scenarioId; },
    get sim() { return sim; },
    get report() { return report; },
    get liveSop() { return liveSop; },
    clock,
    liveRoster() {
      const out: Record<StationId, StaffId[]> = {};
      if (!sim) return out;
      for (const s of data.stations) out[s.id] = [];
      for (const s of sim.staff) if (s.station !== null) out[s.station]!.push(s.id);
      // A change still being briefed (or waiting for someone to finish a patient) is what the clinic is moving to.
      if (requestedRoster) for (const [station, ids] of Object.entries(requestedRoster)) out[station] = [...ids];
      return out;
    },

    setPlan(next) {
      if (phase !== 'plan') throw new Error('The plan can only be changed before the day starts. Pause and apply a change instead.');
      plan = structuredClone(next);
      notify();
    },
    setScenario(id) {
      if (!SCENARIOS.some((s) => s.id === id)) throw new Error(`Unknown day type "${id}"`);
      scenarioId = id;
      notify();
    },
    start() {
      if (phase !== 'plan') throw new Error(`Cannot start the day from "${phase}"`);
      const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
      dayPlan = scenario.apply(structuredClone(plan), data);
      sim = createDaySim(data, dayPlan);
      liveSop = structuredClone(dayPlan.sop);
      clock.speed = 1;
      phase = 'running';
      notify();
    },
    pause() {
      if (phase !== 'running') return;
      phase = 'paused';
      notify();
    },
    resume() {
      if (phase !== 'paused') return;
      phase = 'running';
      notify();
    },
    setSpeed(s) {
      clock.speed = s;
      notify();
    },
    frame(dtMs) {
      if (phase !== 'running' || !sim) return;
      const steps = clock.advance(dtMs, quiet(sim));
      for (let i = 0; i < steps && !sim.isDone(); i++) sim.step();
      if (sim.isDone()) finish();
      else if (steps > 0) notify();
    },
    applyChange(change) {
      if ((phase !== 'running' && phase !== 'paused') || !sim) {
        throw new Error('Changes can only be applied during the clinic day.');
      }
      const result = sim.applyChange(change);
      if (change.sop) liveSop = structuredClone(change.sop);
      if (change.roster) requestedRoster = { ...(requestedRoster ?? {}), ...structuredClone(change.roster) };
      notify();
      return result;
    },
    finishNow() {
      if ((phase !== 'running' && phase !== 'paused') || !sim) return;
      while (!sim.isDone()) sim.step();
      finish();
    },
    replay() {
      backToPlan(plan.seed);
    },
    newDay() {
      backToPlan(plan.seed + 1);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
