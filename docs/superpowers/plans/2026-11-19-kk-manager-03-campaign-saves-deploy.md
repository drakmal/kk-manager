# KK Manager: Campaign, Saves and Deploy (Plan 3 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single playable day into the v1 game:
- a title screen
- the night-before phase (phone messages with choices)
- the 10-day campaign "Dua Minggu di KK" ending in a district officer visit, then endless mode
- new doctors and the Pasangan Mentor card
- complaints, and goodwill for relief requests
- saved progress (3 slots, autosave, export/import)
- publishing to `drakmal.com/kk-manager`

**Architecture:**
- The simulation gains two generic levers that the campaign layer sets each day, so the sim stays campaign-free:
  - per-staff speed multipliers
  - extra "trainee" seats
- It also gains one new event: `staffAway`.
- A pure `campaign/` module holds `CampaignState` (JSON-serialisable). It turns that state into tomorrow's `DayPlan`, folds each `DayReport` back in, and generates the night's messages.
- A `CampaignController` wraps one Plan 2 `DayController` per day, and autosaves through a storage adapter.
- The UI adds a title screen, a night screen and a district-visit screen, and reuses the plan, game and report screens.

**Still out of scope after v1:**
- the rare "big lever" emergency actions (a spec "call")
- Friday's longer lunch
- the phone layout
- polished art
- sound

**Tech Stack:** the same as Plan 2 (TypeScript, Preact, Canvas 2D, Vitest with happy-dom, and `@playwright/test` pinned to 1.57.0), plus GitHub Actions Pages deploy.

**Spec:** `docs/superpowers/specs/2026-11-19-kk-manager-design.md`, sections 6.2, 6.5–6.9, 7 and 8. Builds on Plans 1 and 2 in `docs/superpowers/plans/`.

## Global Constraints

Everything from Plan 2's Global Constraints still applies:
- Canvas 2D only, at most 30 fps, and the loop sleeps when idle.
- No browser preview on the user's machine; Playwright runs headless only, with `--disable-gpu`.
- `src/sim` stays browser-free. Game and UI code import the sim only through `src/sim/index.ts`.
- English interface; Malay/Manglish dialogue.
- The player is called "Clinic Manager", never "FMS".
- No MOH/KKM logos or names.
- Under 500 KB of JS.

New constraints for this plan:
- **The campaign and save code is pure.** `src/campaign/` must not touch `window`, `document`, `localStorage` or `Date`.
  - Storage comes in through a `SaveStorage` adapter.
  - Timestamps come in as arguments.
- **Storage is wrapped:**
  - Every `localStorage` read and write goes through `browserStorage()`, which catches errors.
  - If storage is unavailable, the game still plays. It shows "Progress can't be saved in this browser" and offers export.
- **Saves are versioned:** `SaveGame.version` is 1, and `migrate()` is the only way to load an older or newer shape. Unknown versions are rejected with a clear message.
- **Determinism:**
  - Campaign randomness, such as which night has an emergency-leave message, comes from `createRng(state.seed * 1000 + state.day)`.
  - Replaying from the same save gives the same nights.
- **Publishing is outward-facing.**
  - Creating the GitHub repository, pushing, and turning on Pages each need the user's explicit go-ahead in chat, at that moment.
  - The user signs in to GitHub themselves (`gh auth login`).
  - **GitHub Pages on a free account requires a public repository.** The user decides public versus paid private before Task 9.

## Values this plan pins (from the spec's "(call)" items)

