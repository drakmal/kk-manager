import type { SimOptions } from './engine';
import { createDaySim } from './events';
import { buildReport } from './scoring';
import type { DayPlan, DayReport, GameData } from './types';

/** Runs a whole clinic day headless and returns its report. Same data + plan → same report. */
export function runDay(data: GameData, plan: DayPlan, options: SimOptions = {}): DayReport {
  const sim = createDaySim(data, plan, options);
  while (!sim.isDone()) sim.step();
  return buildReport(sim, data, plan);
}
