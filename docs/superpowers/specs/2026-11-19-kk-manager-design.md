# KK Manager: Design

- **Date:** 2026-11-19
- **Status:** approved by the user on 2026-11-19. This is a living document: changes are welcome, and they're made here first, then in the plan.
- **Related:** [MOH guideline notes](../../research/moh-guidelines-notes.md), [art-style mockups](../../mockups/art-styles.html)

Markers used below:
- **(user)** means the user decided it.
- **(call)** means it was proposed during design and is open to correction.

---

## 1. Intent

KK Manager is a browser management game set in a Malaysian *klinik kesihatan* (KK). It will be published at drakmal.com.

The player runs a clinic through ordinary working days and tries to improve **patient flow**. Patients should reach a doctor quickly, and doctors shouldn't sit idle. **(user)**

It comes from the user's own experience in the MCH unit (Kesihatan Ibu dan Anak):
- Registration is first-come-first-served.
- Every antenatal mother queues for the ANC nurse room first, even when she only needs the doctor that day.
- So a mother with a simple, doctor-only visit waits behind 20–30 minute routine nurse checks.
- Meanwhile the doctor can sit idle for up to an hour in the morning.

The fix is to sort patients at registration by which appointments fall today. The player should **discover** this rather than be told. Later units and scenarios widen the game beyond this first puzzle. **(user)**

The user also wants to use the project to learn Claude Code slash commands, plugins and connectors where they fit naturally (section 10). **(user)**

## 2. Players

- **Who:** mostly the user's healthcare-worker friends. They are management-level doctors at the district health office who oversee KK operations. Other KK staff may play too. **(user)**
- **What they need:**
  - Workflows accurate enough that KK staff recognise their own clinic.
  - Humour from in-jokes about real KK life. **(user)**
- **How they play:** in longer sessions they return to, with saved progress. The reference for this kind of browser game is nfsu2.xyz. It is not a short one-off game. **(user)**
- **Device:** a laptop or desktop browser first. A phone layout comes later. **(call)**

## 3. Goals, non-goals, anti-goals

### Goals
1. Players feel the real tension: patient waiting time versus doctor idle time.
2. Players discover policy fixes such as sorting at registration, staggered appointments and contingency plans, by experimenting and reading results.
3. Bad-day events feel true to life and are funny to KK staff.
4. Progress saves, and players have reasons to return: staff development, new SOP cards, new units.
5. It runs smoothly on modest hardware, including the user's MX150 laptop and older clinic PCs.

### Non-goals (for now)
- Clinical accuracy at the level of diagnosis or drug choice. The game models **flow**, not medicine.
- Multiplayer, leaderboards, accounts or cloud saves.
- Building or dragging walls the way The Sims build mode does (see section 6.3).
- A phone-first layout.

### Anti-goals (the game fails if…)
- KK staff cringe at the workflows ("this is not how KK works").
- The game can be won by micromanaging patients one by one instead of finding the policy. This is why the real-time control option was rejected.
- It reads like a training module or a lecture.
- It is heavy enough to lag on clinic PCs or crash the user's laptop.
- It uses official MOH/KKM logos or branding, or anything that looks like an official MOH product. It is the user's personal project.
- It contains any real patient data.

## 4. Constraints

- **Hosting:**
  - drakmal.com is served by **GitHub Pages**, checked on 2026-11-19.
  - The game is a static site in its own GitHub repository, published at `drakmal.com/kk-manager`.
  - This assumes drakmal.com is the custom domain of the user's `<username>.github.io` site. If it isn't, project pages won't appear under drakmal.com automatically **(check during setup)**.
- **No server.** Saves live in the player's browser (localStorage), with export/import to a file. **(user agreed)**
- **The user's development machine:**
  - The user's laptop has a weak GPU and Claude Desktop crashes under rendering load.
  - Building, running and testing happen in a **cloud session**, with headless automated tests.
  - No browser previews of the dev server open on the user's laptop.
  - The user opens the game themselves only when they choose to.
- **Rendering budget:**
  - Canvas 2D only, no WebGL.
  - Redraw only while the simulation is running or something changes. Idle when paused.
  - Cap at 30 fps.
  - A "low graphics" setting: no walking animation, characters jump between spots.
- **Language:** English for the interface. Natural Malay/Manglish for character dialogue, messages and event text, since that's where the jokes live. **(call)**
- **Role name:** the player is the **Clinic Manager**. The game avoids "FMS". **(user)**