| Item | Value |
|---|---|
| Campaign | 10 days, Isnin–Jumaat × 2. Day 10 is followed by the district officer visit, then endless mode. |
| Schedule | Day 1 `biasa` (tutorial hints) · 2 `biasa` · 3 `ccmsPagi` · 4 `biasa` (new doctor joins) · 5 `printer` · 6 `basAsrama` · 7 `kecemasan` · 8 `biasa` · 9 `ccmsPagi` + `printer` · 10 `biasa` |
| Endless mode | Random day type from SCENARIOS (excluding `doktorEL`) with the campaign RNG. Emergency-leave messages follow the night rules. |
| Cards at start | `saringan`, `laluanKhas`, `pinjamDoktor` |
| Unlocks | `temujanji`: after a day whose largest `peakQueue` is 30 or more (district memo message). `kontingensiCcms`: after the first day with a `ccmsDown` event. `pasanganMentor`: when the first new doctor joins. |
| Emergency-leave messages | Night 4 always: `mo2` for day 5. From night 5 on: chance `0.15 + max(0, 70 − lastHcw) / 100`, capped at 0.6, for a random rostered MO. |
| Relief | Costs 20 goodwill. Allowed if goodwill ≥ 20 and fewer than 2 reliefs used this campaign week. Goodwill starts at 60, recovers +5 per day, and maxes at 100. Relief staff id `relief1`, name "Dr. Relief (KK Seri Melur)". |
| New doctor | `mo7` "Dr. Amir (MO baru)" joins on day 4. Sits in an extra seat in their mentor's doctor room. |
| Trainee speed | Service time × `max(1, 1.8 − 0.1 × experience)`. The mentor's time × 1.2 while paired. Independent at experience 6, after which `mo7` is a normal MO with no extra seat or slowdown. |
| Learning | +1 experience per day worked. With Pasangan Mentor on, +1.5. **Spec change:** the spec says independence after about 2–3 in-game weeks. This is shortened so it can happen inside the 2-week campaign: about 6 working days without a mentor, 4 with. The user approves this with the plan. |
| Low morale | If the last day's HCW satisfaction is under 50, every staff member's service time × 1.1 the next day (spec 6.8: "slower work"), on top of the higher emergency-leave chance. |
| Complaint (aduan) | If a day's `patientSatisfaction` is under 35, a night message, then the next day `staffAway` for `pt1` 09:00–09:30 ("Kak Ida tulis laporan aduan"). |
| District visit grade | Mean patient satisfaction (P), mean HCW (H), days lunch on time (L), days overtime (O). A: P ≥ 70, H ≥ 80, L ≥ 6. B: P ≥ 55, H ≥ 70. C: P ≥ 40. D otherwise. |
| Saves | 3 slots, keys `kkm.save.1`–`kkm.save.3`, autosave when each night starts. Export file name `kk-manager-slot<N>-day<D>.json`. |

These numbers are tuning placeholders and also go on the Google Sheet's Tuning tab (Task 2, with the user's go-ahead).

## Review Focus

1. **A save from an older or unknown version, or a hand-edited file.** Import must reject it with a message naming what's wrong, never crash the title screen. Test in Task 5.
2. **Storage blocked** (private window, cleared site data). New campaign and Continue still work for the session, and a visible note says progress isn't saved. Test in Task 5 and Task 8.
3. **Emergency leave for a doctor who isn't rostered tomorrow, or on two nights in a row.** No crash, and no double-counted seat. Test in Task 3.
4. **The relief button pressed with not enough goodwill, or after 2 reliefs this week.** The choice is disabled with a reason, and nothing is spent. Test in Task 3 and Task 7.
5. **Reloading in the middle of a day.** The autosave is from the night, so Continue resumes at that night's messages, not halfway through a day. Test in Task 8.

---

## File Structure

```
src/sim/                 (Task 1: staffSpeed, extraSeats, staffAway)
src/campaign/
  types.ts               # CampaignState, Message, Choice, CardId, SaveGame
  campaign.ts            # createCampaign, dayPlanFor, endDay, unlocks, schedule, trainee rules
  night.ts               # nightMessages, applyChoice
  district.ts            # districtReview
  saves.ts               # serialise, parseSave, migrate, SaveStorage, browserStorage, slots
  controller.ts          # CampaignController
src/ui/
  TitleScreen.tsx, NightScreen.tsx, DistrictScreen.tsx
  (modified) App.tsx, PlanScreen.tsx, SopCards.tsx, Hud.tsx, ReportScreen.tsx
.github/workflows/pages.yml
tests/campaign/*.test.ts, tests/ui/{title,night,district,campaign}.test.tsx, tests/e2e/campaign.spec.ts
```

