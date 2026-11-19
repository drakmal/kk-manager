import { emergencyDoctor } from '../sim/index';
import type { ClinicEvent, DayPlan, GameData, Minute, PlanChange, Sim, SopSettings, StaffDef, StationId } from '../sim/index';

export interface Choice { id: string; label: string }
/** A popup interrupts the day. News has a single "OK". */
export interface Popup { id: string; from: string; text: string; choices: Choice[] }
/** Choices that stay on for the rest of the week. */
export interface WeekFlags { saringan: boolean; laluanKhas: boolean }

export interface DayContext {
  /** 1 = Isnin … 5 = Jumaat. */
  day: number;
  now: Minute;
  sim: Sim;
  data: GameData;
  flags: WeekFlags;
  /** Keys (popupKey) of popups already shown today. */
  shown: Set<string>;
  /** The player chose "Ikut giliran biasa" today. */
  dismissedIdle: boolean;
  /** The day's events as they stand now. */
  events: ClinicEvent[];
}

export interface Effect {
  change?: PlanChange;
  flags?: Partial<WeekFlags>;
  /** Merged into the clinic's current SOP. */
  sopPatch?: Partial<SopSettings>;
  dismissIdle?: boolean;
}

export interface PopupDef {
  id: string;
  /** Checked once per simulated minute, before the step. */
  due(ctx: DayContext): boolean;
  build(ctx: DayContext): Popup;
  effect(choiceId: string, ctx: DayContext): Effect;
}

export const popupKey = (id: string, now: Minute) => `${id}@${now}`;
const OK: Choice[] = [{ id: 'ok', label: 'OK' }];

const IDLE_TIMES: Minute[] = [510, 870]; // 08:30, 14:30
const AFTERNOON_FROM: Minute = 840; // 14:00
const LUNCH_ASK: Minute = 770; // 12:50
const LUNCH_QUEUE = 5;
const DOCTOR_ROOMS: StationId[] = ['mchDoctor', 'opdRoom1', 'opdRoom2'];
const UPSTREAM_MCH: StationId[] = ['ancNurse', 'mchTriage'];
const IT_MINUTES = 20;
const CLERKS = ['pt1', 'pt2', 'pt3'];

const queueAt = (sim: Sim, station: StationId) => sim.snapshot().stations.find((s) => s.id === station)?.queue.length ?? 0;
const nameOf = (data: GameData, id: string) => data.staff.find((p) => p.id === id)?.name ?? id;

export const IN_DAY_POPUPS: PopupDef[] = [
  {
    id: 'idleDoctor',
    due: ({ now, sim, flags, dismissedIdle }) => {
      if (!IDLE_TIMES.includes(now) || flags.saringan || dismissedIdle) return false;
      if (!UPSTREAM_MCH.some((st) => queueAt(sim, st) > 0)) return false;
      const sessionStart = now < AFTERNOON_FROM ? null : AFTERNOON_FROM;
      return sim.staff.some((s) => s.station === 'mchDoctor' && !s.onLunch &&
        (s.lastStartAt === null || (sessionStart !== null && s.lastStartAt < sessionStart)));
    },
    build: ({ now }) => ({
      id: popupKey('idleDoctor', now), from: 'Kak Ida (PT)', text: 'Pesakit semakin ramai mendaftar, doktor belum terima pesakit.',
      choices: [{ id: 'saringan', label: "Hantar ibu 'doktor sahaja' terus ke doktor" }, { id: 'biasa', label: 'Ikut giliran biasa' }],
    }),
    effect: (choice) => (choice === 'saringan' ? { flags: { saringan: true } } : { dismissIdle: true }),
  },
  {
    id: 'lunch',
    due: ({ day, now, sim }) => day === 1 && now === LUNCH_ASK && Math.max(...DOCTOR_ROOMS.map((r) => queueAt(sim, r))) >= LUNCH_QUEUE,
    build: ({ now, sim }) => ({
      id: popupKey('lunch', now), from: 'JM Noraini',
      text: `Masih ada ${Math.max(...DOCTOR_ROOMS.map((r) => queueAt(sim, r)))} pesakit depan bilik doktor.`,
      choices: [{ id: 'makan', label: 'Doktor makan dulu, sambung 2 petang' }, { id: 'habis', label: 'Habiskan dulu' }],
    }),
    effect: (choice) => (choice === 'makan' ? { sopPatch: { lunchOnTime: true } } : {}),
  },
  {
    id: 'laluanKhas',
    due: ({ day, now, flags }) => day === 2 && now === 570 && !flags.laluanKhas,
    build: ({ now }) => ({
      id: popupKey('laluanKhas', now), from: 'Pakcik Osman',
      text: 'Saya dah berdiri sejam, tak ada tempat duduk. Orang tua pun kena beratur ke?',
      choices: [{ id: 'buka', label: 'Buka Laluan Khas' }, { id: 'tunggu', label: 'Minta dia tunggu' }],
    }),
    effect: (choice) => (choice === 'buka' ? { flags: { laluanKhas: true } } : {}),
  },
  {
    id: 'printer',
    due: ({ day, now }) => day === 3 && now === 540,
    build: ({ now }) => ({
      id: popupKey('printer', now), from: 'Encik Azman (PT)', text: 'Printer tak connect. Slip tak keluar.',
      choices: [{ id: 'tangan', label: 'Tulis tangan slip' }, { id: 'it', label: 'Panggil IT, tunggu' }],
    }),
    effect: (choice, { now, events }) => {
      if (choice !== 'it') return {};
      const until = now + IT_MINUTES;
      // The printer works again once IT is done; the counters stop while they fix it.
      const fixed = events.map((e) => (e.kind === 'printerDown' && e.from <= now && now < e.to ? { ...e, to: until } : e));
      const away: ClinicEvent[] = CLERKS.map((staffId) => ({ kind: 'staffAway', staffId, from: now, to: until }));
      return { change: { events: [...fixed, ...away] } };
    },
  },
  {
    id: 'emergency',
    due: ({ day, now }) => day === 5 && now === 630,
    build: ({ now, sim, data }) => {
      const doctor = emergencyDoctor(sim, 'opdRoom1');
      const name = doctor ? nameOf(data, doctor.id) : 'Seorang doktor OPD';
      return {
        id: popupKey('emergency', now), from: 'JM Devi',
        text: `Kes kecemasan: sakit dada. ${name} ke Bilik Kecemasan, lebih kurang 30 minit.`, choices: OK,
      };
    },
    effect: () => ({}),
  },
];