## 5. Approaches

### Play style (how the player acts during a day)

| Option | Description | Verdict |
|---|---|---|
| A. Plan, then watch | Set the roster and rules before the day, watch it run, read the report. | Too hands-off when events hit. |
| B. Real-time | Move staff and patients directly as the day runs. | Rejected: players could brute-force fixes by hand and never discover the policy (the main goal). Also tiring. |
| **C. Plan, then adjust** | Plan before the day. Pause during it to change rules or roster, at a cost to staff satisfaction. Players can't move individual patients. | **Chosen (user)** |

### Rule-making (how the player changes the clinic's rules)

| Option | Description | Verdict |
|---|---|---|
| A. Policy switches | On/off toggles for known policies. | The answer sits visible in a list. Weak discovery. |
| B. Free rule builder | Write if-then rules. | Feels like programming. Tiring for busy managers. |
| **C. SOP cards with settings** | The clinic's SOP is a set of cards. Each card has settings, and cards unlock through play. | **Chosen (user)** |

### Art style

| Option | Verdict |
|---|---|
| Top-down 2D | Clearest and cheapest. Less like The Sims. |
| **Isometric 2D** | **Chosen (user):** the most Sims-like and charming. Costs about 3× the art work, and overlapping characters need care. |
| Flat diagram | Clearest view of the system but loses the Sims feel. Reused as the **end-of-day report** style. **(call)** |

### Technology

| Option | Verdict |
|---|---|
| **A. TypeScript + Canvas 2D + HTML UI, no engine** | **Chosen.** The lightest on GPUs. Menus are easiest as HTML. The simulation runs headless for tests and balancing. |
| B. Phaser | Heavier. Its strengths (physics, action) aren't needed. Menus are clumsy inside the engine. |
| C. PixiJS (WebGL) | The user's first preference. Rejected because WebGL always runs on the player's GPU, and offloading it elsewhere isn't possible. The renderer stays swappable, so PixiJS could replace Canvas 2D later without touching the simulation. |

## 6. Game design

### 6.1 Setting and role
- The player is the Clinic Manager of one fictional KK. **(user, call for "one KK")**
- Later progression could expand to several KKs in a district. This fits a district-level audience, but it is out of scope for v1. **(call)**

### 6.2 The day loop **(user, structure; call, details)**

1. **Night before (about 22:00).**
   - Phone-style messages arrive, for example *"Dr, saya demam, esok nak EL 🙏"*.
   - The Clinic Manager looks at tomorrow's roster and fixes gaps:
     1. Redeploy a doctor from OPD to MCH.
     2. If the clinic's own pool isn't enough, request a **relief doctor from another clinic**.
   - Relief is arranged that night, so it's in place in the morning with no delay. **(user)**
   - Limit: a set number of relief requests per in-game week. Each one lowers "goodwill" with neighbouring clinics. Goodwill recovers over time. **(call)**
2. **Morning plan.**
   - Confirm the roster: who sits in which room or station.
   - Arrange SOP cards and their settings.
   - Read the day's forecast hints, for example "Sekolah berasrama ada program saringan minggu ini".
3. **Clinic session.**
   - Simulated and shown in isometric view, with pause, 1×, 2× and 4× speed.
   - Events happen during the session (section 6.7).
4. **Pause and adjust.**
   - The player can pause at any time to change the roster or SOP settings.
   - Mid-day changes take effect after a short briefing delay (about 10 in-game minutes) and cost some HCW satisfaction. **(user: cost; call: delay)**
   - Emergency actions during the day:
     - Pull a doctor from OPD. It's quick, but the OPD queue grows. **(user)**
     - A few rare "big lever" actions with a high cost. **(call)**
5. **End-of-day report** (in the flat-diagram style):
   - Lunch outcome.
   - Waiting time by visit type.
   - Idle time for each doctor.
   - Both satisfaction bars.
   - Bottlenecks highlighted, for example "Bilik Jururawat ANC: 6 dalam giliran pada 09:10".
6. **Next day.** Autosave.

**A day is the full clinic day (user):**
- 08:00–17:00. The crowd forms before opening.
- Registration closes at 16:30, 30 minutes before the clinic closes (official).
- Lunch break 13:00–14:00, Monday to Thursday (official). Friday's longer, state-specific break is left for later.
- Whether patients are still seen during the lunch hour, or the clinic pauses, is **(check)**.