---

### Task 1: Simulation levers (staff speed, trainee seats, staff away)

**Files:**
- Modify: `src/sim/types.ts`, `src/sim/engine.ts`, `src/sim/events.ts`, `src/sim/data.ts`
- Test: `tests/sim/levers.test.ts`

**Interfaces:**
- Produces:

```ts
// DayPlan gains (both optional, default empty):
staffSpeed?: Record<StaffId, number>          // service-time multiplier, ≥ 0.1; default 1
extraSeats?: Record<StationId, StaffId[]>     // staff seated beyond `seats` (trainees), in order
// ClinicEvent gains:
| { kind: 'staffAway'; staffId: StaffId; from: Minute; to: Minute }
```

**Rules:**
- **Seating:** staff in `extraSeats[station]` sit there in addition to the station's normal seats. Each is seated once. Someone listed in both places takes the extra seat.
- **Service time:** multiply by `staffSpeed[staffId] ?? 1` and round up, **before** the event modifiers in `serviceMinutes`. The order is speed, then CCMS, then printer.
- **`staffAway`:** that person is unavailable from `from` to `to`. If they're mid-consultation at `from`, they finish that patient first, as with an emergency.
- **Snapshot:** `snapshot().stations[].seats` includes the extra-seat staff after the normal ones.

- [ ] **Step 1: Write the failing tests**

```ts
test('staffSpeed 2 doubles that person’s service time only', () => { /* fixture: doc1 ×2 → 3-min step takes 6 */ });
test('staffSpeed applies before CCMS and printer', () => { /* clerk ×1.5, base 2 → 3, CCMS ×2 → 6, printer +1 → 7 */ });
test('extraSeats lets a trainee see patients beside the normal seats', () => { /* b has 1 seat + trainee → two served at once */ });
test('staffAway removes a person for the window, finishing a patient first', () => {});
test('a person listed in both roster and extraSeats is seated once', () => {});
test('Plan 1 and 2 behaviour is unchanged when the new fields are absent', () => { /* default day report deep-equals the stored report from runDay before the change, by seed */ });
```

- [ ] **Step 2:** Run `npm test -- levers`. It should fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. All tests should pass, including the existing 145.
- [ ] **Step 5:** Commit: `feat(sim): per-staff speed, trainee seats and staff-away events`.

---

### Task 2: Campaign model

**Files:**
- Create: `src/campaign/types.ts`, `src/campaign/campaign.ts`
- Test: `tests/campaign/campaign.test.ts`

**Interfaces:**
- Consumes: `GameData`, `DayPlan`, `DayReport`, `SopSettings`, `createRng` and `defaultDayPlan` (Plan 1); `SCENARIOS` (Plan 2).
- Produces:

```ts
type CardId = 'saringan' | 'laluanKhas' | 'pinjamDoktor' | 'temujanji' | 'kontingensiCcms' | 'pasanganMentor';
interface Trainee { staffId: StaffId; experience: number; mentor: StaffId | null }
interface DaySummary { day: number; patient: number; hcw: number; lunch: LunchOutcome; balik: BalikOutcome;
  overtime: number; docOnlyWait: number; peakQueue: number; ccms: boolean }
interface CampaignState {
  version: 1; seed: number; day: number /* 1-based, the day about to be played */; mode: 'campaign' | 'endless';
  roster: Record<StationId, StaffId[]>; sop: SopSettings; unlocked: CardId[];
  goodwill: number; reliefsThisWeek: number;
  trainees: Trainee[]; mentorCardOn: boolean;           // Pasangan Mentor lives here (not in the sim's SopSettings)
  extraStaff: StaffDef[];                               // mo7, relief1 when present
  tomorrow: { events: ClinicEvent[]; away: StaffId[]; relief: { staffId: StaffId; station: StationId } | null };
  messages: Message[];                                   // tonight's messages (Task 3)
  history: DaySummary[];
}
const CAMPAIGN_DAYS = 10;
const DAY_NAMES = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat'];
dayName(day: number): string                              // day 1 → 'Isnin', day 6 → 'Isnin'
createCampaign(data: GameData, seed: number): CampaignState
staffFor(data: GameData, state: CampaignState): GameData  // data with extraStaff appended (new doctor, relief)
dayPlanFor(data: GameData, state: CampaignState): DayPlan
//   roster minus `tomorrow.away`, plus relief; sop with locked cards forced off; events = schedule ∪ tomorrow.events;
//   trainees → extraSeats in their mentor's station and staffSpeed (trainee and mentor), per the pinned values
endDay(data: GameData, state: CampaignState, report: DayReport, dayPlan: DayPlan): CampaignState
//   pushes a DaySummary; trainee experience += 1 (1.5 with mentorCardOn and a mentor set); goodwill +5 (max 100);
//   unlocks per the table; day += 1; week rollover (day 6) resets reliefsThisWeek; clears `tomorrow`; after day 10 → mode 'endless'
isUnlocked(state: CampaignState, card: CardId): boolean
```

**Rules:**
- The roster and SOP the player sets on the plan screen are saved back into the state when the day starts (Task 8), so tomorrow starts from today's choices.
- **Locked cards:** `dayPlanFor` forces their settings off: Saringan bypass all false, Laluan Khas disabled, and so on. That way an imported save can't use a card before unlocking it.

- [ ] **Step 1: Write the failing tests**

```ts
test('a new campaign starts on day 1 with three cards and goodwill 60', () => {});
test('dayName cycles Isnin..Jumaat', () => {});
test('dayPlanFor uses the schedule: day 3 has CCMS down 08:00–10:00, day 9 has CCMS and printer', () => {});
test('locked cards are forced off in the day plan', () => { /* state.sop.temujanji.enabled = true but not unlocked → plan off */ });
test('endDay records the summary, adds goodwill and advances the day', () => {});
test('temujanji unlocks after a crowded day; kontingensi after the first CCMS day', () => {});
test('day 4 brings Dr. Amir as a trainee with an extra seat and slower times; mentor slowed ×1.2', () => {});
test('a trainee with 6 experience becomes a normal MO', () => {});
test('Pasangan Mentor speeds learning to 1.5 per day', () => {});
test('a day with HCW satisfaction under 50 slows everyone ×1.1 the next day', () => {});
test('after day 10 the mode becomes endless and days keep counting', () => {});
test('everything in the state survives JSON round-trip', () => { expect(JSON.parse(JSON.stringify(s))).toEqual(s); });
```

- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(campaign): campaign state, schedule, unlocks and new-doctor rules`.
- [ ] **Step 6 (user go-ahead):** Add the pinned numbers to the Google Sheet's Tuning tab as new rows, grouped under a "Campaign" heading row: goodwill start/recovery/relief cost, relief limit, trainee factors, independence experience, emergency-leave base chance and the complaint threshold. Read them back. They stay as constants in `campaign.ts` until a later pull wires them in. Note this in the sheet's Read me.

---

### Task 3: Night-before messages and choices

**Files:**
- Create: `src/campaign/night.ts`
- Modify: `src/campaign/types.ts`
- Test: `tests/campaign/night.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:

```ts
type MessageKind = 'el' | 'newDoctor' | 'memo' | 'complaint' | 'forecast' | 'tutorial';
interface Choice { id: string; label: string; disabledReason: string | null }
interface Message { id: string; kind: MessageKind; from: string; text: string; choices: Choice[]; chosen: string | null }
nightMessages(data: GameData, state: CampaignState, last: DaySummary | null): Message[]
applyChoice(data: GameData, state: CampaignState, messageId: string, choiceId: string): CampaignState
allAnswered(state: CampaignState): boolean        // every message with choices has `chosen`
```

