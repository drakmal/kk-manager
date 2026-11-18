# KK Manager: Playable Day (Plan 2 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one full clinic day playable in the browser:
- an isometric clinic view where patients and staff move between rooms
- a morning plan screen (roster, SOP cards, choice of day)
- pause and adjust during the day, at a cost
- an end-of-day report

**Architecture:**
- Plan 1's headless simulation stays the single source of truth.
- A small `DayController` owns the phase (plan → running ⇄ paused → report) and a `GameClock`, which turns real time into simulation minutes.
- Pure scene code turns `sim.snapshot()` into positioned people, and a Canvas 2D painter draws them back to front.
- Menus are Preact components over the canvas.
- Vite builds a static site for `drakmal.com/kk-manager/`.

**Tech Stack:**
- TypeScript, plus Plan 1's simulation
- Vite with `@preact/preset-vite`
- Preact
- Canvas 2D (no WebGL)
- Vitest with happy-dom and `@testing-library/preact`
- `@playwright/test`, headless only

**Spec:** `docs/superpowers/specs/2026-11-19-kk-manager-design.md` (sections 6.2–6.10 and 7). Builds on Plan 1: `docs/superpowers/plans/2026-11-19-kk-manager-01-simulation-core.md`.

**Out of scope (Plan 3):**
- the night-before phase and its messages
- the campaign, progression and Pasangan Mentor
- saves (localStorage slots, export/import)
- publishing to GitHub Pages

In Plan 2 a "day" is a free-play day: the player picks a day type, plans, and plays.

Also left for Plan 3:
- the rare "big lever" emergency actions (spec 6.2, marked as a call). During the day, the Pinjam Doktor OPD card can still be switched on from the pause panel.
- complaints (aduan).

## Global Constraints

- **Rendering:**
  - Canvas 2D only, no WebGL.
  - At most 30 frames per second.
  - No frames are requested while paused or on the plan or report screens, unless a walking animation is still finishing.
  - A **low graphics** setting moves people straight to their spot, with no walking and no shadows.
- **Never open a browser preview on the user's machine.**
  - Unit and UI tests run in happy-dom.
  - Playwright runs headless Chromium only, launched with `--disable-gpu` (CPU-only, nothing on screen). Prefer running it in CI or a cloud session.
  - A local check of the built site is `vite preview` in the background plus a `curl` status-code check, nothing more.
- **Layering:**
  - `src/sim/` stays browser-free.
  - Game and UI code import the simulation only through `src/sim/index.ts`.
  - `src/game/` (pure logic and Canvas drawing) has no Preact.
  - `src/ui/` (Preact) has no drawing code apart from mounting the canvas.
- **Build:**
  - `vite.config.ts` has `base: '/kk-manager/'`.
  - Total JavaScript in `dist/assets` is under 500 KB before gzip (spec 7).
- **Wording:**
  - The interface is in English, but SOP card names stay in Malay as in the spec (e.g. Saringan di Kaunter).
  - Dialogue, toasts and speech bubbles are natural Malay/Manglish.
  - The player is the "Clinic Manager". Never use "FMS".
  - No MOH/KKM logos or names.
- **Layout:** desktop-first, 1024 px wide or more. No phone layout yet.
- **Accessibility:**
  - Every control is a real `<button>`, `<input>` or `<select>` with a visible or `aria-label` name.
  - The colour-coded purpose dots also have a text legend.

## Review Focus

1. **The tab goes into the background and comes back.** Browsers pause `requestAnimationFrame`, so the first frame back has a huge `dt`. The clock must step at most 60 game minutes per frame rather than freezing the page. Test in Task 6.
2. **A high-DPI screen (`devicePixelRatio` 2) or a resized window.** Clicks must still hit the room under the cursor and the canvas must stay sharp. Test in Task 5 (`toCanvasPoint`).
3. **Starting a day with a station nobody is rostered to.** The player should see a warning on the plan screen before starting (the sim would otherwise run to 19:00). Test in Task 7.
4. **Two mid-day changes inside one briefing delay.** Both apply in order and each costs staff satisfaction. Test in Task 1.
5. **A day that hits the 19:00 hard stop with patients unfinished.** The controller must still reach the report, which shows the unfinished count and no `NaN`. Test in Task 6.

---

## File Structure

