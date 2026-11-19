import type { DayPlan, GameData } from '../sim/index';

/** A free-play day type: what goes wrong (or doesn't) today. */
export interface Scenario {
  id: string;
  label: string;
  blurb: string;
  /** Takes a copy of the player's plan and returns the day's plan. */
  apply(plan: DayPlan, data: GameData): DayPlan;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'biasa',
    label: 'Hari biasa',
    blurb: 'A normal day. Nothing unusual planned.',
    apply: (plan) => plan,
  },
  {
    id: 'ccmsPagi',
    label: 'CCMS down pagi',
    blurb: 'CCMS is down from 08:00 to 10:00. Registration is slow and cannot see appointments.',
    apply: (plan) => ({ ...plan, events: [...plan.events, { kind: 'ccmsDown', from: 480, to: 600 }] }),
  },
  {
    id: 'printer',
    label: 'Printer buat hal',
    blurb: 'The printer is not connected from 09:00 to 12:00. Counters and pharmacy slow down.',
    apply: (plan) => ({ ...plan, events: [...plan.events, { kind: 'printerDown', from: 540, to: 720 }] }),
  },
  {
    id: 'basAsrama',
    label: 'Bas sekolah asrama',
    blurb: 'A boarding school bus brings 25 extra OPD patients at 10:00.',
    apply: (plan) => ({ ...plan, events: [...plan.events, { kind: 'influx', at: 600, count: 25, visitType: 'opd_general' }] }),
  },
  {
    id: 'kecemasan',
    label: 'Kes kecemasan',
    blurb: 'An emergency walks in at 10:30 and takes an OPD doctor for 30 to 45 minutes.',
    apply: (plan) => ({ ...plan, events: [...plan.events, { kind: 'emergencyWalkIn', at: 630, minutes: [30, 45] }] }),
  },
  {
    id: 'doktorEL',
    label: 'Doktor EL',
    blurb: 'Dr. Hafiz is on emergency leave. One MCH doctor seat is empty.',
    // On leave means not in any room, wherever the player had put them.
    apply: (plan) => ({
      ...plan,
      roster: Object.fromEntries(Object.entries(plan.roster).map(([station, ids]) => [station, ids.filter((id) => id !== 'mo2')])),
    }),
  },
];