**Messages** (texts are Malay/Manglish, and must include at least these):

| kind | when | from | text | choices |
|---|---|---|---|---|
| `tutorial` | night before day 1 | "Kak Ida (PT)" | "Selamat datang, Clinic Manager! Esok hari pertama. Tengok siapa yang menunggu paling lama di KIA." | `ok` "Baik" |
| `el` | per the pinned rules | the doctor | "Dr, saya demam, esok nak EL 🙏" | `relief` "Minta relief dari klinik lain (−20 goodwill)", `pinjam` "Pinjam doktor OPD", `kosong` "Biarkan kosong" |
| `newDoctor` | night before day 4 | "Pejabat Kesihatan Daerah" | "Dr. Amir (MO baru) akan melapor diri esok. Sila tetapkan mentor." | `ok` "Baik" (the mentor is set on the plan screen) |
| `memo` | after an unlock | "Pejabat Kesihatan Daerah" | "Memo: SOP <card name> kini boleh digunakan." | `ok` |
| `complaint` | after a day with patient satisfaction under 35 | "Unit Aduan" | "Aduan diterima: pesakit tunggu terlalu lama. Kak Ida perlu tulis laporan esok pagi." | `ok` |
| `forecast` | night before day 6 | "Cikgu Rahman (sekolah asrama)" | "Esok kami bawa pelajar untuk saringan kesihatan, lebih kurang 25 orang 🚌" | `ok` |

**Choice rules (emergency leave):**
- **`relief`:** disabled with reason "Not enough goodwill" if goodwill < 20, or "Relief limit reached this week" if 2 reliefs have been used. When chosen, sets `tomorrow.away = [doctor]` and `tomorrow.relief = { staffId: 'relief1', station: <doctor's station> }`, takes 20 goodwill and counts 1 relief.
- **`pinjam`:** sets `tomorrow.away` and moves the first OPD MO not already away into the doctor's MCH seat for tomorrow. Disabled if the doctor on leave is from OPD, with reason "Doctor is from OPD".
- **`kosong`:** sets `tomorrow.away` only.
- **A doctor not rostered tomorrow:** no `el` message is generated.
- **Emergency leave on consecutive nights:** handled independently. A doctor already away tomorrow can't be picked again.
- **Complaint:** adds `{ kind: 'staffAway', staffId: 'pt1', from: 540, to: 570 }` to `tomorrow.events`.

- [ ] **Step 1: Write the failing tests**

```ts
test('night before day 1 has the tutorial message', () => {});
test('night 4 always has an EL message from Dr. Hafiz', () => {});
test('EL relief: away set, relief seated in that station, goodwill −20, relief counted', () => {});
test('relief is disabled with a reason when goodwill < 20 or two reliefs used', () => {});
test('pinjam moves an OPD doctor into the empty MCH seat for tomorrow', () => {});
test('no EL message for a doctor who is not rostered tomorrow', () => {});
test('EL on two nights in a row does not pick the same absent doctor or double a seat', () => {});
test('a low-satisfaction day produces a complaint and a staffAway event for Kak Ida', () => {});
test('unlocks produce a district memo', () => {});
test('the same state gives the same messages (seeded)', () => {});
test('allAnswered is false until every choice-message is answered', () => {});
```

- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(campaign): night-before messages with relief, pinjam and complaints`.

---

### Task 4: District officer visit

**Files:**
- Create: `src/campaign/district.ts`
- Test: `tests/campaign/district.test.ts`

**Interfaces:**

```ts
interface DistrictReview { grade: 'A' | 'B' | 'C' | 'D'; patient: number; hcw: number; lunchOnTime: number;
  overtimeDays: number; docOnlyWaitFirst: number; docOnlyWaitLast: number; lines: string[] }
