# KK Manager: Simulation Core (Plan 1 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a headless, deterministic TypeScript simulation of one full KK clinic day. It covers a detailed MCH unit and a lighter OPD, SOP cards, events and scoring. Its acceptance test reproduces the user's MCH jam and shows the "Saringan di Kaunter" fix working.

**Architecture:**
- A pure TypeScript module with no browser APIs.
- Game data lives in JSON and is validated on load.
- A seeded random generator makes every day reproducible.
- The engine advances one in-game minute per `step()`. Every station is a multi-seat queue.
- `runDay()` returns a `DayReport`. `snapshot()` exposes state for the renderer in Plan 2.

**Tech Stack:**
- TypeScript (strict mode)
- Node 20 or later
- Vitest
- tsx, for the command-line script
- No runtime dependencies

**Spec:** `docs/superpowers/specs/2026-11-19-kk-manager-design.md`. Accuracy notes are in `docs/research/moh-guidelines-notes.md`.

**Roadmap:**
- Plan 2: renderer, UI and day loop. It consumes `createSim`, `snapshot` and `DayReport`.
- Plan 3: night-before phase, campaign, saves, deploy.
- Each plan is written after the previous one ships.
- Mid-day SOP and roster changes need a briefing delay and a cost to HCW satisfaction. Plan 2 adds them as `sim.applyChange(...)`, using `tuning.briefingDelayMinutes`, which this plan already defines. This plan only runs fixed plans.
- The Pasangan Mentor card, emergency leave and new-doctor events, and complaints belong to Plan 3. This plan already supports emergency leave in the form of a roster with an empty seat.

## Global Constraints

- **Where it runs:** building and testing happen in a cloud session or in CI. Never open a browser preview on the user's machine.
- **Folder rule:** the simulation code in `src/sim/` must not touch `window`, `document`, `localStorage` or the clock (`Date.now`). Time is only `sim.now`.
- **Determinism:** the same `GameData` and the same `DayPlan` (including `seed`) must give a deep-equal `DayReport`.
- **Time:** expressed as minutes since midnight.
  - Clinic opens at 480 (08:00).
  - Registration closes after 990 (16:30). Arrivals at minute 990 or earlier are accepted, later ones are turned away.
  - Clinic closes at 1020 (17:00).
  - Hard stop at 1140 (19:00).
  - Lunch runs 780–840 (13:00–14:00).
- **Rooms are fixed.** A station's `seats` is its capacity. The roster decides who fills seats. Doctor rooms have 2 seats with **one shared queue**.
- **Patients are never moved individually.** Only SOP settings and the roster change routing.
- **Placeholder values:** every value in `src/sim/data/*.json` is a placeholder the user will tune through the Google Sheet. Tests that check behaviour across the whole day must use their own small fixture configs, except the acceptance task.
- **Language:**
  - Identifiers, the interface and code comments are in English.
  - Station and visit labels are in Malay, as in the spec.
  - Avoid "FMS". Use "Clinic Manager".
- **Branding:** no MOH/KKM logos or names in assets or output.

## Review Focus

1. **A unit with zero patients**, because a sheet edit set `dailyVolume.mch` to 0. The report should have no `NaN`: means are 0 and satisfaction is 100. Test in Task 7.
2. **A station with no staff**, for example no ANC nurse rostered because of emergency leave. The day must still end at the 1140 hard stop, with `unfinished` counted and no endless loop. Test in Task 5.
3. **Bad data from the Google Sheet:** `min > max`, a negative duration, or an unknown station id. Loading fails with an error naming the visit type or station. Test in Task 2.
4. **Overlapping events**, such as CCMS down while the printer is down. Their effects stack (registration ×2, then +1). Test in Task 6.
5. **An arrival exactly at 16:30 (990)** is registered. An arrival at 991 is turned away. Test in Task 5.

---

## File Structure

```
package.json, tsconfig.json, vitest.config.ts, .gitignore
.github/workflows/ci.yml          # runs typecheck and tests on push / PR
src/sim/
  rng.ts        # seeded random generator (mulberry32)
  time.ts       # "08:00" <-> 480 helpers
  types.ts      # all shared types (data, plan, patient, report, snapshot)
  data.ts       # loadGameData(), validateGameData()
  data/stations.json  data/visitTypes.json  data/staff.json  data/arrivals.json  data/tuning.json
  plan.ts       # defaultDayPlan()
  patients.ts   # generatePatients()
  routing.ts    # filterRoute(): Saringan di Kaunter + CCMS contingency
  engine.ts     # createSim(), runDay(): queues, service, lunch, closing, hard stop, Laluan Khas ordering
  events.ts     # event effects + Pinjam Doktor OPD
  scoring.ts    # satisfaction, lunch/balik outcomes, buildReport()
  index.ts      # public API re-exports
scripts/sim-day.ts                # CLI: run one or many days, print report
tests/sim/*.test.ts
```

---

