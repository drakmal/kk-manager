# KK Manager: Easy Week Implementation Plan (Plan 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace v1's forms-first, isometric game with the approved Easy week:
- a difficulty page
- a top-down KK Jenis 4 clinic
- room queues
- popups as the only player action
- a 5-day week ending in the district visit

**Architecture:**
- Keep the simulation engine (Plan 1) and add four levers: room groups with turn-by-turn room assignment, an ultrasound add-on step, a "doctors eat at 13:00" SOP switch, and immediate, penalty-free changes (including replacing the day's events).
- A pure `src/popups/` module defines every popup: its trigger, its text and the effect of each choice.
- A pure `src/week/` module replaces `src/campaign/`. It holds the week state, the day plans, the end-of-day fold, the district review and saving.
- The day controller stops the clock while a popup is open.
- A top-down renderer replaces the isometric one.
- The old screens are deleted.

**Tech Stack:** unchanged. TypeScript, Preact, Canvas 2D, Vitest with happy-dom, and `@playwright/test` 1.57.0 (headless, GPU off).

**Spec:** `docs/superpowers/specs/2026-11-19-kk-manager-easy-week-design.md` (approved). The simulation rules of `docs/superpowers/specs/2026-11-19-kk-manager-design.md` still apply.

## Global Constraints

- Canvas 2D only, at most 30 fps, and the loop sleeps when idle. No browser preview on the user's machine; Playwright runs headless with `--disable-gpu`. Run e2e with `E2E_PORT=4174` (the user's own preview may hold 4173).
- `src/sim`, `src/popups` and `src/week` contain no browser code. `localStorage` is reached only through `browserStorage()`.
- English interface; Malay/Manglish dialogue. The player is the "Clinic Manager", never "FMS". "MCH", never "KIA". No MOH/KKM logos or names. No dental services.
- Under 500 KB of JS.
- Commit with the repo's git config email (`248782429+drakmal@users.noreply.github.com`). Never use `--global` settings in this repo.
- **Pushing to `main` publishes the live game.** Push only with the user's go-ahead at the time.

## Values this plan pins