districtReview(history: DaySummary[]): DistrictReview   // uses the first 10 days
```

**Rules:**
- The grade follows the pinned table.
- `lines` holds 3–5 Malay/Manglish remarks picked by rule, for example:
  - If the doctor-only wait fell by 40% or more between the first and last days: "Saringan di kaunter nampak berkesan. Ibu yang jumpa doktor sahaja tak tunggu lama lagi."
  - If lunch was on time on 6 days or more: "Doktor dapat makan tengah hari. Bagus!"
  - If overtime happened on 3 days or more: "Staf selalu balik lewat. Tolong semak jadual."
  - The grade line: A "PKD sangat berpuas hati.", B "Prestasi baik, ada ruang penambahbaikan.", C "Perlu tindakan segera.", D "Kita perlu berbincang…"

- [ ] **Step 1: Write the failing tests:** each grade boundary, each rule line, and an empty history giving D with no `NaN`.
- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. They should pass.
- [ ] **Step 5:** Commit: `feat(campaign): district officer review`.

---

### Task 5: Saves

**Files:**
- Create: `src/campaign/saves.ts`
- Test: `tests/campaign/saves.test.ts`

**Interfaces:**

```ts
interface SaveGame { version: 1; slot: 1 | 2 | 3; savedAt: string /* ISO, passed in */; state: CampaignState }
interface SaveStorage { get(key: string): string | null; set(key: string, value: string): boolean; remove(key: string): void; readonly available: boolean }
memoryStorage(): SaveStorage
browserStorage(): SaveStorage                          // wraps localStorage; every call in try/catch; available=false when blocked
serialise(save: SaveGame): string
parseSave(text: string): { ok: true; save: SaveGame } | { ok: false; error: string }
migrate(raw: unknown): SaveGame                         // throws Error naming the problem; v1 passes through
saveSlot(storage: SaveStorage, save: SaveGame): boolean
loadSlot(storage: SaveStorage, slot: 1 | 2 | 3): SaveGame | null   // a corrupt slot returns null, never throws
listSlots(storage: SaveStorage): { slot: 1 | 2 | 3; day: number; mode: string; savedAt: string }[]
exportFileName(save: SaveGame): string                  // 'kk-manager-slot1-day4.json'
```

**Validation in `migrate`:**
- `version` must be 1 (anything else: "This save is from a newer/unknown version (v<N>)").
- `slot` must be 1–3.
- `state.day` must be a whole number of 1 or more.
- `roster`, `sop` and `history` must be present with the right types.
- Every roster staff id must exist in the game data or `extraStaff`, checked by `validateSaveAgainst(data, save)` (exported too).

- [ ] **Step 1: Write the failing tests**

```ts
test('round-trip: serialise → parseSave gives the same save', () => {});
test('parseSave rejects bad JSON, wrong version, missing fields, unknown staff — with a message, no throw', () => {});
test('saveSlot/loadSlot/listSlots with memoryStorage', () => {});
test('a corrupt slot loads as null and is skipped by listSlots', () => {});
test('browserStorage with a throwing localStorage reports available=false and never throws', () => {});
test('exportFileName', () => { expect(exportFileName(save)).toBe('kk-manager-slot1-day4.json'); });
```

- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. They should pass.
- [ ] **Step 5:** Commit: `feat(campaign): versioned saves with slots, validation and safe storage`.

---

### Task 6: Campaign controller

**Files:**
- Create: `src/campaign/controller.ts`
- Modify: `src/game/controller.ts` (accept an initial plan)
- Test: `tests/campaign/controller.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5; `createController` (Plan 2).
- Produces:

```ts
// game/controller.ts: createController(data, seed, init?: { plan?: DayPlan; scenarioId?: string })
type CampaignPhase = 'night' | 'plan' | 'day' | 'report' | 'district';
interface CampaignController {
  readonly phase: CampaignPhase; readonly state: CampaignState; readonly slot: 1 | 2 | 3;
  readonly day: DayController | null;           // set in plan/day/report
  readonly data: GameData;                       // staffFor(data, state)
  readonly saveAvailable: boolean; readonly review: DistrictReview | null;
  choose(messageId: string, choiceId: string): void;   // night only
  toPlan(): void;                                // night → plan, requires allAnswered
  continueAfterReport(): void;                   // report → district (after day 10, first time) or night
  continueAfterDistrict(): void;                 // district → night (endless)
  exportSave(): { fileName: string; text: string };
  subscribe(l: () => void): () => void;
}
newCampaign(data: GameData, storage: SaveStorage, slot: 1 | 2 | 3, seed: number, now: () => string): CampaignController
resumeCampaign(data: GameData, storage: SaveStorage, save: SaveGame, now: () => string): CampaignController
```