```
index.html, vite.config.ts, playwright.config.ts
src/sim/            (Plan 1; Task 1 adds applyChange, liveScores, midDayChangePenalty)
src/game/
  iso.ts            # isometric projection, inverse, fitView
  layout.ts         # fixed clinic floor plan: rooms, seats, queue spots
  appearance.ts     # deterministic looks per person; purpose-dot colours
  jokes.ts          # Malay/Manglish bubble and toast lines
  scene.ts          # snapshot → positioned people; interpolation; bubbles
  draw.ts           # Canvas 2D painter
  hit.ts            # hit-testing and pointer → canvas coordinates
  clock.ts          # GameClock: speeds, quiet fast-forward, catch-up cap
  scenarios.ts      # day types for free play
  controller.ts     # DayController: phases, sim, changes, report
  loop.ts           # rAF loop with 30 fps cap that sleeps when idle
src/ui/
  main.tsx, App.tsx, useController.ts, styles.css
  PlanScreen.tsx, RosterEditor.tsx, SopCards.tsx, ScenarioPicker.tsx
  GameScreen.tsx, Hud.tsx, ClinicCanvas.tsx, PausePanel.tsx, Toasts.tsx
  ReportScreen.tsx
tests/game/*.test.ts, tests/ui/*.test.tsx, tests/e2e/smoke.spec.ts
scripts/check-size.mjs
```

---

### Task 1: Simulation: mid-day changes and live scores

**Files:**
- Modify: `src/sim/types.ts`, `src/sim/engine.ts`, `src/sim/scoring.ts`, `src/sim/index.ts`, `src/sim/data/tuning.json`
- Test: `tests/sim/changes.test.ts`

**Interfaces:**
- Consumes: Plan 1's `createSim`, `createDaySim`, `StaffState`, `staffScore`, `patientScore`, `lunchOutcome`.
- Produces:

```ts
// types.ts
interface PlanChange { sop?: SopSettings; roster?: Record<StationId, StaffId[]> }
// Tuning gains: midDayChangePenalty: number   (tuning.json: 5)
// StaffState gains: changeCount: number
// Sim gains:
applyChange(change: PlanChange): { effectiveAt: Minute }          // effectiveAt = now + briefingDelayMinutes
readonly pendingChanges: readonly { change: PlanChange; at: Minute }[]
// scoring.ts
liveScores(sim: Sim, data: GameData): { patient: number; hcw: number; lunch: LunchOutcome | 'pending' }
```

**Rules:**
- `createSim` deep-clones the `plan` it's given, so changes never touch the caller's object.
- **When a change takes effect.** At the start of each minute, before the event hooks, every pending change with `at ≤ now` takes effect, in the order it was made:
  - `sop` replaces the sim's `plan.sop`. Routing reads it for patients who finish registration from then on.
  - `roster` assigns staff to stations, capped at each station's seats. Someone who is mid-consultation moves once that patient is done, the same as Pinjam.
  - Every rostered staff member's `changeCount` goes up by 1.
- **Score cost:** `staffScore` also subtracts `changeCount × midDayChangePenalty`.
- **`liveScores`:**
  - `patient`: the mean `patientScore` of finished patients, plus each waiting or in-service patient scored as if they finished now. 100 when there are none.
  - `hcw`: the mean `staffScore` of rostered staff.
  - `lunch`: `'pending'` before 13:00. After that, `lunchOutcome` over the doctors' lunch starts so far, where a doctor not yet at lunch counts as `null` once `now > lunchLateCutoff`.
