import { popupKey, sopWithFlags, type DayContext, type Popup, type PopupDef, type WeekFlags } from '../popups/popups';
import {
  buildReport,
  createDaySim,
  defaultDayPlan,
  type ClinicEvent,
  type DayPlan,
  type DayReport,
  type GameData,
  type Sim,
  type SopSettings,
  type StaffId,
  type StationId,
} from '../sim/index';
import { createClock, type GameClock, type Speed } from './clock';

export type Phase = 'plan' | 'running' | 'paused' | 'report';

export interface DayController {
  readonly phase: Phase;
  /** The plan the day starts from (roster, SOP, events). */
  readonly plan: DayPlan;
  /** The plan the clinic actually started with (flags applied). Null before the day starts. */
  readonly dayPlan: DayPlan | null;
  readonly sim: Sim | null;
  readonly report: DayReport | null;
  readonly clock: GameClock;
  /** The SOP the clinic is working to now. Null outside the day. */
  readonly liveSop: SopSettings | null;
  /** The open popup. The clock doesn't advance while one is open. */
  readonly popup: Popup | null;
  /** The week's standing choices, updated by popup answers. */
  readonly flags: WeekFlags;
  /** Who sits where right now. Empty outside the day. */
  liveRoster(): Record<StationId, StaffId[]>;
  setPlan(plan: DayPlan): void;
  start(): void;
  pause(): void;
  resume(): void;
  setSpeed(s: Speed): void;
  frame(dtMs: number): void;
  answer(choiceId: string): void;
  /** Runs to the next popup or the end of the day. Never answers a popup. */
  skipAhead(): void;
  subscribe(listener: () => void): () => void;
}

export interface ControllerInit {
  plan?: DayPlan;
  /** 1 = Isnin … 5 = Jumaat. */
  day?: number;
  flags?: WeekFlags;
  popups?: PopupDef[];
}

export function createController(data: GameData, seed: number, init: ControllerInit = {}): DayController {
  const day = init.day ?? 1;
  const defs = init.popups ?? [];
  let phase: Phase = 'plan';
  let plan: DayPlan = init.plan ? structuredClone(init.plan) : defaultDayPlan(data, seed);
  let flags: WeekFlags = { ...(init.flags ?? { saringan: false, laluanKhas: false }) };
  let dayPlan: DayPlan | null = null;
  let sim: Sim | null = null;
  let report: DayReport | null = null;
  let liveSop: SopSettings | null = null;
  let events: ClinicEvent[] = [];
  let queue: { def: PopupDef; popup: Popup }[] = [];
  const shown = new Set<string>();
  let dismissedIdle = false;
  const clock = createClock();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const context = (s: Sim): DayContext => ({ day, now: s.now, sim: s, data, flags, shown, dismissedIdle, events });

  /** Queues the popups due this minute. True when one is open. */
  const openDue = (): boolean => {
    if (queue.length > 0) return true;
    const ctx = context(sim!);
    for (const def of defs) {
      const key = popupKey(def.id, ctx.now);
      if (shown.has(key) || !def.due(ctx)) continue;
      shown.add(key);
      queue.push({ def, popup: def.build(ctx) });
    }
    return queue.length > 0;
  };

  const finish = () => {
    report = buildReport(sim!, data, dayPlan!);
    phase = 'report';
    clock.speed = 0;
    notify();
  };

  const quiet = (s: Sim) =>
    s.now >= 480 && !s.staff.some((p) => p.servingPatient !== null) && s.snapshot().waitingCount === 0;

  const running = () => (phase === 'running' || phase === 'paused') && sim !== null;

  return {
    get phase() { return phase; },
    get plan() { return plan; },
    get dayPlan() { return dayPlan; },
    get sim() { return sim; },
    get report() { return report; },
    get liveSop() { return liveSop; },
    get popup() { return queue[0]?.popup ?? null; },
    get flags() { return flags; },
    clock,
    liveRoster() {
      const out: Record<StationId, StaffId[]> = {};
      if (!sim) return out;
      for (const s of data.stations) out[s.id] = [];
      for (const s of sim.staff) if (s.station !== null) out[s.station]!.push(s.id);
      return out;
    },

    setPlan(next) {
      if (phase !== 'plan') throw new Error('The plan can only be changed before the day starts.');
      plan = structuredClone(next);
      notify();
    },
    start() {
      if (phase !== 'plan') throw new Error(`Cannot start the day from "${phase}"`);
      dayPlan = { ...structuredClone(plan), sop: sopWithFlags(plan.sop, flags) };
      sim = createDaySim(data, dayPlan);
      liveSop = structuredClone(dayPlan.sop);
      events = structuredClone(dayPlan.events);
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
      if (phase !== 'running' || !sim || queue.length > 0) return;
      const steps = clock.advance(dtMs, quiet(sim));
      let opened = false;
      for (let i = 0; i < steps && !sim.isDone(); i++) {
        if (openDue()) {
          opened = true;
          break;
        }
        sim.step();
      }
      if (sim.isDone()) finish();
      else if (steps > 0 || opened) notify();
    },
    answer(choiceId) {
      const current = queue[0];
      if (!current || !sim || !liveSop) return;
      const ctx = context(sim);
      const effect = current.def.effect(choiceId, ctx);
      queue = queue.slice(1);
      let sop = liveSop;
      if (effect.flags) {
        flags = { ...flags, ...effect.flags };
        sop = sopWithFlags(sop, flags);
      }
      if (effect.sopPatch) sop = { ...sop, ...structuredClone(effect.sopPatch) };
      if (sop !== liveSop) {
        sim.applyChange({ sop }, { immediate: true, free: true });
        liveSop = sop;
      }
      if (effect.change) {
        sim.applyChange(effect.change, { immediate: true, free: true });
        if (effect.change.events) events = structuredClone(effect.change.events);
      }
      if (effect.dismissIdle) dismissedIdle = true;
      notify();
    },
    skipAhead() {
      if (!running() || queue.length > 0) return;
      const s = sim!;
      while (!s.isDone()) {
        if (openDue()) {
          notify();
          return;
        }
        s.step();
      }
      finish();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