**Rules:**
- **Night:** shows `state.messages`. When the phase enters `night`, generate the messages if there are none, then autosave (`saveSlot`).
- **`toPlan`:** creates `DayController(staffFor(data, state), seed = state.seed*1000 + state.day, { plan: dayPlanFor(...), scenarioId: 'biasa' })`, and the phase becomes `plan`.
- When the inner day controller starts, the phase becomes `day`, and the player's roster and SOP from the plan screen are copied into `state`.
- When the inner controller reaches the report, the phase becomes `report`.
- **`continueAfterReport`:** `endDay(...)`, then `nightMessages`. It goes to `district` if the day just played was 10 and the mode was `campaign`, otherwise to `night`. Then autosave.
- **Reload mid-day:** resuming loads the last autosave, which is at a night, so the phase is `night`.

- [ ] **Step 1: Write the failing tests:**
  - a new campaign starts at night with the tutorial message and autosaves
  - `toPlan` is blocked until all messages are answered
  - the plan → day → report → night cycle advances the day and saves
  - day 10 → district → endless night 11
  - resuming a save made at night 3 returns to night 3 with the same messages
  - with `memoryStorage` whose `set` fails, `saveAvailable` is false and play continues
- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(campaign): campaign controller with autosave`.

---

### Task 7: Title, night and district screens; locked cards; mentor card

**Files:**
- Create: `src/ui/TitleScreen.tsx`, `src/ui/NightScreen.tsx`, `src/ui/DistrictScreen.tsx`
- Modify: `src/ui/SopCards.tsx`, `src/ui/PlanScreen.tsx`, `src/ui/Hud.tsx`, `src/ui/ReportScreen.tsx`, `src/ui/styles.css`
- Test: `tests/ui/title.test.tsx`, `tests/ui/night.test.tsx`, `tests/ui/district.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–6.
- Produces:

```tsx
<TitleScreen slots={listSlots(...)} saveAvailable onNew={(slot) => …} onContinue={(slot) => …} onFreePlay={() => …}
             onImport={(text) => { ok } | { error }} onExport={(slot) => …} />
<NightScreen campaign={CampaignController} />
<DistrictScreen campaign={CampaignController} />
// SopCards gains: unlocked?: CardId[]  — locked cards render as "🔒 <name> (locked)" with no inputs
// SopCards gains: mentor?: { on: boolean; trainees: Trainee[]; doctors: Record<StaffId, { id: StaffId; name: string }[]>;
//                            onChange(on: boolean, trainees: Trainee[]): void }   — the sixth card, shown when 'pasanganMentor' is unlocked
// PlanScreen gains: campaign?: { dayLabel: string; unlocked: CardId[]; mentor: SopCards['mentor'] } — hides ScenarioPicker when set
// Hud and GameScreen gain: dayName?: string (default 'Isnin'), passed GameScreen → Hud
// ReportScreen gains: onContinue?: () => void — replaces Replay/New day with "Continue to tonight"
```

**Rules:**
- **The Pasangan Mentor card** has a switch and one `<select>` per trainee listing the doctors in the trainee's room. Turning the card on also switches on the faster learning rate.
- **TitleScreen:**
  - The heading is "KK Manager".
  - Three slot rows, each with Continue or New campaign, plus Export when the slot has a save.
  - A "Free play" button.
  - "Import save" is a file input. Its text goes to `onImport`, and any error shows beside it.
  - When `saveAvailable` is false, show "Progress can't be saved in this browser. Use Export to keep your game."
  - **Export** builds a `Blob`, creates an object URL, clicks a temporary `<a download>`, and revokes the URL. This is the browser download of the player's own save, started by their click.