- **The data sheet (needs the user's go-ahead):**
  - Add a row `midDayChangePenalty | 5 | Staff satisfaction points lost per mid-day SOP or roster change` to the Tuning tab of the Google Sheet "KK Manager game data", using the Sheets connector.
  - Add the key to the tab-to-JSON mapping memory.

- [ ] **Step 1: Write the failing tests**

```ts
test('createSim does not mutate the caller plan', () => { /* applyChange sop; original plan.sop unchanged */ });
test('a change takes effect after the briefing delay', () => {
  /* step to 540, applyChange({sop: bypass anc_doctor_only}) → effectiveAt 550;
     a doctor-only mother finishing registration at 545 keeps ancNurse, one at ≥ 550 skips it */
});
test('two changes inside one delay apply in order and both cost', () => {
  /* change A at 540 (bypass on), change B at 545 (bypass off) → after 555 bypass is off; mo1.changeCount === 2 */
});
test('roster change moves a doctor between patients only', () => { /* mo3 moved opd→mch while serving: moves after finishing */ });
test('staffScore subtracts change penalty', () => { /* changeCount 2 → 100 - 10 */ });
test('liveScores: 100 with nobody yet, pending lunch before 13:00, numbers in 0..100 mid-day', () => {});
```

- [ ] **Step 2:** Run `npm test -- changes`. It should fail.
- [ ] **Step 3:** Implement as above. Add `midDayChangePenalty` to `Tuning`, to the validation check that the field is present, and to `tuning.json`.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. All tests should pass, including Plan 1's 60.
- [ ] **Step 5:** Commit: `feat(sim): mid-day plan changes with briefing delay and staff cost; live scores`.
- [ ] **Step 6 (user go-ahead):** Add the Tuning row to the Google Sheet. Read it back with `get_values` to confirm.

---

### Task 2: Vite + Preact scaffold

**Files:**
- Create: `index.html`, `vite.config.ts`, `src/ui/main.tsx`, `src/ui/App.tsx` (placeholder heading), `src/ui/styles.css`, `scripts/check-size.mjs`
- Modify: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.github/workflows/ci.yml`
- Test: `tests/ui/app.test.tsx`

**Interfaces:**
- Produces:
  - `npm run dev`, `npm run build` (that is, `vite build`, then `node scripts/check-size.mjs`) and `npm run preview`.
  - `App` renders `<h1>KK Manager</h1>` for now. Task 9 replaces it.

- [ ] **Step 1: Configuration.**
  - Add the dev dependencies `vite`, `@preact/preset-vite`, `preact`, `happy-dom`, `@testing-library/preact`, at current stable versions.
  - `tsconfig.json`: add `"jsx": "react-jsx"`, `"jsxImportSource": "preact"` and the `DOM` lib.
  - `vitest.config.ts`: use `environment: 'happy-dom'` for `tests/ui/**` and `tests/game/**`, and keep `node` for `tests/sim/**`, via `environmentMatchGlobs` or projects, whichever the installed Vitest supports.
  - `vite.config.ts` uses `base: '/kk-manager/'`.
- [ ] **Step 2:** Write the failing test `renders the title`, which expects `screen.getByRole('heading', { name: 'KK Manager' })`.
- [ ] **Step 3:** Run `npm test -- app`. It should fail.
- [ ] **Step 4:**
  - Implement `main.tsx` (mount `App` into `#app`), `App.tsx` and `index.html` (with the title "KK Manager", `lang="en"`, and `<div id="app">`).
  - `check-size.mjs` sums the bytes of `dist/assets/*.js`. It exits 1 if the total is over 500 KB, and prints the total.
- [ ] **Step 5:** Run `npm test`, `npm run typecheck` and `npm run build`. All should pass, and the size line should print under 500 KB.
- [ ] **Step 6:** Add a `npm run build` step to the CI workflow. Commit: `chore(ui): vite + preact scaffold with size budget`.

---

### Task 3: Isometric projection and clinic layout

**Files:**
- Create: `src/game/iso.ts`, `src/game/layout.ts`
- Test: `tests/game/iso.test.ts`, `tests/game/layout.test.ts`

**Interfaces:**

```ts
// iso.ts — 2:1 isometric. World units are tiles; z is height in tiles.
interface View { originX: number; originY: number; tile: number /* px width of one tile at zoom 1 */; zoom: number }
toScreen(x: number, y: number, z: number, v: View): { sx: number; sy: number }
//   sx = originX + (x - y) * tile/2 * zoom ;  sy = originY + (x + y) * tile/4 * zoom - z * tile/2 * zoom
fromScreen(sx: number, sy: number, v: View): { x: number; y: number }   // inverse at z = 0
depth(x: number, y: number): number                                     // x + y (painter's key)
fitView(layout: ClinicLayout, width: number, height: number): View      // whole floor visible, centred, 24 px margin
// layout.ts
interface Tile { x: number; y: number }
interface RoomLayout { station: StationId; label: string; x: number; y: number; w: number; d: number;
  floor: string; seats: Tile[]; queue: Tile[] /* front of the queue first */ }