| Item | Value |
|---|---|
| Difficulty boxes | Easy "KK Jenis 4 · Isu minimum" (playable) · Medium "KK Jenis 3 · Isu sederhana" (locked, "Coming soon") · Hard "KK Jenis 1 · Semua isu" (locked, "Coming soon") |
| Volume | MCH 40, OPD 120 a day. OPD shares: `opd_general` 0.92, `physio` 0.05, `nutrition` 0.03. Side-room patients go through primary triage and the OPD counter (spec §8 open item, settled as the builder's call). |
| Doctor rooms | `mchDoctor` "Bilik Doktor MCH": 2 seats, mo1 and mo2, with the ultrasound. `opdRoom1` "Bilik 1" (mo3, mo4) and `opdRoom2` "Bilik 2" (mo5, mo6): 2 seats each, `group: 'opdDoctor'`. |
| Room assignment | At registration, each group step goes to the group's rooms in turn (1, 2, 1, 2…), skipping rooms with no staffed seat. If no room is staffed, the turn order covers all rooms. |
| New stations | `xray` "X-Ray" (radiographer, 1 seat, 8–12 min). `emergency` "Bilik Kecemasan" (doctor role, 0 seats; drawn only). `physio` "Fisioterapi / Cara Kerja" (therapist, 1 seat, 20–30 min). `nutrition` "Pemakanan / Dietetik" (dietitian, 1 seat, 15–20 min). |
| X-ray | `opd_general` gets an `xray` step with chance 0.08 after the doctor. |
| Ultrasound | A `mchDoctor` step add-on of +5–10 min. Chance 1 for `anc_booking`, 0.3 for `anc_nurse_doctor` and `anc_doctor_only`. |
| Labels | "Kaunter MCH", "Saringan MCH", "Bilik Doktor MCH". Every "KIA" in labels and lines becomes "MCH". |
| Week schedule | Isnin: none. Selasa: none. Rabu: `printerDown` 09:00–12:00. Khamis: the EL morning popup. Jumaat: `emergencyWalkIn` at 10:30, station `opdRoom1`, minutes [30, 30]. |
| Printer, "Tulis tangan slip" | Registration +2 and pharmacy +2 until 12:00 (`printerRegistrationExtra` becomes 2) |
| Printer, "Panggil IT, tunggu" | `staffAway` for pt1, pt2 and pt3, 09:00–09:20; the printer event ends at 09:20 |
| EL (Khamis, before opening) | mo2 is away. **Relief:** `relief1` "Dr. Relief (KK Seri Melur)" sits in mchDoctor. **Pinjam:** mo5 moves from opdRoom2 to mchDoctor for the day. |
| Idle-doctor trigger | At 08:30 (510) and 14:30 (870): ancNurse or mchTriage has someone waiting, some seated MCH doctor has started no patient in the session (morning: `lastStartAt === null`; afternoon: `lastStartAt < 840`), Saringan isn't on, and the popup wasn't dismissed today |
| Lunch trigger | Isnin 12:50 (770), if any doctor room's queue is 5 or more. N in the text = the largest doctor-room queue. |
| Mood emoji | 😊 wait < 15 · 😐 15–29 · 😟 30–59 · 😠 ≥ 60 minutes |
| District grade (5 days) | A: P ≥ 70, H ≥ 80, lunch on time ≥ 3. B: P ≥ 55, H ≥ 70. C: P ≥ 40. Otherwise D. |
| Save | One key, `kkm.week.easy`. `WeekSave.version` 2. Saved when each day starts (before the morning popups). Old v1 keys `kkm.save.1`–`3` are ignored. |

## Review Focus

1. **Two popups due at the same moment**, such as lunch and the 14:30 idle check, or the EL morning popup and an in-day popup. They come one after another and none is lost. Test in Task 4.
2. **"Skip ahead" when a popup is due.** It stops at the popup and never answers for the player. Test in Task 4.
3. **Reloading mid-week or mid-day.** It resumes at the start of the saved day, and earlier choices (Saringan, Laluan Khas) stay on. Test in Tasks 5 and 8.
4. **A stored save from v1 or a damaged week save.** The Easy box shows Start, never a crash. Test in Task 5.
5. **A doctor room with no staffed seat.** New patients aren't sent there, and patients already waiting there are counted as unfinished, not lost. Test in Task 1.

---

## File Structure

```
src/sim/            (Task 1: groups, add-ons, lunchOnTime, immediate changes; Task 2: Jenis 4 data)
src/popups/popups.ts          # PopupDef list, Popup, Choice, Effect, due(), apply
src/week/types.ts, week.ts    # WeekState, createWeek, dayPlanFor, endDay, dayName
src/week/district.ts          # moved from campaign, rescaled for 5 days
src/week/storage.ts           # SaveStorage, memoryStorage, browserStorage (moved from campaign/saves.ts)
src/week/saves.ts             # WeekSave v2, saveWeek, loadWeek, parseWeekSave
src/week/controller.ts        # WeekController: morning → day → report → (district) → next morning
src/game/topdown.ts, layout.ts, scene.ts, draw.ts, hit.ts   (Task 6, replacing iso.ts)
src/ui/DifficultyScreen.tsx, PopupDialog.tsx  (new); App.tsx, Hud.tsx, GameScreen.tsx, ReportScreen.tsx, DistrictScreen.tsx (changed)
deleted: src/campaign/*, src/game/iso.ts, src/game/scenarios.ts, src/ui/{PlanScreen,RosterEditor,SopCards,ScenarioPicker,PausePanel,Toasts,TitleScreen,NightScreen}.tsx and their tests
```

---

### Task 1: Simulation levers for the Easy week

**Files:**
- Modify: `src/sim/types.ts`, `engine.ts`, `events.ts`, `patients.ts`, `routing.ts`, `data.ts`, `plan.ts`
- Test: `tests/sim/rooms.test.ts`

**Interfaces (produces):**

```ts
type Role = … | 'radiographer' | 'therapist' | 'dietitian';
interface StationDef { …; group?: string }              // rooms sharing a routing name, e.g. 'opdDoctor'
interface StepDef { station: StationId /* or a group id */; …; addOn?: { chance: number; minutes: [number, number] } }
interface SopSettings { …; lunchOnTime: boolean }       // default false (defaultDayPlan)
type ClinicEvent = … | { kind: 'emergencyWalkIn'; at: Minute; minutes: [number, number]; station?: StationId }
interface PlanChange { sop?; roster?; events?: ClinicEvent[] }   // events: replaces the day's event list in place
interface StaffState { …; lastStartAt: Minute | null }  // minute this person last started a patient
Sim.applyChange(change: PlanChange, opts?: { immediate?: boolean; free?: boolean }): { effectiveAt: Minute }
//   immediate: effectiveAt = now (applied before the next step). free: no changeCount (no staff penalty).
export function groupRooms(data: GameData, group: string): StationDef[]   // from data.ts, in data order
export function emergencyDoctor(sim: Sim, station: StationId): StaffState | null   // from events.ts: who the emergency would take now (same rule the event uses)
```

**Rules:**
- **Validation.** A step's `station` must be a station id or a group id. A group's stations must share a role. `addOn.chance` must be in [0, 1].
- **Default minutes.** A step that names a group takes its default minutes from the group's first room.
- **Ultrasound add-on.** `generatePatients`/`makePatient` draw the add-on once per patient: with probability `chance`, add `rng.int(min, max)` to that step's minutes.
- **Room assignment.** When registration finishes (the existing `filterRoute` point in `engine.advance`), each remaining step whose station is a group id is replaced by one room, per the pinned rule. Each group keeps its own turn counter in the sim.
- **Lunch on time.** With `lunchOnTime`, a person in a doctor-role station starts lunch at the first minute ≥ 13:00 when they're not serving, even if the queue isn't empty. Without it, the existing rule applies.
- **Emergency by station.** The emergency picks the first free doctor seated in `station` (default: the first room of group `opdDoctor`, or `opdDoctor` if no group exists). The existing finish-the-patient-first rule still applies.
- **Replacing events.** `PlanChange.events` replaces the contents of the sim's own event array (same array object), so the event hooks see the change.

- [ ] **Step 1: Write the failing tests** in `tests/sim/rooms.test.ts`. Use a fixture with group `g` made of rooms `r1` and `r2` (doctor role, 1 seat each), plus the existing clerk counter `a`.

```ts
test('registration assigns group steps to rooms in turn', () => { /* 4 patients a→g: rooms r1,r2,r1,r2 */ });
test('a room with no staffed seat is skipped by assignment', () => { /* r2 empty → all to r1 */ });
test('patients already waiting at a room that loses its doctor stay there and are counted unfinished', () => {});
test('an ultrasound add-on with chance 1 adds 5–10 minutes to that step', () => {});
test('lunchOnTime sends a free doctor to lunch at 13:00 even with a queue', () => {});
test('emergencyWalkIn with a station takes a doctor from that room only', () => {});
test('applyChange immediate+free takes effect now and adds no changeCount', () => {});
test('PlanChange.events ends a printer outage early', () => { /* printerDown 540–720, change at 545 to 540–560 → minute 561 not slowed */ });
test('Plan 1–3 behaviour is unchanged when the new fields are absent', () => { /* tests/sim/baseline/reports.json still deep-equals */ });
test('validation rejects a step naming an unknown station or group', () => {});
```

- [ ] **Step 2:** Run `npx vitest run tests/sim/rooms.test.ts`. Expected: FAIL (new fields missing).
- [ ] **Step 3:** Implement. Existing data has no groups, so v1 data keeps working.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: all pass. The baseline test must pass with `lunchOnTime: false` added to the default SOP; if the baseline JSON's SOP-free reports differ, that's a bug.
- [ ] **Step 5:** Commit: `feat(sim): room groups, ultrasound add-on, lunch on time, immediate changes`.

---

### Task 2: The KK Jenis 4 data

**Files:**
- Modify: `src/sim/data/stations.json`, `visitTypes.json`, `staff.json`, `arrivals.json`, `tuning.json`
- Test: `tests/sim/jenis4.test.ts`. Also update data-count assertions in existing sim tests that break.

**Rules:** apply the pinned table: stations and labels, `opdRoom1`/`opdRoom2` in group `opdDoctor` (remove `opdDoctor`), the `opd_general` steps naming `opdDoctor` (now a group), X-ray, side rooms, ultrasound add-ons, and `printerRegistrationExtra: 2`. New staff:

| id | name | role | homeStation |
|---|---|---|---|
| `jxr1` | Juru X-Ray Lim | radiographer | xray |
| `jp1` | Jurupulih Aisyah | therapist | physio |
| `pd1` | Pegawai Dietetik Nadia | dietitian | nutrition |

mo3 and mo4 go to opdRoom1; mo5 and mo6 go to opdRoom2.

- [ ] **Step 1: Write the failing tests**

```ts
test('the Jenis 4 clinic has its rooms and no dental', () => { /* ids include opdRoom1, opdRoom2, xray, emergency, physio, nutrition; no id or label matches /dental|pergigian/i */ });
test('labels say MCH, never KIA', () => {});
test('OPD rooms share group opdDoctor with two seats each', () => {});
test('a simulated Isnin splits OPD patients evenly between Bilik 1 and Bilik 2 (±2)', () => {});
test('booking visits always have an ultrasound add-on', () => {});
test('a default day still finishes by 19:00 with most patients seen', () => { /* runDay seed 1: unfinished ≤ 10 */ });
```

- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Edit the JSON files. Run `npm run sim -- --days 5` and note the means (OPD wait, lunch outcome, satisfaction) in the commit message.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: all pass. Fix any v1 test that hard-coded the old station list (ledger each one).
- [ ] **Step 5:** Commit: `feat(data): KK Jenis 4 clinic for the Easy week`.
- [ ] **Step 6 (user go-ahead):** Update the Google Sheet's Stations, Visit types, Visit steps and Staff tabs to match, and add a "Group" and an "Ultrasound add-on" column. Read them back. Note the change in the Read me.

---

### Task 3: Popups

**Files:**
- Create: `src/popups/popups.ts`
- Test: `tests/popups/popups.test.ts`

**Interfaces (produces):**

```ts
interface Choice { id: string; label: string }
interface Popup { id: string; from: string; text: string; choices: Choice[] }   // news: one choice { id: 'ok', label: 'OK' }
interface WeekFlags { saringan: boolean; laluanKhas: boolean }
interface DayContext { day: number /* 1–5 */; now: Minute; sim: Sim; data: GameData; flags: WeekFlags; shown: Set<string>; dismissedIdle: boolean }
interface Effect { change?: PlanChange; flags?: Partial<WeekFlags>; dismissIdle?: boolean }
interface PopupDef {
  id: string;
  /** Checked once per simulated minute, before the step. */
  due(ctx: DayContext): boolean;
  build(ctx: DayContext): Popup;
  effect(choiceId: string, ctx: DayContext): Effect;
}
const IN_DAY_POPUPS: PopupDef[];     // idleDoctor, lunch, laluanKhas, printer, emergency (in this order)
function duePopups(ctx: DayContext): PopupDef[];   // the defs due now that aren't in ctx.shown, in list order
// Morning (before the clinic opens), decided before the sim exists:
interface MorningPopup { popup: Popup; plan(choiceId: string, plan: DayPlan): DayPlan }
function morningPopups(day: number): MorningPopup[];   // Khamis → the EL popup; otherwise []
function sopWithFlags(sop: SopSettings, flags: WeekFlags): SopSettings
//   saringan → bypass.anc_doctor_only = true
//   laluanKhas → enabled, groups ['elderly', 'pregnant'], stations [mchRegistration, opdRegistration, mchTriage, opdTriage, mchDoctor, opdRoom1, opdRoom2, pharmacy]
```

**Texts and choices (exact copy):**

| id | from | text | choices (id: label) |
|---|---|---|---|
| `idleDoctor` | "Kak Ida (PT)" | "Pesakit semakin ramai mendaftar, doktor belum terima pesakit." | `saringan`: "Hantar ibu 'doktor sahaja' terus ke doktor" · `biasa`: "Ikut giliran biasa" |
| `lunch` | "JM Noraini" | "Masih ada {N} pesakit depan bilik doktor." | `makan`: "Doktor makan dulu, sambung 2 petang" · `habis`: "Habiskan dulu" |
| `laluanKhas` | "Pakcik Osman" | "Saya dah berdiri sejam, tak ada tempat duduk. Orang tua pun kena beratur ke?" | `buka`: "Buka Laluan Khas" · `tunggu`: "Minta dia tunggu" |
| `printer` | "Encik Azman (PT)" | "Printer tak connect. Slip tak keluar." | `tangan`: "Tulis tangan slip" · `it`: "Panggil IT, tunggu" |
| `emergency` | "JM Devi" | "Kes kecemasan: sakit dada. {doctor} ke Bilik Kecemasan, lebih kurang 30 minit." ({doctor} = the name of `emergencyDoctor(sim, 'opdRoom1')`) | `ok`: "OK" |
| `el` (morning) | "Dr. Hafiz" | "Dr, saya demam, esok nak EL 🙏" | `relief`: "Minta relief klinik lain" · `pinjam`: "Pinjam doktor OPD" |

**Effects:** follow the pinned table. All in-day changes use `applyChange(change, { immediate: true, free: true })` (the controller does this). `printer/it` emits `PlanChange.events`: the printer event's `to` becomes now+20, plus `staffAway` for pt1–pt3 from now to now+20. The Saringan and Laluan Khas choices set flags; the SOP comes from `sopWithFlags`.

- [ ] **Step 1: Write the failing tests:**
  - each trigger's true and false cases (idle: Saringan on → not due, dismissed → not due, doctor already started → not due)
  - each choice's effect
  - `duePopups` order and its `shown` filter
  - morning EL: relief seats relief1 and removes mo2; pinjam moves mo5 and removes mo2
  - the copy table above, verbatim
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat(popups): Easy week popups with triggers and effects`.

---

### Task 4: The day controller pauses for popups

**Files:**
- Modify: `src/game/controller.ts`
- Test: `tests/game/popups-controller.test.ts`. Update `tests/game/controller.test.ts` where the removed scenario API was used.

**Interfaces:**

```ts
createController(data, seed, init?: { plan?: DayPlan; day?: number; flags?: WeekFlags; popups?: PopupDef[] })
DayController gains:
  readonly popup: Popup | null;           // the open popup; the clock doesn't advance while set
  readonly flags: WeekFlags;              // updated by choices
  answer(choiceId: string): void;         // applies the effect, then opens the next due popup if any
  skipAhead(): void;                      // replaces finishNow: runs to the next popup or the end of the day
DayController loses: setScenario, scenarioId, replay, newDay, applyChange (popups are the only lever)
```

**Rules:**
- Before each simulated minute, `frame` and `skipAhead` collect `duePopups`. If any are due, they queue (in order), the first opens, and stepping stops.
- `answer` applies the effect with `{ immediate: true, free: true }` and marks the popup shown. If another queued popup is still due, it opens next; otherwise stepping continues.
- Pause and speed work as before. Pausing costs nothing.
- At `start()`, the plan's SOP is `sopWithFlags(plan.sop, flags)`.

- [ ] **Step 1: Write the failing tests:**
  - a popup stops the clock: `frame` doesn't advance `sim.now` while a popup is open
  - answering resumes the clock
  - two popups due at the same minute open one after the other (Review Focus 1)
  - `skipAhead` stops at a due popup, and `popup` is set without being answered (Review Focus 2)
  - the Saringan choice sets `flags.saringan` and the day's live SOP
  - pausing adds no staff penalty
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Remove the deleted API and fix its callers in `src/game` only; UI callers are rewritten in Task 7.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: `src/game` and `src/sim` tests pass. UI tests that use removed APIs may fail until Task 7: list them in the ledger.
- [ ] **Step 5:** Commit: `feat(game): day controller pauses for popups; skip ahead`.

---

### Task 5: The week

**Files:**
- Create: `src/week/types.ts`, `week.ts`, `district.ts`, `storage.ts`, `saves.ts`, `controller.ts`
- Delete: `src/campaign/` and `tests/campaign/` (move `fakeReport` to `tests/week/helpers.ts`)
- Test: `tests/week/week.test.ts`, `saves.test.ts`, `controller.test.ts`

**Interfaces:**

```ts
interface DaySummary { day: number; patient: number; hcw: number; lunch: LunchOutcome; balik: BalikOutcome; overtime: number; docOnlyWait: number }
interface WeekState { version: 2; difficulty: 'easy'; seed: number; week: number; day: number /* 1–5 */; flags: WeekFlags; history: DaySummary[] }
const WEEK_DAYS = 5; const DAY_NAMES = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat'];
createWeek(seed: number): WeekState
dayName(day: number): string
dayPlanFor(data: GameData, state: WeekState): DayPlan     // seed = seed*1000 + week*10 + day; schedule events; sop from flags
endDay(state: WeekState, report: DayReport, flags: WeekFlags): WeekState   // pushes summary, keeps flags, day+1 (stays 6 = "week done")
nextWeek(state: WeekState): WeekState                     // week+1, day 1, history [], flags kept
districtReview(history: DaySummary[]): DistrictReview     // first 5 days; thresholds pinned; lines as Plan 3 (copy says "minggu ini")
// storage.ts: SaveStorage, memoryStorage(), browserStorage() moved unchanged from campaign/saves.ts
interface WeekSave { version: 2; savedAt: string; state: WeekState }
saveWeek(storage, save): boolean; loadWeek(storage): WeekSave | null   // key 'kkm.week.easy'; damaged or other version → null
type WeekPhase = 'morning' | 'day' | 'report' | 'district';
interface WeekController {
  readonly phase: WeekPhase; readonly state: WeekState; readonly day: DayController | null;
  readonly morning: Popup | null;          // the open morning popup
  readonly review: DistrictReview | null; readonly saveAvailable: boolean;
  answerMorning(choiceId: string): void;   // when the last morning popup is answered, the day starts
  continueAfterReport(): void;             // → next morning, or district after Jumaat
  playAnotherWeek(): void;                 // district → morning of week+1
  subscribe(l: () => void): () => void;
}
startWeek(data, storage, seed, now: () => string): WeekController
resumeWeek(data, storage, save: WeekSave, now: () => string): WeekController
```

**Rules:**
- **Morning.** Autosave, then show `morningPopups(day)` one at a time. If there are none, start the day straight away.
- **Starting a day.** Build the plan from `dayPlanFor` plus the morning choices, then create the `DayController` with `IN_DAY_POPUPS` and the week's flags.
- **Report.** On report, `endDay(state, report, day.flags)`.
- **Resuming.** `resumeWeek` always opens the morning of the saved day.

- [ ] **Step 1: Write the failing tests:**
  - the schedule per day (Rabu has the printer, Jumaat the emergency in opdRoom1)
  - flags carry over from day to day and reach the SOP
  - Khamis morning shows the EL popup, and its choice shapes the roster
  - the week loop morning → day → report → … → district after Jumaat → `playAnotherWeek`
  - the save round-trip
  - a v1 save under `kkm.save.1` is ignored, and a damaged `kkm.week.easy` gives null (Review Focus 4)
  - resuming a save made on Rabu opens Rabu morning with the flags kept (Review Focus 3)
  - storage that fails gives `saveAvailable` false, and play goes on
  - the 5-day district thresholds
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. Expected: sim, game, popups and week tests pass.
- [ ] **Step 5:** Commit: `feat(week): Easy week with morning popups, saves and the district visit`.

---

### Task 6: Top-down renderer

**Files:**
- Create: `src/game/topdown.ts`
- Rewrite: `src/game/layout.ts`, `scene.ts`, `draw.ts`, `hit.ts`
- Delete: `src/game/iso.ts`, `src/game/scenarios.ts`
- Test: rewrite `tests/game/layout.test.ts`, `scene.test.ts`, `draw.test.ts`, `hit.test.ts`; delete `tests/game/iso.test.ts`; add `tests/game/topdown.test.ts`

**Interfaces:**

```ts
// topdown.ts
interface View { originX: number; originY: number; tile: number }
toScreen(p: { x: number; y: number }, v: View): { x: number; y: number }   // x*tile+originX, y*tile+originY
fromScreen(p, v): { x: number; y: number }
fitView(width: number, depth: number, canvasW: number, canvasH: number): View   // 16 px margin, whole tiles
// layout.ts: buildLayout(data) → ClinicLayout { width: 32, depth: 20, rooms: RoomLayout[], areas, entrance, exit }
//   RoomLayout { station; label; rect; seats; chairs; queue: spots[]; furniture: { kind: 'desk'|'bed'|'ultrasound'|'xray'|'counter'|'shelf'; x; y; w; h }[] }
// scene.ts: Person gains mood: '😊'|'😐'|'😟'|'😠'|null (staff null); moodFor(waitMinutes): mood per the pinned thresholds
// draw.ts: buildDrawList(scene, view, { lowGraphics }) → commands in paint order: floor, rooms (fill + walls), furniture, labels, people (body circle, head circle, mood emoji text above patients)
```

**Layout (tiles; x right, y down; entrance at the bottom):**
- **Bottom row (y 15–20):**
  - primaryTriage (13–17)
  - Kaunter MCH (2–6) and Saringan MCH (6–10), left of it
  - Kaunter OPD (19–23) and Saringan OPD (23–27), right of it
  - pharmacy (27–32)
  - entrance at x 15
- **Left wing (MCH):**
  - ANC nurse (0–7, 0–5)
  - MCH doctor (7–13, 0–5) with the ultrasound cart
  - immunisation (0–5, 5–10)
  - MCH waiting area (5–13, 5–14)
- **Right wing (OPD):**
  - Bilik 1 (19–25, 0–5)
  - Bilik 2 (25–32, 0–5)
  - OPD waiting area (19–32, 5–14)
- **Middle column (13–19):**
  - lab (13–16, 0–4) and X-ray (16–19, 0–4)
  - emergency (13–19, 4–8)
  - physio/OT (13–16, 8–12) and nutrition (16–19, 8–12)
  - a corridor (13–19, 12–15)

The builder may shift rooms by a tile to fit labels. Ledger any shift.

**Rules:**
- Keep the existing draw-list → paint split, the 30 fps cap and the sleeping loop.
- `lowGraphics` drops furniture detail and shadows, but keeps the mood emoji.
- Hit-testing returns the person or room under the pointer, for the info card.

- [ ] **Step 1: Write the failing tests:**
  - `toScreen`/`fromScreen` round-trip
  - `fitView` keeps the whole floor inside the canvas
  - every station from Task 2 has a room inside the floor, and no rooms overlap
  - each doctor room has a queue spot per waiting patient up to 12, then the overflow
  - mood thresholds 14→😊, 15→😐, 30→😟, 60→😠
  - the draw list draws patients' emoji above their heads and has no isometric commands
  - a hit test on a person returns that person
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`.
- [ ] **Step 5:** Commit: `feat(game): top-down clinic with mood emoji`.

---

### Task 7: Screens

**Files:**
- Create: `src/ui/DifficultyScreen.tsx`, `src/ui/PopupDialog.tsx`
- Rewrite: `src/ui/App.tsx`, `Hud.tsx`, `GameScreen.tsx`, `ReportScreen.tsx`, `DistrictScreen.tsx`, `styles.css`
- Delete: `src/ui/{PlanScreen,RosterEditor,SopCards,ScenarioPicker,PausePanel,Toasts,TitleScreen,NightScreen}.tsx`, `src/ui/download.ts`, and their tests
- Test: `tests/ui/difficulty.test.tsx`, `popup.test.tsx`, `week.test.tsx`; update `game.test.tsx`, `report.test.tsx`, `district.test.tsx`, `app.test.tsx`

**Interfaces and copy:**
- **DifficultyScreen:**
  - heading "KK Manager", subheading "Pilih klinik anda"
  - three `<section>` boxes, each with an `aria-label` of its title: "Easy", "Medium", "Hard"
  - each box shows the type line and the issue line
  - Easy has **Start**, or **Continue (<dayName>)** and **Start over** when a save exists
  - Medium and Hard have a disabled "Coming soon"
  - when storage is unavailable: "Progress can’t be saved in this browser."
- **PopupDialog:**
  - `role="dialog"`, `aria-modal="true"`, labelled by the sender
  - shows the sender in bold, the text, and the choice buttons
  - the first button takes focus when the dialog opens
  - it draws over the dimmed clinic, and Escape does nothing (there must be a choice)
- **Hud:**
  - "<dayName> HH:MM", Pause, 1× 2× 4×, both meters, the lunch chip, "Low graphics", and **Skip ahead**
  - no Finish day and no pause panel
- **ReportScreen:**
  - heading "End of day · <dayName>"
  - lunch and balik headlines, both scores, the wait table, the bottlenecks
  - **Continue to <next dayName>**, or **Continue** before the district visit
- **DistrictScreen:** "Minggu <N>" in the heading, the grade, the numbers, the remarks, and **Play another week**.
- **App:** difficulty → week phases (morning popup over the dimmed clinic, then game, then report, then district). Storage defaults to `browserStorage()`; tests pass `memoryStorage()`.

- [ ] **Step 1: Write the failing tests:**
  - **Difficulty boxes:** the three boxes; Start and Continue/Start over; locked boxes have no enabled button; the storage note.
  - **Popup dialog:** it shows the copy; clicking a choice calls `answer`; focus starts on the first button.
  - **Week UI (`week.test.tsx`):**
    - Start → Isnin popups answered → Skip ahead until the report → Continue to Selasa
    - remounting with the same storage shows "Continue (Selasa)"
    - storage blocked shows the note, and play continues
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement and delete the old files.
- [ ] **Step 4:** Run `npm test`, `npm run typecheck` and `npm run build` (under 500 KB). Expected: all pass, with no reference to deleted modules.
- [ ] **Step 5:** Commit: `feat(ui): difficulty page, popups and the week screens; remove v1 screens`.

---

### Task 8: End-to-end and docs

**Files:**
- Rewrite: `tests/e2e/smoke.spec.ts`. Delete `tests/e2e/campaign.spec.ts`.
- Modify: `README.md`, `scripts/sim-day.ts` (drop `--bypass` and `--laluan-khas` if their SOP fields changed; keep `--seed` and `--days`)

**Steps:**
- [ ] **Step 1: Rewrite the e2e** (headless, GPU off): open the page, see the three boxes, Start Easy, answer every popup that appears (click its first choice), Skip ahead until the report, Continue to Selasa, reload, and see "Continue (Selasa)". Also check there are no page errors.
- [ ] **Step 2:** Run `E2E_PORT=4174 npm run e2e`. Expected: 1 passed.
- [ ] **Step 3:** Update the README: what the game is now, the Easy week, how to run it, and the live address https://drakmal.github.io/kk-manager/ (replacing "Planned home").
- [ ] **Step 4:** Run `npm test`, `npm run typecheck` and `npm run build`. Expected: all pass.
- [ ] **Step 5:** Commit: `test(e2e): play an Easy day and resume after reload; docs`.
- [ ] **Step 6 (user go-ahead):** Push to `main`, which republishes the live game. Watch the CI and Pages runs in the foreground, then check https://drakmal.github.io/kk-manager/ returns 200 with the title "KK Manager".