- **NightScreen:**
  - A phone-style list of messages: the sender, the text, and choice buttons.
  - A disabled choice shows its reason.
  - Answered messages show the chosen label.
  - Goodwill shows as "Goodwill: 60".
  - A **Go to morning** button stays disabled until `allAnswered`.
- **DistrictScreen:** the grade (large), the four numbers, the remark lines, and **Continue (endless mode)**.

- [ ] **Step 1: Write the failing tests:**
  - **Title:** the slot rows, Continue and New calls, the import error shown, the storage-unavailable note.
  - **Night:** the disabled relief shows its reason; choosing updates the message; the morning button enables once everything is answered.
  - **District:** the grade and remark lines render.
  - **SopCards:** a locked card has no inputs; the mentor select lists the room's doctors.
- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. All tests should pass.
- [ ] **Step 5:** Commit: `feat(ui): title, night and district screens; locked SOP cards; mentor card`.

---

### Task 8: App wiring and the campaign e2e test

**Files:**
- Modify: `src/ui/App.tsx`, `tests/ui/app.test.tsx`
- Create: `tests/ui/campaign.test.tsx`, `tests/e2e/campaign.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: an `App` that routes between title → (free play: the Plan 2 screens) or (campaign: night / plan / game / report / district). Storage is `browserStorage()` by default; tests pass `memoryStorage()`. The clock is `() => new Date().toISOString()`, used in the UI only.

- [ ] **Step 1: Write the failing tests:**
  - **UI:** a new campaign in slot 1 walks night 1 → plan → Finish day → report → Continue → night 2, and listSlots shows day 2.
  - **Reload:** remounting App with the same storage, then Continue, lands at night 2.
  - **Storage blocked:** a note is shown and play continues.
  - **e2e** (headless, GPU off):
    1. new campaign
    2. answer the tutorial
    3. Go to morning
    4. Start the day
    5. Finish day
    6. Continue to tonight
    7. reload the page
    8. Continue on slot 1 shows "Selasa"
- [ ] **Step 2:** Run the tests. They should fail.
- [ ] **Step 3:** Implement the App routing.
- [ ] **Step 4:** Run `npm test`, `npm run typecheck`, `npm run build` (under 500 KB) and `npm run e2e`. All should pass.
- [ ] **Step 5:** Commit: `feat(ui): title-to-campaign routing with autosave; campaign e2e`.

---

### Task 9: Publish to drakmal.com/kk-manager

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md` (create: what the game is, how to run it, how to pull the sheet)

**Steps** (each outward step needs the user's explicit go-ahead at that moment):
- [ ] **Step 1:** Write `pages.yml`. On push to `main`: checkout, setup-node 20, `npm ci`, `npm test`, `npm run build`, `actions/upload-pages-artifact` from `dist`, then `actions/deploy-pages`. Permissions: `pages: write` and `id-token: write`. Commit: `ci: deploy to GitHub Pages`.
- [ ] **Step 2: (user)** The user runs `gh auth login` and decides between a **public repository** (free Pages) and a paid plan for private Pages.
- [ ] **Step 3 (go-ahead):** Run `gh repo create kk-manager --<public|private> --source . --push`, then confirm CI is green with `gh run watch`, run in the foreground.
- [ ] **Step 4 (go-ahead):** Turn on Pages with the source set to GitHub Actions: `gh api -X POST repos/<owner>/kk-manager/pages -f build_type=workflow`. Wait for the deploy run.
- [ ] **Step 5:** Check that `curl -sI https://drakmal.com/kk-manager/` returns 200.
  - If it returns 404, check whether drakmal.com is the custom domain of the `<owner>.github.io` repository. Project sites appear under it only then. Report what you find and stop, without changing DNS or other repositories.
- [ ] **Step 6:** Tell the user the live link and suggest sending it to one or two district friends for a test play.