**Length of a session:** at 1× speed, 1 in-game minute takes 1 real second. A full day (about 9 game hours) is then about 9 real minutes, or 2–4 minutes at 2× or 4×. Quiet stretches can be skipped with an automatic fast-forward. **(call)**

### 6.3 Clinic model for v1

**Stations, following the official KK flow** (Polisi Operasi KK 2024) and the user's practice:

| Station | What happens | Default staff | Typical service time (placeholder) |
|---|---|---|---|
| Primary triage (entrance) | Spots emergencies and sick walk-ins | PPK/JM | about 1 min |
| Registration counter | Registers the patient; reads today's appointments from CCMS | Clerk/PPK | 2–3 min (×2 on paper) |
| Secondary triage | BP and weight **(user)** | JM/PPK, assignable **(call)** | 3–5 min |
| ANC nurse room(s) | Routine antenatal check | JK/JM | 20–30 min **(user)**; booking visits longer |
| Doctor room(s) | Doctor review. **Each doctor room has 2 doctor seats (user).** The room shares one queue, and the next free doctor calls the next patient. **(call: shared queue)** | 2 MOs per room | 5–15 min by case |
| Blood taking / lab | Blood samples when scheduled | JTMP/nurse | 5 min |
| Pharmacy | Dispensing | PF/PPF | target ≤30 min (official) |
| **OPD (lighter)** | One combined queue → doctor → pharmacy. Exists so that borrowing its doctors has a visible cost. | MO | simple model |

- **Layout is fixed and room use doesn't change (user).**
  - Each room has one purpose, and doctors stay in their rooms. In Malaysian KKs, doctors mostly don't move around. **(user)**
  - The player's levers are the SOP cards and the **roster**: who sits in which seat, set the night before and in the morning plan.
  - The only movement during the day is the exception the user described: borrowing an OPD doctor into an empty MCH seat.
- **Default staffing (placeholder, confirmed through the data sheet):**
  - MCH: 1 doctor room (2 MOs), 2 ANC nurse rooms, 1 secondary-triage station, 1 counter.
  - OPD: 2 doctor rooms (4 MOs).
  - A new doctor sits in their senior's room as an extra person, not in a seat of their own. **(call)**

### 6.4 Patients
- **Every patient has:**
  - a visit type
  - **today's appointments** (nurse, doctor, lab), which set their route **(user)**
  - an arrival time
  - a priority-lane flag (pregnant women, the elderly, OKU, children aged 2 and under, per policy)
  - patience
- **MCH visit types for v1** (durations and shares are placeholders):

| Visit type | Route |
|---|---|
| ANC booking | long nurse visit, then long doctor visit (routine medical examination), then lab |
| ANC follow-up, nurse only | doctor appointment not due **(user)** |
| ANC follow-up, nurse then doctor | both due today **(user)** |
| ANC follow-up, doctor only | e.g. weekly BP trend or blood sugar profile (BSP) review **(user)** |
| Postnatal | to confirm |
| Child health / growth | to confirm |
| Immunisation | to confirm |
| Collect results / referral letter | short doctor visit |

- **Antenatal colour code** (putih / hijau / kuning / merah):
  - It shows the mother's complexity and how often she is reviewed.
  - All mothers see a doctor on schedule.
  - Red and yellow mothers can trigger a referral, which takes the doctor longer. **(user)**
  - Each mother has a colour; it affects her doctor time and the chance of a referral.
- **Arrival pattern (placeholder):**
  - A crowd before the 08:00 opening.
  - A peak from 08:00 to 09:30.
  - A taper to noon.
  - Appointments arrive around their slot if staggered appointments are on; otherwise they arrive early.
- Patients get **randomly generated fictional Malaysian names** and appearances (hijab, baju kurung, and so on).
- Patients **can't be moved individually** by the player. **(user, via option C)**

### 6.5 Staff
- **Roles in v1:**
  - MO (independent)
  - new MO, attached to a senior
  - JK/JM nurse
  - PPK
  - clerk
  - pharmacy staff, kept abstract
- **New doctors (user):**
  - A new MO adds hands but asks the senior questions, which slows the senior down.
  - They gain experience every day. After about 2–3 in-game weeks they become independent.
  - Pairing them with the right senior speeds this up. **(call: mechanic)**
- Each staff member has their own satisfaction, which feeds the HCW bar.