interface ClinicLayout { width: number; depth: number; rooms: RoomLayout[]; entrance: Tile; exit: Tile; overflow: Tile[] }
buildLayout(data: GameData): ClinicLayout
queueSpot(layout: ClinicLayout, station: StationId, index: number): Tile
```

**Floor plan** (builder's choice within these rules):
- The floor is 26 × 16 tiles.
- The MCH wing is on the left and the OPD wing on the right. Shared stations (primary triage, lab, pharmacy) and the entrance run along the front edge (y = 16), with the entrance in the middle.
- Every station in `data.stations` gets one room labelled with its `label`.
- Each room has at least `station.seats` seats. The doctor rooms have exactly 2 desks per room, following the spec: one `mchDoctor` room, and two `opdDoctor` rooms laid out as one wide room with 4 desks.
- Each room has at least 12 queue spots. MCH queues sit in an MCH waiting area, OPD queues in an OPD waiting area.
- `overflow` holds at least 40 extra chairs.
- `queueSpot` returns `queue[index]` while there are enough spots, then `overflow[(index − queue.length) mod overflow.length]`.
- Furniture is drawn in Task 5 from the room rectangles and seats. It isn't part of the layout data.

- [ ] **Step 1: Write the failing tests**

```ts
test('toScreen/fromScreen round-trip at z=0', () => { /* for several (x,y), fromScreen(toScreen(x,y,0)) ≈ (x,y) */ });
test('higher z draws higher on screen', () => { /* sy(z=1) < sy(z=0) */ });
test('fitView keeps all four floor corners inside the canvas with margin', () => {});
test('every station has a room with enough seats and ≥ 12 queue spots', () => { /* default data */ });
test('rooms stay inside the floor and do not overlap', () => {});
test('all seats and queue spots are distinct tiles', () => {});
test('buildLayout throws naming an unknown station', () => { /* data with extra station "xray" → /xray/ */ });
test('queueSpot overflows into the shared chairs', () => {});
```

- [ ] **Step 2:** Run `npm test -- iso layout`. It should fail.
- [ ] **Step 3:** Implement both modules.
- [ ] **Step 4:** Run `npm test`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(game): isometric projection and fixed clinic floor plan`.

---

### Task 4: Scene: people, movement, looks, bubbles

**Files:**
- Create: `src/game/appearance.ts`, `src/game/jokes.ts`, `src/game/scene.ts`
- Test: `tests/game/scene.test.ts`, `tests/game/jokes.test.ts`

**Interfaces:**
- Consumes: `ClinicLayout`, `queueSpot` (Task 3); `Sim`, `SimSnapshot`, `GameData` (Plan 1).
- Produces:

```ts
// appearance.ts
interface Look { body: string; head: string; hijab: boolean; uniform: 'none' | 'doctor' | 'nurse' | 'staff' }
lookFor(key: string, role: Role | 'patient'): Look      // deterministic from key
nameFor(key: string): string                             // fictional Malaysian name, deterministic (spec 6.4)
PURPOSE_COLOUR: Record<string, string>                   // keyed by visit type; legend labels come from data
// jokes.ts
type JokeSituation = 'longWait' | 'resultOnly' | 'doctorIdle' | 'ccmsDown' | 'printerDown' | 'influx' | 'emergency' | 'lunchMissed';
LINES: Record<JokeSituation, string[]>
pickLine(situation: JokeSituation, seed: number): string // deterministic
// scene.ts
type Pose = 'stand' | 'sit';
interface Spot { x: number; y: number; pose: Pose }
interface Person { key: string; kind: 'patient' | 'staff'; x: number; y: number; pose: Pose; look: Look;
  tag: string | null /* purpose colour */; baby: boolean; bubble: string | null }
interface Scene { now: Minute; rooms: RoomLayout[]; people: Person[] }
targets(layout: ClinicLayout, snap: SimSnapshot, sim: Pick<Sim, 'patients' | 'staff'>): Map<string, Spot>
interpolate(from: Map<string, Spot>, to: Map<string, Spot>, alpha: number, layout: ClinicLayout, lowGraphics: boolean): Map<string, Spot>
buildScene(layout, snap, sim, data, positions: Map<string, Spot>): Scene
```

**Rules:**
- **Keys:** patients are `p<id>` and staff are `s:<staffId>`.
- **Where people stand** (`targets`):
  - A queued patient is at `queueSpot(station, indexInQueue)`, sitting.
  - A patient being served is at the patient chair next to their staff member's seat, sitting.
  - Staff are at their seat in their room, sitting. Staff on lunch, or away on an emergency, are left out.
  - Patients who are done or turned away are left out.
- **Movement** (`interpolate`):
  - Positions are a straight line between `from` and `to` at `alpha` (0..1).
  - New keys walk in from the entrance. Keys that disappear walk to the exit until `alpha` is 1.
  - With `lowGraphics`, positions jump straight to `to`.