### Task 1: Project scaffold, CI, random generator and time helpers

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.github/workflows/ci.yml`, `src/sim/rng.ts`, `src/sim/time.ts`
- Test: `tests/sim/rng.test.ts`, `tests/sim/time.test.ts`

**Interfaces:**
- Produces:
  - `createRng(seed: number): Rng`, where `interface Rng { next(): number /* [0,1) */; int(min: number, max: number): number /* inclusive */; chance(p: number): boolean; pick<T>(items: readonly T[]): T; weighted<K extends string>(weights: Record<K, number>): K }`
  - `toMinute(hhmm: string): number`
  - `fmt(minute: number): string`

- [ ] **Step 1:** Run `git init`. Add `package.json` with `"name": "kk-manager"` and `"type": "module"`, plus these scripts:
  - `"test": "vitest run"`
  - `"typecheck": "tsc --noEmit"`
  - `"sim": "tsx scripts/sim-day.ts"`

  Add the dev dependencies `typescript`, `vitest`, `tsx` and `@types/node`, at their current stable versions. Add `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `resolveJsonModule: true`, `module: "ESNext"` and `moduleResolution: "Bundler"`. Add `.gitignore` with `node_modules` and `dist`.
- [ ] **Step 2:** Add `.github/workflows/ci.yml`. On push and pull requests it sets up Node 20, then runs `npm ci`, `npm run typecheck` and `npm test`.
- [ ] **Step 3: Write the failing tests**

```ts
// tests/sim/rng.test.ts
test('same seed gives same sequence', () => {
  const a = createRng(42), b = createRng(42);
  expect([a.next(), a.next(), a.int(1, 6)]).toEqual([b.next(), b.next(), b.int(1, 6)]);
});
test('int is inclusive and in range', () => {
  const r = createRng(1);
  const xs = Array.from({ length: 2000 }, () => r.int(3, 5));
  expect(new Set(xs)).toEqual(new Set([3, 4, 5]));
});
test('weighted never returns zero-weight keys', () => {
  const r = createRng(7);
  for (let i = 0; i < 500; i++) expect(r.weighted({ a: 1, b: 0 })).toBe('a');
});
// tests/sim/time.test.ts
test('time round-trip', () => {
  expect(toMinute('08:00')).toBe(480);
  expect(toMinute('16:30')).toBe(990);
  expect(fmt(780)).toBe('13:00');
  expect(fmt(1145)).toBe('19:05');
});
```

