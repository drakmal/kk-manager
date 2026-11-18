import { loadGameData } from '../../src/sim/data';
import { defaultDayPlan } from '../../src/sim/plan';
import type { DayPlan, GameData, Patient, PriorityGroup } from '../../src/sim/types';

/** Tiny clinic: a registration counter "a" (2 min) then a doctor room "b" (3 min), one seat each. */
export const fixtureData: GameData = {
  stations: [
    { id: 'a', unit: 'mch', label: 'Kaunter', role: 'clerk', seats: 1, minutes: [2, 2], opensAt: 480 },
    { id: 'b', unit: 'mch', label: 'Doktor', role: 'doctor', seats: 1, minutes: [3, 3], opensAt: 480 },
  ],
  visitTypes: [
    { id: 'v', unit: 'mch', label: 'Lawatan', share: 1, appointment: false, priority: [], steps: [{ station: 'a' }, { station: 'b' }] },
    { id: 'o', unit: 'opd', label: 'OPD', share: 1, appointment: false, priority: [], steps: [{ station: 'b' }] },
  ],
  staff: [
    { id: 'clerk1', name: 'Kak Ida', role: 'clerk', homeStation: 'a' },
    { id: 'doc1', name: 'Dr. Aina', role: 'doctor', homeStation: 'b' },
  ],
  arrivals: { dailyVolume: { mch: 0, opd: 0 }, hourlyShare: [{ from: 480, to: 481, share: 1 }] },
  tuning: loadGameData().tuning,
};

export const fixturePlan: DayPlan = defaultDayPlan(fixtureData, 1);

/** A scripted patient that walks the given stations with fixed durations. */
export function scripted(
  id: number,
  arrival: number,
  steps: [station: string, minutes: number][],
  priority: PriorityGroup[] = [],
): Patient {
  return {
    id,
    visitType: 'v',
    unit: 'mch',
    arrival,
    priority,
    colour: null,
    steps: steps.map(([station, minutes]) => ({ station, minutes, bypassable: false })),
    route: null,
    stepIndex: 0,
    waitMinutes: 0,
    crowdMinutes: 0,
    doneAt: null,
    turnedAway: false,
  };
}