### 6.6 SOP cards (v1 set) **(user: system; call: specific cards)**

| Card | Settings | Unlocks |
|---|---|---|
| **Saringan di Kaunter** (sorting at registration) | For each visit type: route via the ANC nurse, or straight to the doctor after secondary triage. Start time. | Available from day 1, but the default is "everyone via the nurse" (first-come-first-served), so the player must find and change it. |
| **Laluan Khas** (priority lane) | Which groups get priority, and at which stations | Day 1 |
| **Pinjam Doktor OPD** (borrow an OPD doctor) | Trigger (MCH queue over N) and how many doctors | Day 1 |
| **Temujanji Berperingkat** (staggered appointments) | Slot length; patients per slot | After the first day with a crowd |
| **Pelan Kontingensi CCMS** (CCMS contingency plan) | Print tomorrow's appointment list the night before (on/off). Paper registration form. | After the first CCMS outage |
| **Pasangan Mentor** (mentor pairing) | Pair each new doctor with a senior | When the first new doctor joins |

- **Discovery comes from the settings, not from finding cards.** Some cards unlock through events, or through a "district memo" after a bad day. **(user)**
- **CCMS link (call):**
  - Saringan di Kaunter needs registration to see today's appointments.
  - When CCMS is down, sorting falls back to first-come-first-served, unless Pelan Kontingensi CCMS has printed the appointment list the night before. Checking each mother's antenatal record book is an option but slow.

### 6.7 Events (v1 set) **(user: list; call: effects)**

| Event | Effect |
|---|---|
| Emergency leave (night-before message) | A doctor is missing; it's resolved the night before |
| CCMS down / internet unstable | Registration takes twice as long; appointment info is lost unless the contingency card is on |
| Printer not connected | Slower registration and pharmacy (labels, slips) |
| Group from a boarding school or other institution | 15–30 extra walk-ins in a short window |
| Emergency walk-in | Takes one doctor for 30–45 min (stabilise and refer) |
| New doctor attached | A trainee joins (see 6.5) |
| Complaint (aduan) | Triggered by low patient satisfaction; costs time |

- Difficulty rises over in-game weeks: events become more frequent and overlap more.

### 6.8 Scoring **(user: headline; call: formulas)**
- **Headline: two milestones in the day.** Lunch comes from the user. "Leaving on time" was added once the game became a full day. **(call)**
  - **Lunch** (official 13:00–14:00, Monday to Thursday):
    - 🍛 **On time:** all doctors free by 13:00.
    - **Late lunch:** free by 13:45.
    - **Tak sempat makan:** not free by 13:45.
  - **Leaving** (clinic closes at 17:00):
    - 🏠 **Balik on time:** all patients done by 17:00.
    - **Overtime:** staff still working after 17:00. HCW satisfaction falls with every overtime minute.
- **Patient satisfaction:**
  - falls with waiting beyond the patient's patience, with crowding in the waiting area, and with priority patients being skipped
  - rises when patients are seen promptly
- **HCW satisfaction:**
  - falls with overload, mid-day rule changes, late or missed lunch, and repeated borrowing
  - recovers on good days
  - When it's low: more emergency-leave events and slower work.
- **Report figures:** average and maximum wait by visit type, idle minutes for each doctor, and patients waiting at 13:00.
- **No game over.** A poor run means more events, lower morale and an awkward district visit. **(call)**

### 6.9 Progression and campaign for v1 **(call)**
- **Campaign:** "Dua Minggu di KK", about 10 in-game clinic days.
  - Day 1 is a lightly guided tutorial that shows the MCH jam without telling the player the fix.
  - The days that follow bring events and unlock more cards.
  - The campaign ends with a **district officer visit** that reviews the two weeks of reports.
- After the campaign, an endless "biasa" (normal) mode lets players keep playing with random events.

### 6.10 Look and feel
- **Isometric 2D**, drawn in code: simple shapes for people, furniture and rooms, as in the mockup.
- Cut-away walls.
- Colour-coded purpose dots above patients. Speech bubbles for in-jokes.
- Doctor rooms show **two desks and two doctors**. The style mockup shows one, and the final art will correct this.
- **Characters:** tudung, baju kurung, white nurse uniforms, a queue-number display, and so on.
- Polished art can replace the shapes later, through Figma or hand-drawn sprites. **(call)**
- **Sound:** none in v1. **(call)**

## 7. Technical design

