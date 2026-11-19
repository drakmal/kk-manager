import {
  duePopups, IN_DAY_POPUPS, morningPopups, popupKey, RELIEF_DOCTOR, sopWithFlags, type DayContext, type WeekFlags,
} from '../../src/popups/popups';
import { createDaySim, defaultDayPlan, loadGameData, type ClinicEvent, type DayPlan, type Patient, type Sim } from '../../src/sim/index';

const data = loadGameData();
const noFlags: WeekFlags = { saringan: false, laluanKhas: false };
const def = (id: string) => IN_DAY_POPUPS.find((d) => d.id === id)!;

function simAt(minute: number, plan: DayPlan = defaultDayPlan(data, 1), patients?: Patient[]): Sim {
  const sim = createDaySim(data, plan, patients ? { patients } : {});
  while (sim.now < minute) sim.step();
  return sim;
}
const ctx = (sim: Sim, over: Partial<DayContext> = {}): DayContext => ({
  day: 1, now: sim.now, sim, data, flags: noFlags, shown: new Set(), dismissedIdle: false, events: [], ...over,
});

describe('idleDoctor', () => {
  test('is due at 08:30 when mothers wait upstream and an MCH doctor has seen nobody', () => {
    const sim = simAt(510);
    expect(sim.staff.find((s) => s.id === 'mo1')!.lastStartAt).toBeNull();
    expect(def('idleDoctor').due(ctx(sim))).toBe(true);
    expect(def('idleDoctor').build(ctx(sim))).toEqual({
      id: 'idleDoctor@510', from: 'Kak Ida (PT)', text: 'Pesakit semakin ramai mendaftar, doktor belum terima pesakit.',
      choices: [{ id: 'saringan', label: "Hantar ibu 'doktor sahaja' terus ke doktor" }, { id: 'biasa', label: 'Ikut giliran biasa' }],
    });
  });
  test('is not due at other minutes, with Saringan on, or once dismissed today', () => {
    expect(def('idleDoctor').due(ctx(simAt(509)))).toBe(false);
    const sim = simAt(510);
    expect(def('idleDoctor').due(ctx(sim, { flags: { ...noFlags, saringan: true } }))).toBe(false);
    expect(def('idleDoctor').due(ctx(sim, { dismissedIdle: true }))).toBe(false);
  });
  test('is not due once every MCH doctor has started a patient', () => {
    const plan = defaultDayPlan(data, 1);
    plan.sop = sopWithFlags(plan.sop, { ...noFlags, saringan: true });
    const sim = simAt(510, plan);
    expect(sim.staff.filter((s) => s.station === 'mchDoctor').every((s) => s.lastStartAt !== null)).toBe(true);
    expect(def('idleDoctor').due(ctx(sim))).toBe(false);
  });
  test('is not due when nobody is waiting upstream', () => {
    expect(def('idleDoctor').due(ctx(simAt(510, defaultDayPlan(data, 1), [])))).toBe(false);
  });
  test('choices: Saringan sets the flag, biasa dismisses for the day', () => {
    const sim = simAt(510);
    expect(def('idleDoctor').effect('saringan', ctx(sim))).toEqual({ flags: { saringan: true } });
    expect(def('idleDoctor').effect('biasa', ctx(sim))).toEqual({ dismissIdle: true });
  });
});

describe('lunch', () => {
  const busy = () => Array.from({ length: 12 }, (_, i): Patient => ({
    id: 1000 + i, visitType: 'opd_general', unit: 'opd', arrival: 740, priority: [], colour: null,
    steps: [{ station: 'opdRoom1', minutes: 15, bypassable: false }], route: null, stepIndex: 0,
    waitMinutes: 0, crowdMinutes: 0, doneAt: null, turnedAway: false,
  }));
  test('is due on Isnin at 12:50 when a doctor room has 5 or more waiting, and names N', () => {
    const sim = simAt(770, defaultDayPlan(data, 1), busy());
    const n = sim.snapshot().stations.find((s) => s.id === 'opdRoom1')!.queue.length;
    expect(n).toBeGreaterThanOrEqual(5);
    expect(def('lunch').due(ctx(sim))).toBe(true);
    expect(def('lunch').build(ctx(sim))).toMatchObject({ from: 'JM Noraini', text: `Masih ada ${n} pesakit depan bilik doktor.` });
    expect(def('lunch').build(ctx(sim)).choices).toEqual([
      { id: 'makan', label: 'Doktor makan dulu, sambung 2 petang' }, { id: 'habis', label: 'Habiskan dulu' },
    ]);
    expect(def('lunch').due(ctx(sim, { day: 2 }))).toBe(false);
  });
  test('is not due when the doctor rooms are nearly empty', () => {
    expect(def('lunch').due(ctx(simAt(770, defaultDayPlan(data, 1), [])))).toBe(false);
  });
  test('makan turns lunchOnTime on; habis changes nothing', () => {
    const sim = simAt(770, defaultDayPlan(data, 1), busy());
    expect(def('lunch').effect('makan', ctx(sim))).toEqual({ sopPatch: { lunchOnTime: true } });
    expect(def('lunch').effect('habis', ctx(sim))).toEqual({});
  });
});