- **Bubbles:** at most 4 at once. Priority order:
  1. A doctor-only mother waiting 30 minutes or more: `resultOnly`.
  2. Any patient waiting 45 minutes or more: `longWait`.
  3. A doctor who is idle while their room's queue is empty, between 08:00 and 10:00: `doctorIdle`.
  - The line is chosen with `pickLine(situation, id)`.
- **`LINES`** must include at least these, written exactly:
  - "Lama lagi ke?"
  - "Saya nak ambil result darah je…"
  - "☕ Mana pesakit?"
  - "CCMS down lagi. Tukar ke daftar manual?"
  - "Printer tak connect…"
  - "Bas sekolah asrama dah sampai!"
  - "Kes kecemasan! Seorang doktor ke bilik rawatan."
  - "Tak sempat makan…"

- [ ] **Step 1: Write the failing tests**

```ts
test('queued patients sit in queue order; served patients sit by their staff', () => { /* hand-made snapshot */ });
test('staff on lunch are not placed', () => {});
test('interpolate halfway is the midpoint; new keys start at the entrance', () => {});
test('lowGraphics jumps straight to targets', () => {});
test('at most 4 bubbles, highest priority first', () => {});
test('lookFor, nameFor and pickLine are deterministic', () => {});
test('nameFor draws from Malay, Chinese and Indian name lists', () => { /* over 300 keys, all three lists appear */ });
test('LINES contains the required lines', () => {});
```

- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(game): scene builder with movement, looks and Manglish bubbles`.

---

### Task 5: Canvas painter and hit-testing

**Files:**
- Create: `src/game/draw.ts`, `src/game/hit.ts`
- Test: `tests/game/draw.test.ts`, `tests/game/hit.test.ts`

**Interfaces:**
- Consumes: `Scene` and `Person` (Task 4); `View`, `toScreen`, `fromScreen` and `depth` (Task 3).
- Produces:

```ts
draw(ctx: CanvasRenderingContext2D, scene: Scene, view: View,
     opts: { lowGraphics: boolean; dpr: number; highlight: StationId | null }): void
hitTest(scene: Scene, view: View, sx: number, sy: number): { kind: 'person'; key: string } | { kind: 'room'; station: StationId } | null
toCanvasPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number },
              cssWidth: number, cssHeight: number): { sx: number; sy: number }   // CSS px in the canvas's own frame
```

**Drawing order:**
1. Clear.
2. Floors, with tile lines.
3. The tall back walls.
4. Low cut-away interior walls.
5. Furniture and people together, sorted by `depth` so nearer things draw over farther ones.
6. Room labels with a white halo.
7. Purpose dots.
8. Speech bubbles, last.

**Rules:**
- The look follows the isometric mockup in `docs/mockups/art-styles.html`. The doctor rooms show two desks.
- `dpr` sets the canvas size: the canvas is `cssWidth × dpr` pixels and the context is scaled by `dpr`.
- `lowGraphics` skips shadows and tile lines.
- **Hit-testing:** people win over rooms. A person's hit box is a rectangle about 16 × 32 px (× zoom) above their screen point. Otherwise, use the room whose floor contains `fromScreen(sx, sy)`.

- [ ] **Step 1: Write the failing tests** (`draw` takes a recording fake context, a plain object whose `fillRect`, `fill`, `fillText`, `beginPath`, `moveTo` and so on push to a log)

```ts
test('floors are drawn before any person, bubbles after every person', () => {});
test('people are drawn in ascending depth', () => {});
test('lowGraphics draws no shadows', () => { /* no ellipse calls with shadow alpha */ });
test('hitTest finds a person before the room under them', () => {});
test('hitTest finds the room under an empty floor point and null outside', () => {});
test('toCanvasPoint maps client coords for a scaled canvas (dpr 2, resized rect)', () => {});
```

- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(game): isometric canvas painter and hit-testing`.

---

### Task 6: Clock, day types and the day controller

**Files:**
- Create: `src/game/clock.ts`, `src/game/scenarios.ts`, `src/game/controller.ts`
- Test: `tests/game/clock.test.ts`, `tests/game/controller.test.ts`

**Interfaces:**
- Consumes: `createDaySim`, `defaultDayPlan`, `buildReport`, `liveScores`, `PlanChange` and `applyChange` (Task 1).
- Produces:

```ts
// clock.ts
type Speed = 0 | 1 | 2 | 4;
interface GameClock { speed: Speed; advance(dtMs: number, quiet: boolean): number /* whole minutes to step */ }
createClock(): GameClock
//   game minutes per real second: speed (1, 2, 4); when quiet and speed > 0: 16; carries the fraction;
//   never returns more than 60 per call (background-tab catch-up cap)
// scenarios.ts
interface Scenario { id: string; label: string; blurb: string; apply(plan: DayPlan, data: GameData): DayPlan }
SCENARIOS: Scenario[]   // ids: 'biasa' | 'ccmsPagi' | 'printer' | 'basAsrama' | 'kecemasan' | 'doktorEL'
// controller.ts
type Phase = 'plan' | 'running' | 'paused' | 'report';
interface DayController {
  readonly phase: Phase; readonly plan: DayPlan; readonly scenarioId: string;
  readonly sim: Sim | null; readonly report: DayReport | null; readonly clock: GameClock;
  setPlan(plan: DayPlan): void; setScenario(id: string): void;
  start(): void; pause(): void; resume(): void; setSpeed(s: Speed): void;
  frame(dtMs: number): void; applyChange(change: PlanChange): { effectiveAt: Minute };
  finishNow(): void; replay(): void; newDay(): void;
  subscribe(listener: () => void): () => void;
}
createController(data: GameData, seed: number): DayController
```

**Day types (scenarios):**

| id | label | effect |
|---|---|---|
| `biasa` | Hari biasa | no events |
| `ccmsPagi` | CCMS down pagi | `ccmsDown` 08:00–10:00 |
| `printer` | Printer buat hal | `printerDown` 09:00–12:00 |
| `basAsrama` | Bas sekolah asrama | `influx` at 10:00, 25 × `opd_general` |
| `kecemasan` | Kes kecemasan | `emergencyWalkIn` at 10:30, 30–45 min |
| `doktorEL` | Doktor EL | `mo2` removed from the `mchDoctor` roster |

**Rules:**
- **`start()`:** builds the day's plan with `scenario.apply(structuredClone(plan), data)`, creates the sim with `createDaySim`, and sets the phase to `running` at speed 1.
- **`frame(dt)`:**
  - Only does anything while `running`.
  - Steps the sim `clock.advance(dt, quiet)` times, where `quiet` means no patient is queued or being served and `now ≥ 480`.
  - When `isDone()`, sets `report = buildReport(...)` and the phase to `report`.
- **`pause()`** sets the phase to `paused` (speed is kept). **`resume()`** sets it back to `running`.
- **`applyChange`** is allowed only while `running` or `paused`, and passes the change through to the sim.
- **`finishNow()`** steps to the end at once and goes to `report`.
- **`replay()`** goes back to `plan` with the same seed and plan. **`newDay()`** goes to `plan` with seed + 1, keeping the roster and SOP.
- Every state change notifies subscribers.

- [ ] **Step 1: Write the failing tests**

```ts
test('1× steps 1 minute per second, 4× steps 4, fractions carry', () => {});
test('quiet stretches run at 16 minutes per second', () => {});
test('a 10-minute background gap steps at most 60 minutes', () => { expect(createClock().advance(600_000, false)).toBeLessThanOrEqual(60); });
test('start → running; frame advances sim; pause stops advancing', () => {});
test('finishNow reaches the report with a sane DayReport', () => {});
test('an unstaffed day still reaches the report at the hard stop', () => {
  /* plan.roster.ancNurse = [] → finishNow → phase 'report', report.unfinished > 0, no NaN */
});
test('doktorEL scenario leaves one MCH doctor', () => {});
test('applyChange is rejected outside running/paused', () => { /* throws in 'plan' */ });
test('newDay increments the seed and keeps SOP settings', () => {});
test('subscribers are notified on phase changes', () => {});
```

- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(game): game clock, free-play day types and day controller`.

---

### Task 7: Plan screen (roster, SOP cards, day type)

**Files:**
- Create: `src/ui/useController.ts`, `src/ui/PlanScreen.tsx`, `src/ui/RosterEditor.tsx`, `src/ui/SopCards.tsx`, `src/ui/ScenarioPicker.tsx`
- Test: `tests/ui/plan.test.tsx`

**Interfaces:**
- Consumes: `DayController`, `SCENARIOS` (Task 6); `GameData`, `DayPlan` (Plan 1).
- Produces:

```tsx
useController(c: DayController): DayController        // re-renders on subscribe
<RosterEditor data roster onChange={(roster) => …} />  // reused by PausePanel (Task 8)
<SopCards data sop onChange={(sop) => …} />            // reused by PausePanel
<ScenarioPicker value onChange />
<PlanScreen controller data />
```

**Rules:**
- **RosterEditor:**
  - One row per station, labelled with its `label`.
  - Each seat is a `<select>` listing staff whose role matches the station's role, plus "(empty)".
  - Picking someone already seated elsewhere moves them, emptying their old seat.
- **SopCards:** five cards, with titles in Malay:
  - **Saringan di Kaunter:** one checkbox per visit type that has a bypassable step, reading "Straight to doctor: <label>".
  - **Laluan Khas:** an on/off switch, checkboxes for the four groups, and checkboxes for stations.
  - **Pinjam Doktor OPD:** on/off, a queue threshold from 1 to 20, and a maximum of 1–2 doctors.
  - **Temujanji Berperingkat:** on/off, slot length (15 or 30 minutes), and patients per slot (1–12).
  - **Pelan Kontingensi CCMS:** a "Print tomorrow's appointment list" checkbox.
- **PlanScreen:**
  - Contents: the title "Pagi ini" with the date-free day number, the ScenarioPicker, the RosterEditor, the SopCards, and a purpose-dot legend (visit type labels with their `PURPOSE_COLOUR`).
  - **Empty-station warnings:** one warning per station with no staff: "<label> has no staff. Patients sent there will not be seen."
  - A **Start the day** button that calls `controller.start()`.

- [ ] **Step 1: Write the failing tests**

```tsx
test('lists every station with its seats', () => {});
test('choosing a doctor already in OPD moves them to MCH', () => {});
test('Saringan checkbox sets bypass for that visit type', () => {});
test('empty station shows a warning but Start still works', () => {});
test('Start the day calls controller.start and the phase becomes running', () => {});
test('scenario picker sets the controller scenario', () => {});
```

- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement. Keep the styles in `styles.css`, with tokens for colours.
- [ ] **Step 4:** Run `npm test`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(ui): morning plan screen with roster, SOP cards and day types`.

---

### Task 8: Game screen (HUD, canvas loop, pause panel, toasts)

**Files:**
- Create: `src/game/loop.ts`, `src/ui/GameScreen.tsx`, `src/ui/Hud.tsx`, `src/ui/ClinicCanvas.tsx`, `src/ui/PausePanel.tsx`, `src/ui/Toasts.tsx`
- Test: `tests/game/loop.test.ts`, `tests/ui/game.test.tsx`

**Interfaces:**
- Consumes: Tasks 3–7.
- Produces:

```ts
// loop.ts
interface Loop { wake(): void; stop(): void }
createLoop(opts: { raf: (cb: (t: number) => void) => number; caf: (id: number) => void;
                   shouldRun: () => boolean; onFrame: (dtMs: number) => void; maxFps?: number /* 30 */ }): Loop
```

**Rules:**
- **The loop:**
  - It asks for the next frame only while `shouldRun()` is true.
  - It calls `onFrame` no more than `maxFps` times a second, skipping frames that come too soon.
  - `wake()` restarts it after it has slept.
- **ClinicCanvas:**
  - Sizes itself to its container using `ResizeObserver` and `devicePixelRatio`.
  - On each frame: `controller.frame(dt)`, then `targets`, `interpolate` (where alpha is the fraction of the current game minute already shown), `buildScene` and `draw`.
  - `shouldRun` is true when the phase is `running` and speed is above 0, or a walk is still finishing.
  - Clicking a room highlights it and shows a small label: the room's name, queue length and staff.
  - Clicking a patient shows a card with their `nameFor` name, visit type label, colour code (if any) and minutes waited so far. Patients still can't be moved (spec 6.4).
- **Hud:**
  - The clock (`fmt(now)` with the weekday text "Isnin").
  - Speed buttons labelled Pause, 1×, 2×, 4×.
  - Patient and staff bars from `liveScores`.
  - A lunch chip: "🍛 13:00" while pending, then the outcome.
  - "Finish day", which calls `finishNow`.
  - A **Low graphics** toggle, remembered in `localStorage` inside try/catch and defaulting to off.
- **PausePanel:**
  - Shown when the phase is `paused`.
  - Edits a draft using RosterEditor and SopCards.
  - **Apply changes** calls `applyChange` and shows "Takes effect at HH:MM. Staff satisfaction −5 per change."
  - **Resume** continues the day.