- [ ] **Step 4:** Run `npm test`. It should fail because the modules don't exist yet.
- [ ] **Step 5:** Implement `src/sim/rng.ts` using mulberry32, and `src/sim/time.ts`. `fmt` zero-pads to `HH:MM`.
- [ ] **Step 6:** Run `npm test` and `npm run typecheck`. Both should pass.
- [ ] **Step 7:** Commit: `chore: scaffold project, CI, seeded rng and time helpers`.
- [ ] **Step 8 (needs the user's go-ahead):** Create a GitHub repository `kk-manager` with `gh repo create kk-manager --private --source . --push`, and confirm CI is green. The cloud session for later tasks starts from this repository.

---

### Task 2: Types, placeholder game data, validation

**Files:**
- Create: `src/sim/types.ts`, `src/sim/data.ts`, `src/sim/data/{stations,visitTypes,staff,arrivals,tuning}.json`, `src/sim/plan.ts`
- Test: `tests/sim/data.test.ts`

**Interfaces:**
- Produces, in `types.ts`, exactly these names:

```ts
type Minute = number; type StationId = string; type VisitTypeId = string; type StaffId = string;
type Role = 'doctor' | 'nurse' | 'jm' | 'ppk' | 'clerk' | 'lab' | 'pharmacy';
type UnitId = 'mch' | 'opd';
type PriorityGroup = 'pregnant' | 'elderly' | 'oku' | 'childUnder2';
type ColourCode = 'putih' | 'hijau' | 'kuning' | 'merah';
interface StationDef { id: StationId; unit: UnitId | 'shared'; label: string; role: Role; seats: number; minutes: [number, number]; opensAt: Minute }
interface StepDef { station: StationId; minutes?: [number, number]; chance?: number; bypassable?: boolean }
interface VisitTypeDef { id: VisitTypeId; unit: UnitId; label: string; share: number; appointment: boolean;
  priority: PriorityGroup[]; colourWeights?: Partial<Record<ColourCode, number>>; steps: StepDef[] }
interface StaffDef { id: StaffId; name: string; role: Role; homeStation: StationId }
interface ArrivalProfile { dailyVolume: Record<UnitId, number>; hourlyShare: { from: Minute; to: Minute; share: number }[] }
interface Tuning { patienceMinutes: number; waitPenaltyPerMinute: number; crowdCapacity: number; crowdPenaltyPerMinute: number;
  overloadQueuePerSeat: number; overloadPenaltyPerMinute: number; lateLunchPenalty: number; missedLunchPenalty: number;
  overtimePenaltyPerMinute: number; briefingDelayMinutes: number; lunchMinMinutes: number; lunchLateCutoff: Minute;
  hardStop: Minute; colourDoctorMultiplier: Record<ColourCode, number>; ccmsRegistrationMultiplier: number;
  printerRegistrationExtra: number; printerPharmacyExtra: number }
interface GameData { stations: StationDef[]; visitTypes: VisitTypeDef[]; staff: StaffDef[]; arrivals: ArrivalProfile; tuning: Tuning }
interface SopSettings {
  saringan: { bypass: Record<VisitTypeId, boolean> };
  laluanKhas: { enabled: boolean; groups: PriorityGroup[]; stations: StationId[] };
  pinjamDoktor: { enabled: boolean; queueThreshold: number; maxDoctors: number };
  temujanji: { enabled: boolean; from: Minute; to: Minute; slotMinutes: number; perSlot: number };
  kontingensiCcms: { printedList: boolean };
}
type ClinicEvent =
  | { kind: 'ccmsDown'; from: Minute; to: Minute }
  | { kind: 'printerDown'; from: Minute; to: Minute }
  | { kind: 'influx'; at: Minute; count: number; visitType: VisitTypeId }
  | { kind: 'emergencyWalkIn'; at: Minute; minutes: [number, number] };
interface DayPlan { seed: number; roster: Record<StationId, StaffId[]>; sop: SopSettings; events: ClinicEvent[] }
```

- Produces:
  - `loadGameData(): GameData`, which imports the JSON files and validates them.
  - `validateGameData(raw: unknown): GameData`, which throws `Error` with a message naming the bad id.
  - `defaultDayPlan(data: GameData, seed: number): DayPlan`. Its roster puts each staff member at their `homeStation`, Saringan bypass is all `false`, every other card is disabled or `false` (temujanji defaults: `from 480, to 720, slotMinutes 30, perSlot 6`), and there are no events.

- [ ] **Step 1: Write the JSON placeholder data.** These values come from the spec's placeholders.

**Stations** (`minutes` are defaults; `opensAt` is 480 for all):

| id | unit | role | seats | minutes |
|---|---|---|---|---|
| `primaryTriage` | shared | ppk | 1 | [1,1] |
| `mchRegistration` | mch | clerk | 1 | [2,3] |
| `mchTriage` | mch | jm | 1 | [3,5] |
| `ancNurse` | mch | nurse | 2 | [20,30] |
| `mchDoctor` | mch | doctor | 2 | [5,15] |
| `immunisation` | mch | jm | 1 | [8,12] |
| `lab` | shared | lab | 1 | [4,6] |
| `pharmacy` | shared | pharmacy | 2 | [3,6] |
| `opdRegistration` | opd | clerk | 2 | [2,3] |
| `opdTriage` | opd | jm | 1 | [2,4] |
| `opdDoctor` | opd | doctor | 4 | [6,12] |

**Visit types.** Every MCH route starts `primaryTriage → mchRegistration → mchTriage`. Every OPD route starts `primaryTriage → opdRegistration → opdTriage`. The table lists only the steps after that.

| id | share | steps after triage |
|---|---|---|
| `anc_booking` | .08 | ancNurse[35,45] → mchDoctor[20,30] → lab → pharmacy(.8) |
| `anc_nurse_only` | .30 | ancNurse[20,30] → lab(.3) → pharmacy(.5) |
| `anc_nurse_doctor` | .22 | ancNurse[20,30] → mchDoctor[8,15] → lab(.2) → pharmacy(.6) |
| `anc_doctor_only` | .20 | ancNurse[4,6] (**bypassable**) → mchDoctor[5,10] → pharmacy(.5) |
| `postnatal` | .08 | ancNurse[15,20] → mchDoctor[8,12] → pharmacy(.5) |
| `child_health` | .07 | immunisation[10,15] |
| `immunisation` | .05 | immunisation[8,12] |
| `opd_general` | 1.0 (OPD) | opdDoctor → pharmacy(.9) |

- All `anc_*` types and `postnatal` have `appointment: true` and `priority: ['pregnant']`.
- `anc_*` types have `colourWeights: {putih:.35, hijau:.40, kuning:.20, merah:.05}`.
- `child_health` and `immunisation` have `appointment: true` and `priority: ['childUnder2']`.
- `opd_general` has `appointment: false` and `priority: []`. Elderly and OKU flags are given per patient in Task 3.

**Staff:** one person per seat. `mo1` and `mo2` are the MCH doctors and `mo3`–`mo6` are OPD. Other ids follow the same pattern: `jk1…`, `jm1…` and so on, with fictional names. That's 2 MCH MOs, 4 OPD MOs, 2 ANC nurses, 3 JMs (mchTriage, immunisation, opdTriage), 1 PPK, 3 clerks, 1 lab, 2 pharmacy.

**Arrivals:**
- `dailyVolume: {mch: 40, opd: 120}`.
- `hourlyShare` in `[from,to)` windows: 420–480 .30, 480–540 .25, 540–600 .15, 600–660 .10, 660–720 .07, 720–780 .03, 840–900 .05, 900–960 .04, 960–991 .01.

**Tuning:**
- patienceMinutes 30, waitPenaltyPerMinute 1
- crowdCapacity 40, crowdPenaltyPerMinute 0.5
- overloadQueuePerSeat 4, overloadPenaltyPerMinute 0.1
- lateLunchPenalty 10, missedLunchPenalty 25, overtimePenaltyPerMinute 0.5
- briefingDelayMinutes 10, lunchMinMinutes 30, lunchLateCutoff 825, hardStop 1140
- colourDoctorMultiplier {putih 1, hijau 1, kuning 1.3, merah 1.6}
- ccmsRegistrationMultiplier 2, printerRegistrationExtra 1, printerPharmacyExtra 2

- [ ] **Step 2: Write the failing tests**

```ts
test('default data loads', () => { expect(loadGameData().stations.length).toBe(11); });
test('hourly shares sum to 1', () => {
  expect(loadGameData().arrivals.hourlyShare.reduce((s, h) => s + h.share, 0)).toBeCloseTo(1, 9);
});
test('visit shares sum to 1 per unit', () => { /* mch and opd each toBeCloseTo(1, 9) */ });
test.each([
  ['unknown station', (d: any) => { d.visitTypes[0].steps.push({ station: 'nope' }); }, /anc_booking.*nope/],
  ['min > max', (d: any) => { d.visitTypes[1].steps[3].minutes = [30, 20]; }, /anc_nurse_only/],
  ['negative', (d: any) => { d.stations[0].minutes = [-1, 2]; }, /primaryTriage/],
  ['staff home unknown', (d: any) => { d.staff[0].homeStation = 'x'; }, /mo1|x/],
])('rejects %s', (_n, mutate, msg) => {
  const d = structuredClone(loadGameData()); mutate(d);
  expect(() => validateGameData(d)).toThrow(msg);
});
test('default plan rosters everyone at home', () => {
  const p = defaultDayPlan(loadGameData(), 1);
  expect(p.roster.mchDoctor).toHaveLength(2); expect(p.roster.opdDoctor).toHaveLength(4);
  expect(Object.values(p.sop.saringan.bypass).every(v => v === false)).toBe(true);
});
```

- [ ] **Step 3:** Run `npm test -- data`. It should fail.
- [ ] **Step 4:** Implement `types.ts`, `validateGameData`, `loadGameData` and `defaultDayPlan`. Validation checks:
  - ids are unique
  - every step and home station refers to a real station
  - `0 ≤ min ≤ max`
  - `0 < chance ≤ 1`
  - `seats ≥ 0`
  - shares sum to 1 within 1e-6, per unit and for `hourlyShare`

  Error messages include the offending id.
- [ ] **Step 5:** Run `npm test` and `npm run typecheck`. Both should pass.
- [ ] **Step 6:** Commit: `feat(sim): types, placeholder game data and validation`.

---

### Task 3: Patient generation

**Files:**
- Create: `src/sim/patients.ts`
- Modify: `src/sim/types.ts` (add `Patient`, `PlannedStep`)
- Test: `tests/sim/patients.test.ts`

**Interfaces:**
- Consumes: `GameData`, `DayPlan`, `Rng` (Tasks 1 and 2).
- Produces:

```ts
interface PlannedStep { station: StationId; minutes: number; bypassable: boolean }
interface Patient { id: number; visitType: VisitTypeId; unit: UnitId; arrival: Minute; priority: PriorityGroup[];
  colour: ColourCode | null; steps: PlannedStep[]; route: PlannedStep[] | null; stepIndex: number;
  waitMinutes: number; crowdMinutes: number; doneAt: Minute | null; turnedAway: boolean }
generatePatients(data: GameData, plan: DayPlan, rng: Rng): Patient[]   // sorted by (arrival, id)
makePatient(data: GameData, visitType: VisitTypeId, arrival: Minute, id: number, rng: Rng): Patient  // reused by influx (Task 6)
```

- **`stepIndex` meaning:** before registration finishes, `stepIndex` indexes `steps` and `route` is `null`. When registration finishes, the engine sets `route` and resets `stepIndex` to 0, after which it indexes `route`.

- [ ] **Step 1: Write the failing tests**

```ts
const data = loadGameData();
test('count matches daily volume', () => {
  const ps = generatePatients(data, defaultDayPlan(data, 1), createRng(1));
  expect(ps.filter(p => p.unit === 'mch')).toHaveLength(40);
  expect(ps.filter(p => p.unit === 'opd')).toHaveLength(120);
});
test('deterministic', () => {
  const plan = defaultDayPlan(data, 5);
  expect(generatePatients(data, plan, createRng(5))).toEqual(generatePatients(data, plan, createRng(5)));
});
test('arrivals within 420..990 and sorted', () => { /* every arrival in [420, 990]; array sorted by arrival */ });
test('chance steps sampled; durations within range; colour only for anc', () => {
  /* anc_doctor_only always has ancNurse step with minutes 4..6 and bypassable true;
     opd_general colour === null; every anc_* colour !== null */
});
test('kuning/merah scale mchDoctor minutes', () => {
  /* for a merah anc_nurse_doctor patient, mchDoctor minutes ∈ [ceil(8*1.6), ceil(15*1.6)] */
});
test('temujanji spreads appointment arrivals into slots', () => {
  const plan = defaultDayPlan(data, 2);
  plan.sop.temujanji = { enabled: true, from: 480, to: 720, slotMinutes: 30, perSlot: 6 };
  const appt = generatePatients(data, plan, createRng(2)).filter(p => p.unit === 'mch');
  // patient k (in generation order) gets slot s = 480 + floor(k/6)*30, arrival ∈ [s-15, s+5];
  // overflow beyond `to` falls back to the hourly curve
  expect(appt.filter(p => p.arrival < 465)).toHaveLength(0);
});
```

- [ ] **Step 2:** Run `npm test -- patients`. It should fail.
- [ ] **Step 3:** Implement `generatePatients`:
  - **Visit type:** for each unit, draw it with `rng.weighted(share)`.
  - **Arrival:** pick a window with `rng.weighted(hourlyShare)`, then a uniform minute inside it. Clamp to 990.
  - **Temujanji:** when enabled, appointment types get sequential slots instead (see the test).
  - **Colour:** `rng.weighted(colourWeights)`.
  - **Priority flags:** OPD patients add `'elderly'` with chance .2 and `'oku'` with chance .03.
  - **Steps:** each step is kept if `rng.chance(chance ?? 1)`. Its minutes are `rng.int(...(step.minutes ?? station.minutes))`. For `mchDoctor`, multiply by `colourDoctorMultiplier` and take the ceiling.
  - **Order:** draw in the fixed order of unit, then patient index, so results are deterministic.
- [ ] **Step 4:** Run the tests. They should pass.
- [ ] **Step 5:** Commit: `feat(sim): deterministic patient generation with temujanji slots`.

---

### Task 4: Routing (Saringan di Kaunter + CCMS contingency)

**Files:**
- Create: `src/sim/routing.ts`
- Test: `tests/sim/routing.test.ts`

**Interfaces:**
- Consumes: `PlannedStep`, `SopSettings`.
- Produces: `filterRoute(remaining: PlannedStep[], visitType: VisitTypeId, sop: SopSettings, appointmentInfoAvailable: boolean): PlannedStep[]`.
  - When a patient finishes registration, the engine passes the steps **after** the registration step, `patient.steps.slice(stepIndex + 1)`.
  - `filterRoute` only removes steps. It never reorders them.

- [ ] **Step 1: Write the failing tests**

```ts
const steps = [ /* remaining after registration: mchTriage, ancNurse(bypassable), mchDoctor */ ];
test('default (first come first served) keeps the nurse step', () => {
  expect(filterRoute(steps, 'anc_doctor_only', sopWith({}), true).map(s => s.station))
    .toEqual(['mchTriage', 'ancNurse', 'mchDoctor']);
});
test('bypass on skips nurse when appointments visible', () => {
  expect(filterRoute(steps, 'anc_doctor_only', sopWith({ anc_doctor_only: true }), true).map(s => s.station))
    .toEqual(['mchTriage', 'mchDoctor']);
});
test('CCMS down without printed list falls back to first come first served', () => {
  expect(filterRoute(steps, 'anc_doctor_only', sopWith({ anc_doctor_only: true }), false).map(s => s.station))
    .toContain('ancNurse');
});
test('non-bypassable steps never removed', () => { /* anc_nurse_doctor with bypass true keeps ancNurse */ });
```

- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement. Remove the steps where `bypassable && sop.saringan.bypass[visitType] && appointmentInfoAvailable`.
- [ ] **Step 4:** Run the tests. They should pass.
- [ ] **Step 5:** Commit: `feat(sim): Saringan di Kaunter routing with CCMS fallback`.

---

### Task 5: Engine (queues, service, lunch, closing, hard stop, Laluan Khas)

**Files:**
- Create: `src/sim/engine.ts`, `src/sim/index.ts`
- Modify: `src/sim/types.ts` (add `SimSnapshot`, `StaffState`)
- Test: `tests/sim/engine.test.ts`, plus a fixture `tests/sim/fixtures.ts` with a tiny 2-station config whose durations are fixed (`min === max`)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:

```ts
interface StaffState { id: StaffId; station: StationId | null; servingPatient: number | null; remaining: number;
  onLunch: boolean; lunchStart: Minute | null; lunchEnd: Minute | null; unavailableUntil: Minute | null;
  idleMinutes: number; idleMorning: number /* 480..599 */; overloadMinutes: number; overtimeMinutes: number }
interface SimSnapshot { now: Minute; stations: { id: StationId; queue: number[]; seats: { staffId: StaffId; patientId: number | null; onLunch: boolean }[] }[];
  waitingCount: number; donePatients: number }
interface Sim { readonly now: Minute; step(): void; isDone(): boolean; snapshot(): SimSnapshot;
  readonly patients: readonly Patient[]; readonly staff: readonly StaffState[] }
createSim(data: GameData, plan: DayPlan): Sim     // now starts at 420
runDay(data: GameData, plan: DayPlan): DayReport  // loops step() until isDone(), then buildReport (Task 7)
```

**Each minute `t` follows this order. It's fixed for determinism. Stations are always processed in `data.stations` order.**
1. Apply event hooks (a no-op until Task 6).
2. Add patients with `arrival === t` to the first step's queue. Patients arriving after 990 get `turnedAway = true`.
3. Each staff member serving a patient: decrement `remaining`. At 0, the patient moves on:
   - If the station just finished is a registration station (a station whose `role` is `'clerk'`), set `route = filterRoute(...)` (with `appointmentInfoAvailable` from Task 6, `true` until then), then enqueue the patient at `route[0]`.
   - Otherwise, advance `stepIndex`.
   - If there are no steps left, set `doneAt = t`.
4. **Lunch, for each staff member:**
   - Starting lunch: if `t ≥ 780`, `t ≤ lunchLateCutoff`, they haven't had lunch yet, they aren't serving, and their station's queue is empty, then `onLunch = true` and `lunchStart = t`.
   - Ending lunch: when `t ≥ max(840, lunchStart + lunchMinMinutes)`, set `onLunch = false`.
5. **Each seat that is free, available and open** (`t ≥ opensAt`, not on lunch, not unavailable) takes the next patient from the station queue.
   - **Queue order:** first come first served by the minute the patient joined that queue, ties broken by `id`.
   - **Laluan Khas:** when it's on and the station is listed, patients with any group in `laluanKhas.groups` go first, still first come first served among themselves.
   - `remaining = step minutes` (events may modify this in Task 6).
6. **Stats:**
   - Every queued patient gets `waitMinutes += 1`.
   - A rostered, available, open staff member who isn't serving gets `idleMinutes += 1`, and `idleMorning += 1` if `480 ≤ t < 600`.
   - `overloadMinutes` increases when a queue is longer than `overloadQueuePerSeat × seats staffed`.
   - `overtimeMinutes` increases when `t ≥ 1020` and the staff member is serving.
   - `crowdMinutes += 1` for every queued patient when the total waiting is above `crowdCapacity`.
7. `now = t + 1`.

`isDone()` is true when (`now ≥ 1020` and every non-turned-away patient has `doneAt`), or when `now ≥ hardStop`.

- [ ] **Step 1: Write the failing tests** (using the fixture config unless stated)

```ts
test('single patient walks the route', () => { /* steps 2+3 min, arrival 480 → doneAt 485 */ });
test('two-seat shared queue serves two at once', () => { /* 2 patients at 480, station seats 2, 10 min → both done 490 */ });
test('first come first served without Laluan Khas; priority first with it', () => { /* 3 queued, one 'pregnant' arriving last */ });
test('arrival at 990 registered, 991 turned away', () => { /* turnedAway false / true */ });
test('lunch on time when free at 13:00', () => { /* staff idle at 780 → lunchStart 780, back 840 */ });
test('late lunch when busy until 13:20', () => { /* lunchStart 800, back 840 */ });
test('no lunch when never free before 825', () => { /* lunchStart null */ });
test('unstaffed station ends at hard stop with unfinished patients', () => {
  const plan = { ...fixturePlan, roster: { ...fixturePlan.roster, b: [] } };
  const sim = createSim(fixtureData, plan); while (!sim.isDone()) sim.step();
  expect(sim.now).toBe(1140); expect(sim.patients.some(p => p.doneAt === null)).toBe(true);
});
test('same plan → identical patients and staff after a full day', () => { /* run default data twice, deep-equal */ });
test('snapshot lists queues and seats', () => { /* after stepping to 485, snapshot.stations[...] shape */ });
```

- [ ] **Step 2:** Run `npm test -- engine`. It should fail.
- [ ] **Step 3:** Implement `createSim`, `runDay` (temporarily return a minimal object until Task 7) and `index.ts`, which re-exports the public API.
- [ ] **Step 4:** Run the tests. They should pass.
- [ ] **Step 5:** Commit: `feat(sim): minute-step engine with shared queues, lunch and closing rules`.

---

### Task 6: Events and Pinjam Doktor OPD

**Files:**
- Create: `src/sim/events.ts`
- Modify: `src/sim/engine.ts` (call the event hooks at sub-steps 1 and 5, and supply `appointmentInfoAvailable`)
- Test: `tests/sim/events.test.ts`

**Interfaces:**
- Consumes: the `Sim` internals from Task 5, and `ClinicEvent`.
- Produces:
  - `isActive(events: ClinicEvent[], kind: 'ccmsDown' | 'printerDown', t: Minute): boolean`
  - `serviceMinutes(base: number, station: StationDef, t: Minute, events: ClinicEvent[], tuning: Tuning): number`

**Event rules (from the spec, sections 6.6–6.7):**
- **`ccmsDown`:**
  - While active, registration service time is `ceil(base × ccmsRegistrationMultiplier)`.
  - A patient finishing registration while it's active gets `appointmentInfoAvailable = sop.kontingensiCcms.printedList`.
- **`printerDown`:** registration +`printerRegistrationExtra`, pharmacy +`printerPharmacyExtra`. These stack after the CCMS multiplier.
- **`influx`:** at time `at`, add `count` new patients of `visitType`, generated with the same step-sampling as Task 3 and new ids that continue after the last one.
- **`emergencyWalkIn`:** at time `at`, the lowest-id `opdDoctor` staff member who isn't on lunch becomes unavailable for `rng.int(minutes)`. If they were serving, they finish that patient first, then go.
- **Pinjam Doktor OPD:**
  - Each minute, if it's enabled, the `mchDoctor` queue length is at least `queueThreshold`, `mchDoctor` has an empty seat (staffed < seats), and fewer than `maxDoctors` have already been borrowed:
  - schedule the lowest-id idle `opdDoctor` to move at `t + briefingDelayMinutes`.
  - They move between patients.

- [ ] **Step 1: Write the failing tests**

```ts
test('CCMS down doubles registration minutes', () => { expect(serviceMinutes(3, reg, 500, [ccms(480, 600)], tuning)).toBe(6); });
test('CCMS + printer stack', () => { expect(serviceMinutes(3, reg, 500, [ccms(480, 600), printer(480, 600)], tuning)).toBe(7); });
test('printer adds to pharmacy only after window', () => { /* 5 at t=500 inside → 7, at t=700 outside → 5 */ });
test('registered during CCMS down → nurse step kept even with bypass', () => { /* engine run, anc_doctor_only route contains ancNurse */ });
test('printed list keeps bypass working during CCMS down', () => { /* route lacks ancNurse */ });
test('influx adds patients at the given minute', () => { /* +20 patients with arrival 600 */ });
test('emergency walk-in removes one OPD doctor for its duration', () => { /* unavailableUntil set, seat count drops */ });
test('Pinjam fills an empty MCH seat after the briefing delay', () => {
  /* roster mchDoctor: ['mo1'] only, pinjam enabled threshold 3 → some opd doctor station === 'mchDoctor'
     at a minute ≥ trigger + 10; opdDoctor staffed 3 */
});
```

- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement `events.ts` and wire the hooks into the engine.
- [ ] **Step 4:** Run `npm test`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(sim): CCMS/printer/influx/emergency events and Pinjam Doktor OPD`.

---

### Task 7: Scoring and DayReport

**Files:**
- Create: `src/sim/scoring.ts`
- Modify: `src/sim/types.ts` (add `DayReport`), `src/sim/engine.ts` (`runDay` returns `buildReport`)
- Test: `tests/sim/scoring.test.ts`

**Interfaces:**
- Produces:

```ts
type LunchOutcome = 'onTime' | 'late' | 'missed'; type BalikOutcome = 'onTime' | 'overtime';
interface DayReport { seed: number;
  lunch: { outcome: LunchOutcome; perDoctor: { staffId: StaffId; lunchStart: Minute | null }[] };
  balik: { outcome: BalikOutcome; lastPatientDone: Minute | null; overtimeMinutes: number };
  patientSatisfaction: number; hcwSatisfaction: number;               // 0..100, rounded to 1 decimal
  waitByVisitType: Record<VisitTypeId, { mean: number; max: number; count: number }>;
  idleByStaff: Record<StaffId, { morning: number; total: number }>;
  peakQueue: Record<StationId, { size: number; at: Minute }>;
  turnedAway: number; unfinished: number }
patientScore(p: Patient, t: Tuning): number
staffScore(s: StaffState, t: Tuning): number   // own lunch read from s.lunchStart
lunchOutcome(starts: (Minute | null)[]): LunchOutcome
buildReport(sim: Sim, data: GameData, plan: DayPlan): DayReport
```

**Formulas** (spec 6.8. The numbers are tuning placeholders.)
- **`patientScore`:** `clamp(100 − max(0, waitMinutes − patienceMinutes) × waitPenaltyPerMinute − crowdMinutes × crowdPenaltyPerMinute, 0, 100)`. Turned-away and unfinished patients score 0.
- **`patientSatisfaction`:** the mean over all patients, or 100 if there are none.
- **`lunchOutcome`** over the rostered doctors (staff with role `doctor` on `mchDoctor`/`opdDoctor`):
  - `onTime` if every start is exactly 780.
  - `late` if all starts are non-null and the latest is ≤ 825.
  - `missed` otherwise.
- **`staffScore`:** `clamp(100 − overloadMinutes × overloadPenaltyPerMinute − (late ? lateLunchPenalty : missed ? missedLunchPenalty : 0) − overtimeMinutes × overtimePenaltyPerMinute, 0, 100)`. The staff member's own lunch counts: late if their start is after 780, missed if null.
- **`hcwSatisfaction`:** the mean over rostered staff, or 100 if there are none.
- **`balik`:** `onTime` if `lastPatientDone ≤ 1020` (or there were no patients). `overtimeMinutes` is the sum of staff overtime.
- **`waitByVisitType`:** includes only visit types that had at least one patient. Its mean is 0 when `count` is 0, so there are never `NaN` values.

- [ ] **Step 1: Write the failing tests**

```ts
test('patient within patience scores 100; 10 over → 90; crowd 4 min → -2', () => { /* exact values */ });
test('unfinished patient scores 0', () => {});
test('lunch outcomes', () => {
  expect(lunchOutcome([780, 780])).toBe('onTime');
  expect(lunchOutcome([780, 825])).toBe('late');
  expect(lunchOutcome([780, null])).toBe('missed');
});
test('staff score with late lunch and 20 overtime min = 100 - 10 - 10 = 80', () => {});
test('report on default day has no NaN and sane ranges', () => {
  const r = runDay(loadGameData(), defaultDayPlan(loadGameData(), 3));
  expect(JSON.stringify(r)).not.toMatch(/"(mean|max|patientSatisfaction|hcwSatisfaction)":null/); // NaN serialises as null
  expect(r.patientSatisfaction).toBeGreaterThanOrEqual(0); expect(r.patientSatisfaction).toBeLessThanOrEqual(100);
});
test('zero MCH volume → no NaN, satisfaction 100 when OPD also 0', () => {
  const d = structuredClone(loadGameData()); d.arrivals.dailyVolume = { mch: 0, opd: 0 };
  const r = runDay(d, defaultDayPlan(d, 1));
  expect(r.patientSatisfaction).toBe(100); expect(r.waitByVisitType).toEqual({}); expect(r.balik.outcome).toBe('onTime');
});
```

- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement `scoring.ts` and switch `runDay` to `buildReport`. Track `peakQueue` in engine sub-step 6.
- [ ] **Step 4:** Run `npm test`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(sim): satisfaction, lunch and balik outcomes, day report`.

---

### Task 8: Acceptance (reproduce the MCH jam and prove the fix) + CLI

**Files:**
- Create: `scripts/sim-day.ts`, `tests/sim/acceptance.test.ts`

**Interfaces:**
- Consumes: `loadGameData`, `defaultDayPlan`, `runDay`, `DayReport`, `fmt`.
- Produces the CLI `npm run sim -- [--seed N] [--days N] [--bypass id,id] [--ccms HH:MM-HH:MM] [--printed-list] [--laluan-khas]`.
  - It prints, for one day: the lunch and balik outcomes, both satisfaction scores, a table of wait by visit type, the morning idle time of each MCH doctor, and the peak queues.
  - With `--days N` it runs seeds 1..N and prints the mean of each number.

- [ ] **Step 1: Write the acceptance tests** (default placeholder data, seeds 1..20)

```ts
const data = loadGameData();
const days = (mut?: (p: DayPlan) => void) => Array.from({ length: 20 }, (_, i) => {
  const p = defaultDayPlan(data, i + 1); mut?.(p); return runDay(data, p);
});
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const mchIdle = (r: DayReport) => mean(['mo1', 'mo2'].map(id => r.idleByStaff[id]!.morning));
const docOnlyWait = (r: DayReport) => r.waitByVisitType.anc_doctor_only?.mean ?? 0;

test('first come first served reproduces the jam: MCH doctors idle ≥ 25 min between 08:00–10:00', () => {
  expect(mean(days().map(mchIdle))).toBeGreaterThanOrEqual(25);
});
test('Saringan bypass for doctor-only cuts their wait by ≥ 40% and reduces MCH doctor idle', () => {
  const base = days(), fix = days(p => { p.sop.saringan.bypass.anc_doctor_only = true; });
  expect(mean(fix.map(docOnlyWait))).toBeLessThanOrEqual(0.6 * mean(base.map(docOnlyWait)));
  expect(mean(fix.map(mchIdle))).toBeLessThan(mean(base.map(mchIdle)));
});
test('CCMS down 08:00–10:00 undoes the fix unless the list was printed', () => {
  const ccms = (printed: boolean) => days(p => {
    p.sop.saringan.bypass.anc_doctor_only = true; p.sop.kontingensiCcms.printedList = printed;
    p.events.push({ kind: 'ccmsDown', from: 480, to: 600 });
  });
  expect(mean(ccms(false).map(docOnlyWait))).toBeGreaterThan(mean(ccms(true).map(docOnlyWait)));
});
```

- [ ] **Step 2:** Run `npm test -- acceptance`. If the jam test fails, **adjust only the placeholder values** in `src/sim/data/*.json` (nurse durations, the visit mix, the arrival curve), never the test thresholds. Note each change in the commit message so the user can see what was tuned.
- [ ] **Step 3:** Implement `scripts/sim-day.ts` with simple `process.argv` parsing and plain-text tables padded with `padEnd`. No dependencies.
- [ ] **Step 4:** Check the CLI:
  - `npm run sim -- --seed 1` prints a report containing `Lunch:`, `Balik:`, `anc_doctor_only` and `mo1`.
  - `npm run sim -- --days 20 --bypass anc_doctor_only` exits with code 0.
- [ ] **Step 5:** Run `npm test` and `npm run typecheck`. Everything should pass, and CI should be green on push.
- [ ] **Step 6:** Commit: `feat(sim): acceptance tests for the MCH jam and sim-day CLI`.
- [ ] **Step 7:** Show the user the 20-day comparison (default vs bypass vs CCMS down) from the CLI so they can check the numbers feel like a real KK. Record any corrections in the Google Sheet or JSON follow-up before Plan 2.