test('laluanKhas: Selasa 09:30 complaint; buka sets the flag', () => {
  const sim = simAt(570);
  expect(def('laluanKhas').due(ctx(sim, { day: 2 }))).toBe(true);
  expect(def('laluanKhas').due(ctx(sim, { day: 2, flags: { ...noFlags, laluanKhas: true } }))).toBe(false);
  expect(def('laluanKhas').build(ctx(sim, { day: 2 }))).toMatchObject({
    from: 'Pakcik Osman', text: 'Saya dah berdiri sejam, tak ada tempat duduk. Orang tua pun kena beratur ke?',
    choices: [{ id: 'buka', label: 'Buka Laluan Khas' }, { id: 'tunggu', label: 'Minta dia tunggu' }],
  });
  expect(def('laluanKhas').effect('buka', ctx(sim, { day: 2 }))).toEqual({ flags: { laluanKhas: true } });
  expect(def('laluanKhas').effect('tunggu', ctx(sim, { day: 2 }))).toEqual({});
});

test('printer: Rabu 09:00; IT stops the counter 20 minutes and ends the outage then', () => {
  const sim = simAt(540);
  const events: ClinicEvent[] = [{ kind: 'printerDown', from: 540, to: 720 }];
  const c = ctx(sim, { day: 3, events });
  expect(def('printer').due(c)).toBe(true);
  expect(def('printer').build(c)).toMatchObject({
    from: 'Encik Azman (PT)', text: 'Printer tak connect. Slip tak keluar.',
    choices: [{ id: 'tangan', label: 'Tulis tangan slip' }, { id: 'it', label: 'Panggil IT, tunggu' }],
  });
  expect(def('printer').effect('tangan', c)).toEqual({});
  expect(def('printer').effect('it', c)).toEqual({
    change: {
      events: [
        { kind: 'printerDown', from: 540, to: 560 },
        { kind: 'staffAway', staffId: 'pt1', from: 540, to: 560 },
        { kind: 'staffAway', staffId: 'pt2', from: 540, to: 560 },
        { kind: 'staffAway', staffId: 'pt3', from: 540, to: 560 },
      ],
    },
  });
});

test('emergency: Jumaat 10:30 news names the doctor who goes', () => {
  const sim = simAt(630);
  const c = ctx(sim, { day: 5 });
  expect(def('emergency').due(c)).toBe(true);
  expect(def('emergency').build(c)).toEqual({
    id: 'emergency@630', from: 'JM Devi', text: 'Kes kecemasan: sakit dada. Dr. Siti ke Bilik Kecemasan, lebih kurang 30 minit.',
    choices: [{ id: 'ok', label: 'OK' }],
  });
  expect(def('emergency').effect('ok', c)).toEqual({});
  expect(def('emergency').due(ctx(sim, { day: 4 }))).toBe(false);
});

test('duePopups keeps list order and skips ones already shown', () => {
  const sim = simAt(510);
  const c = ctx(sim);
  expect(duePopups(c).map((d) => d.id)).toEqual(['idleDoctor']);
  expect(duePopups({ ...c, shown: new Set([popupKey('idleDoctor', 510)]) })).toEqual([]);
  expect(IN_DAY_POPUPS.map((d) => d.id)).toEqual(['idleDoctor', 'lunch', 'laluanKhas', 'printer', 'emergency']);
});

describe('morning EL on Khamis', () => {
  test('only Khamis has a morning popup', () => {
    for (const day of [1, 2, 3, 5]) expect(morningPopups(day)).toEqual([]);
    const [el] = morningPopups(4);
    expect(el!.popup).toEqual({
      id: 'el@4', from: 'Dr. Hafiz', text: 'Dr, saya demam, esok nak EL 🙏',
      choices: [{ id: 'relief', label: 'Minta relief klinik lain' }, { id: 'pinjam', label: 'Pinjam doktor OPD' }],
    });
  });
  test('relief seats relief1 and removes mo2; pinjam moves mo5 and removes mo2', () => {
    const [el] = morningPopups(4);
    const plan = defaultDayPlan(data, 1);
    const relief = el!.plan('relief', plan);
    expect(relief.roster.mchDoctor).toEqual(['mo1', RELIEF_DOCTOR.id]);
    expect(Object.values(relief.roster).flat()).not.toContain('mo2');
    const pinjam = el!.plan('pinjam', plan);
    expect(pinjam.roster.mchDoctor).toEqual(['mo1', 'mo5']);
    expect(pinjam.roster.opdRoom2).toEqual(['mo6']);
    expect(Object.values(pinjam.roster).flat()).not.toContain('mo2');
    expect(plan.roster.mchDoctor).toEqual(['mo1', 'mo2']); // not mutated
    expect(RELIEF_DOCTOR).toEqual({ id: 'relief1', name: 'Dr. Relief (KK Seri Melur)', role: 'doctor', homeStation: 'mchDoctor' });
  });
});

test('sopWithFlags turns on Saringan for doctor-only visits and Laluan Khas for elderly and pregnant', () => {
  const sop = defaultDayPlan(data, 1).sop;
  expect(sopWithFlags(sop, noFlags)).toEqual(sop);
  const on = sopWithFlags(sop, { saringan: true, laluanKhas: true });
  expect(on.saringan.bypass.anc_doctor_only).toBe(true);
  expect(on.saringan.bypass.anc_nurse_doctor).toBe(false);
  expect(on.laluanKhas).toEqual({
    enabled: true, groups: ['elderly', 'pregnant'],
    stations: ['mchRegistration', 'opdRegistration', 'mchTriage', 'opdTriage', 'mchDoctor', 'opdRoom1', 'opdRoom2', 'pharmacy'],
  });
  expect(sop.saringan.bypass.anc_doctor_only).toBe(false); // not mutated
});