/** The popups due now that haven't been shown, in list order. */
export function duePopups(ctx: DayContext): PopupDef[] {
  return IN_DAY_POPUPS.filter((d) => !ctx.shown.has(popupKey(d.id, ctx.now)) && d.due(ctx));
}

export const RELIEF_DOCTOR: StaffDef = { id: 'relief1', name: 'Dr. Relief (KK Seri Melur)', role: 'doctor', homeStation: 'mchDoctor' };
const EL_DOCTOR = 'mo2';
const BORROWED = 'mo5';

/** Asked before the clinic opens; the answer shapes the day's plan. */
export interface MorningPopup { popup: Popup; plan(choiceId: string, plan: DayPlan): DayPlan }

const without = (plan: DayPlan, ids: string[]): DayPlan['roster'] =>
  Object.fromEntries(Object.entries(plan.roster).map(([st, list]) => [st, list.filter((id) => !ids.includes(id))]));

export function morningPopups(day: number): MorningPopup[] {
  if (day !== 4) return [];
  return [{
    popup: {
      id: 'el@4', from: 'Dr. Hafiz', text: 'Dr, saya demam, esok nak EL 🙏',
      choices: [{ id: 'relief', label: 'Minta relief klinik lain' }, { id: 'pinjam', label: 'Pinjam doktor OPD' }],
    },
    plan: (choice, planIn) => {
      if (choice === 'pinjam') {
        const roster = without(planIn, [EL_DOCTOR, BORROWED]);
        roster.mchDoctor = [...(roster.mchDoctor ?? []), BORROWED];
        return { ...structuredClone(planIn), roster };
      }
      const roster = without(planIn, [EL_DOCTOR]);
      roster.mchDoctor = [...(roster.mchDoctor ?? []), RELIEF_DOCTOR.id];
      return { ...structuredClone(planIn), roster };
    },
  }];
}

const LALUAN_STATIONS: StationId[] = ['mchRegistration', 'opdRegistration', 'mchTriage', 'opdTriage', 'mchDoctor', 'opdRoom1', 'opdRoom2', 'pharmacy'];

/** The SOP with the week's standing choices switched on. */
export function sopWithFlags(sopIn: SopSettings, flags: WeekFlags): SopSettings {
  const sop = structuredClone(sopIn);
  if (flags.saringan) sop.saringan.bypass.anc_doctor_only = true;
  if (flags.laluanKhas) sop.laluanKhas = { enabled: true, groups: ['elderly', 'pregnant'], stations: [...LALUAN_STATIONS] };
  return sop;
}