- **Toasts:**
  - When `now` passes an event's start, show its line from `jokes.ts`: `ccmsDown`, `printerDown`, `influx`, `emergency`.
  - When lunch is missed, show `lunchMissed`.
  - Toasts auto-dismiss after 8 game minutes.
  - The `ccmsDown` toast has a **Switch to manual registration** button that only dismisses it. It's flavour; manual registration is the default behaviour.

- [ ] **Step 1: Write the failing tests**

```ts
test('loop requests no frames while shouldRun is false', () => {});
test('loop calls onFrame at most 30 times per simulated second at 60 Hz rAF', () => {});
test('wake restarts a sleeping loop', () => {});
```
```tsx
test('speed buttons change controller speed; Pause enters paused', () => {});
test('pause panel apply calls applyChange and shows the effective time', () => {});
test('a CCMS toast appears once the clock passes the event start', () => {});
test('Finish day goes to the report phase', () => {});
test('low graphics toggle survives a localStorage that throws', () => {});
```

- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement. Canvas drawing in happy-dom uses a stub context, so test the loop and HUD, not the pixels.
- [ ] **Step 4:** Run `npm test`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(ui): game screen with HUD, sleeping canvas loop, pause-and-adjust and toasts`.

---

### Task 9: Report screen, app wiring, headless smoke test

**Files:**
- Create: `src/ui/ReportScreen.tsx`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `src/ui/App.tsx`, `tests/ui/app.test.tsx`, `package.json`, `.github/workflows/ci.yml`
- Test: `tests/ui/report.test.tsx`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `DayReport` (Plan 1), `DayController` (Task 6), and the screens from Tasks 7–8.
- Produces: `App`, which picks the screen by phase: `plan` → PlanScreen, `running`/`paused` → GameScreen, `report` → ReportScreen.

**ReportScreen** (spec 6.8, flat-diagram style):
- **Headline:** 🍛 "Makan on time" / "Late lunch" / "Tak sempat makan", and 🏠 "Balik on time" / "Overtime".
- **Scores:** both satisfaction numbers.
- **Waits:** a table of waits by visit type (label, count, mean, max).
- **Idle time:** MCH doctors' idle minutes between 08:00 and 10:00.
- **Bottlenecks:** the three largest `peakQueue` entries, as "<label>: <size> waiting at HH:MM". Above them, a simple diagram of station boxes shaded by peak queue size.
- **Unfinished:** if `unfinished > 0`, the line "<n> patients still waiting at 19:00".
- **Buttons:** "Replay this day" (`replay`) and "New day" (`newDay`).

**Smoke test:**
- `playwright.config.ts`: Chromium only, headless, `launchOptions.args: ['--disable-gpu']`. `webServer` runs `npm run build && npm run preview -- --port 4173 --strictPort`, and `baseURL` is `http://localhost:4173/kk-manager/`.
- Add `"e2e": "playwright test"` to `package.json`.
- In CI, add a job that runs `npx playwright install --with-deps chromium` and then `npm run e2e`.

- [ ] **Step 1: Write the failing tests**

```tsx
test('report shows lunch and balik headlines and the wait table', () => {});
test('report lists the top three bottlenecks with times', () => {});
test('report shows unfinished patients when there are any', () => {});
test('App switches screens by phase', () => {});
```
```ts
// tests/e2e/smoke.spec.ts
test('play a day end to end', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Start the day' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Finish day' }).click();
  await expect(page.getByText(/Makan on time|Late lunch|Tak sempat makan/)).toBeVisible();
});
```

- [ ] **Step 2:** Run `npm test -- report app`. It should fail.
- [ ] **Step 3:** Implement ReportScreen and the App wiring.
- [ ] **Step 4:** Run `npm test`, `npm run typecheck` and `npm run build`. All should pass, and the size should be under 500 KB.
- [ ] **Step 5:** Run `npm run e2e`, headless with `--disable-gpu` only, in CI or a cloud session if available. It should pass. If running locally, run it in the background and read only the pass/fail summary.
- [ ] **Step 6:** Commit: `feat(ui): end-of-day report, app wiring and headless smoke test`.
- [ ] **Step 7:** Tell the user how to try it themselves (`npm run build`, then `npm run preview`, then open the printed URL in their own browser), and ask them to play one "Hari biasa" and one "CCMS down pagi" and report what feels wrong.