- **Stack:**
  - TypeScript and Vite: builds a static site.
  - Canvas 2D: the isometric clinic view.
  - Preact: the HTML menus over the canvas (roster, SOP cards, report, messages).
  - Vitest: unit tests.
  - Playwright: headless smoke tests in the cloud or CI.
- **Simulation core:**
  - A pure TypeScript module with no browser APIs.
  - Uses a seeded random generator, so the same seed and the same plan always give the same day.
  - Fixed time step of 1 in-game minute, with patients and staff as state machines.
  - Can run a full day headless in well under a second.
  - Used by the game, the tests, and a **balancing script** that runs many days and prints statistics.
- **Rendering:**
  - The renderer reads simulation snapshots and interpolates movement between ticks.
  - It draws in painter's order (back to front), using hit-testing for clicks on rooms and staff.
  - It's built to be swappable (see the PixiJS note).
- **Game data:**
  - JSON files in the repository: visit types, durations, staffing, events, SOP cards, and dialogue/joke lines.
  - **Source of truth is a Google Sheet** that the user and friends edit.
  - Claude reads it through the Google Sheets connector and updates the JSON in the repo. Every change goes through review.
- **Saves:**
  - Versioned save format in localStorage.
  - Autosave each day; three save slots.
  - Export/import as a `.json` file.
  - Migrations when the format changes.
- **Hosting:** a GitHub repository `kk-manager`, deployed to GitHub Pages by a GitHub Actions workflow on push to `main`.
- **Performance budget:**
  - At most about 80 characters on screen.
  - 30 fps cap; nothing redrawn when paused.
  - Starting download under about 500 KB.

## 8. v1 scope: the "MCH Pagi" milestone

**In:**
- one KK
- a detailed MCH unit
- a light OPD
- simple lab and pharmacy stations
- the night-before phase
- the six SOP cards and seven events listed above
- full clinic days (08:00–17:00)
- the lunch and leaving-time outcomes, both satisfaction bars and the end-of-day report
- the 10-day campaign plus endless mode
- saves with export
- English interface with Malay dialogue
- desktop layout
- low-graphics mode
- automated tests
- published at drakmal.com/kk-manager

**Out (later):**
- cloud saves and accounts
- several KKs or a district map
- other units (dental, NCD clinic, and so on)
- building or moving walls, or changing room use. Rooms stay fixed, as in real KKs. **(user)**
- a phone layout
- sound
- polished art
- an all-Malay interface option

## 9. Accuracy process
- MOH references are summarised in `docs/research/moh-guidelines-notes.md`.
- The user checks every workflow rule. User corrections win over guideline summaries.
- Placeholder numbers (durations, shares, staffing, arrivals) live in the Google Sheet. The user and friends tune them.
- Before release, two or three of the user's friends play a test build and give feedback.

## 10. Where Claude Code features fit (learning plan) **(user goal; call: mapping)**

| Feature | Use in this project |
|---|---|
| GitHub (via the `gh` CLI or a connector) | Repository, pull requests, Pages deploy, and the base for cloud sessions |
| Cloud session | Building, running and testing off the user's laptop |
| Google Sheets connector | Game data that the user and friends edit |
| Playwright plugin | Headless test playthroughs: load the game and play a day |
| Figma connector | Later: polished character and furniture art |
| `/code-review` | Before each release |
| Custom slash command or skill (`/playtest`) | Built together. Runs the balancing script and summarises a simulated week. |
| `/schedule` (optional) | Later: a weekly check that the live site loads |

## 11. Left to the builder
- File and module structure, state machines, the save format.
- Exact isometric drawing approach, sprite composition, hit-testing.
- Exact formulas for patience and satisfaction, and their weights. Tuned with the balancing script; the user checks the results.
- Text in the tutorial and menus. The user checks the Malay dialogue and jokes.
- Which UI library details to use within Preact.

## 12. Resolved questions
- **How long is a game day?** The full clinic day, 08:00–17:00. **(user)**
- **Can the player change the layout?** No. Rooms are fixed and room use doesn't change. Doctors stay in their rooms, and each doctor room has 2 doctors. **(user)**

## 13. Still to check with the user (doesn't block the plan)
- Whether patients are seen during the 13:00–14:00 lunch hour.
- The exact colour-code wording (4th edition).
- Postnatal, child-health and immunisation flows and timings.
- Whether drakmal.com is the custom domain of the user's `<username>.github.io` site (checked during setup).
