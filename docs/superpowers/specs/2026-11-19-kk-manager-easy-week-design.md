---
status: approved by the user on 2026-11-19
supersedes: the player-facing parts of 2026-11-19-kk-manager-design.md (plan screen, SOP cards, isometric view, free play, save slots, 10-day campaign)
keeps: that spec's simulation, scoring, accuracy rules and constraints
---

# KK Manager: Easy week redesign

## 1. Why

The user played v1 and didn't like it. The game opened on forms (roster and five SOP cards), then the player mostly watched an isometric view made of blocks. The user wants:
- no forms at the start;
- a top-down 2D clinic;
- problems that interrupt the day as popups, with options to pick.

Players are still KK and district-office staff, so workflows must stay accurate, with Manglish in-jokes. The core lesson is the same: route patients by purpose of visit so doctors aren't idle while the queue grows.

## 2. Goals, non-goals, anti-goals

**Goals**
- The first page has three difficulty boxes: Easy (KK Jenis 4), Medium (Jenis 3), Hard (Jenis 1). Only Easy is playable in this build.
- An Easy run is a week, Isnin to Jumaat. Each day the clinic runs by itself, and the player acts only through popups.
- Patients wait for a doctor **room**, assigned by room number at registration. A missing doctor shows as a growing queue outside that door.
- Each patient shows their mood as an emoji.

**Non-goals for this build**
- Medium and Hard play. Their boxes are shown, locked ("Coming soon").
- Hands-on actions between popups (clicking staff or rooms). This is option B, for later modes.
- Drawn sprite art and sound.

**Anti-goals**
- Any form or settings page before the day starts.
- Popups that are wrong for a real KK. The user is the authority on wording and choices.
- Dental services: dental patients register at the dental clinic, not the health clinic.

## 3. Constraints (unchanged from v1)

- Canvas 2D, at most 30 fps, and the loop sleeps when idle (weak MX150 GPU). No browser previews on the user's laptop; checks are headless only.
- `src/sim` stays free of browser code. Campaign code stays pure.
- English interface; Malay/Manglish dialogue. "Clinic Manager", never "FMS", for the player. No MOH/KKM logos or names.
- Under 500 KB of JS. Published at https://drakmal.github.io/kk-manager/ from `main`.
- Commits use the GitHub private email (set in the repo's git config).

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| 1. Keep the engine, replace what the player sees | Reuses the tested simulation, scoring and saves. The sim gains room queues, an ultrasound step and popup triggers. | **Chosen by the user** |
| 2. Rewrite from scratch | Clean slate, but throws away tested lunch, scoring and save logic for no player gain | Rejected |
| 3. Keep v1 as a "classic" mode alongside | Two games to maintain; the user doesn't like v1 | Rejected |

Look: top-down Canvas 2D drawn from shapes (rooms as floor plans with desks, chairs, the doctor's table and the ultrasound cart; people as heads and coloured bodies; mood emoji above patients). Chosen as the recommendation inside approach 1.

## 5. The game

### 5.1 First page
Three boxes side by side: **Easy · KK Jenis 4 · "Isu minimum"**, **Medium · KK Jenis 3 · "Isu sederhana"** (locked), **Hard · KK Jenis 1 · "Semua isu"** (locked). The Easy box shows **Start** when there's no saved week, or **Continue (Rabu)** and **Start over** when there is.

### 5.2 The Easy clinic (KK Jenis 4)
Services from Polisi Operasi KK 2024, minus dental. Seen from above:
- **Main flow:** entrance → primary triage → registration counter → secondary triage (MCH triage / OPD triage) → doctor rooms → lab and X-ray as needed → pharmacy → exit.
- **MCH:** ANC nurse room, immunisation, and **one MCH doctor room with two doctors and an ultrasound machine**.
- **OPD:** **two doctor rooms (Bilik 1, Bilik 2), two doctors each.**
- **Emergency room** (used by the emergency news).
- **Side rooms:** physiotherapy/occupational therapy, nutrition/dietetics. They are drawn, with a few appointment patients each, and don't use doctors.
- Volume: about 160 patients a day (40 MCH, 120 OPD), the bottom of Jenis 4.
- Staff start in their default places. No roster to set.

### 5.3 Room queues
Each doctor room has its own queue, shared by the two doctors in it. The registration counter gives each patient a room number: MCH patients go to the MCH doctor room; OPD patients alternate Bilik 1, Bilik 2, 1, 2… A patient waits for their room even if the other room is free.

### 5.4 Ultrasound
Used in the MCH doctor room: every booking visit, and about 30% of other antenatal doctor visits. It adds 5–10 minutes to that consultation.

### 5.5 Popups
- The clock stops while a popup is open. Answering costs nothing.
- A popup has a sender, a line of Malay/Manglish, and 2–3 choice buttons, or a single **OK** for news.
- A choice takes effect immediately.

| When | Popup | Choices → effect |
|---|---|---|
| Any day, 08:30 and 14:30, only if patients are registering and an MCH doctor hasn't had a patient yet in that session | "Pesakit semakin ramai mendaftar, doktor belum terima pesakit." | **Hantar ibu 'doktor sahaja' terus ke doktor** → Saringan on for doctor-only antenatal visits, for the rest of the week · **Ikut giliran biasa** → no change; this popup won't show again that day |
| Isnin 12:50, only if a doctor room has 5 or more waiting | "Masih ada N pesakit depan bilik doktor." | **Doktor makan dulu, sambung 2 petang** → doctors go to lunch at 13:00 whatever the queue · **Habiskan dulu** → doctors go once their queue is empty (lunch may be late) |
| Selasa 09:30 | A pakcik complains he's been standing for an hour | **Buka Laluan Khas** → priority for elderly and pregnant at registration, triage, doctor rooms and pharmacy, for the rest of the week · **Minta dia tunggu** → no change |
| Rabu 09:00 | "Printer tak connect." | **Tulis tangan slip** → registration +2 min and pharmacy +2 min until 12:00 · **Panggil IT, tunggu** → the counter stops for 20 minutes, then the printer works for the rest of the day |
| Night before Khamis (shown at 07:00, before the clinic opens) | An MCH doctor: "Dr, saya demam, esok nak EL 🙏" | **Minta relief klinik lain** → a relief doctor takes the seat for the day · **Pinjam doktor OPD** → an OPD doctor moves to the MCH room for the day; their OPD room runs with one doctor. (No "leave it empty": MCH must be filled.) |
| Jumaat 10:30 | News: emergency walk-in, chest pain | **OK** → one OPD doctor from Bilik 1 goes to the emergency room for 30 minutes. That room's queue grows; the doctor resumes their own queue afterwards. |

Emergencies are handled by the unit's own doctors: OPD emergencies by OPD doctors, MCH emergencies by MCH doctors (the latter is for later modes).

### 5.6 Patient mood emoji
Drawn above each patient: 😊 waited under 15 min · 😐 15–30 min · 😟 30–60 min · 😠 over 60 min (past their patience). The thresholds use the same waiting time as the patient satisfaction score.

### 5.7 During and after the day
- HUD: day name and clock, Pause, 1× 2× 4×, patient and staff satisfaction bars, the lunch chip. Pausing is free.
- End of day: lunch on time or not, balik on time or overtime, both satisfaction scores, the slowest visit types, and **Continue to Selasa**.
- After Jumaat: the district officer's visit with a grade A–D for the week and remarks, then **Play another week**. Medium shows as "Coming soon".
- The week autosaves at the start of each day. Reloading resumes at the start of that day.

### 5.8 Removed from the player's view
Plan screen, roster editor, SOP cards, day-type picker, free play, the three save slots and export/import, the night screen, the new doctor and mentor card, goodwill and complaints.

## 6. Technical outline

- **Sim** (`src/sim`): stations can belong to a room group (OPD Bilik 1 and 2). Registration assigns the room in turn. New levers: "lunch at 13:00 regardless of queue", "counter stops for N minutes", and "printer fixed early". Ultrasound is a step with a chance and minutes. Existing levers cover Saringan, Laluan Khas, relief, borrowing, the printer and the emergency (`emergencyWalkIn` fixed at 30 min, Bilik 1).
- **Popups** (`src/campaign` or a new `src/popups`): pure definitions with a trigger (time and/or condition on the sim snapshot) and choices, each mapped to a `PlanChange` or an event. The day controller checks triggers each step, stops the clock, and applies the answer.
- **Data**: a Jenis 4 data set (stations, rooms and layout, staff, visit types including the side rooms and ultrasound). Kept in the Google Sheet like today.
- **Game** (`src/game`): a top-down renderer replaces the isometric one (same draw-list → paint split, hit-testing and sleeping loop).
- **UI** (`src/ui`): difficulty page, popup dialog (role="dialog", keyboard focus), HUD, end-of-day and district screens. Old screens are deleted.
- Tests: the simulation tests stay; UI tests for removed screens are deleted; new tests cover room queues, triggers, each popup's effect and the week flow, plus a headless e2e test that plays a day.

## 7. Calls the builder made (the user can change these)
1. The clock pausing for a popup costs nothing; manual pause is free too.
2. The idle-doctor popup is triggered by the clinic's state, not a script, and stops after "Ikut giliran biasa" for that day.
3. Saringan and Laluan Khas stay on for the rest of the week once chosen.
4. The lunch popup only shows if a doctor room has 5 or more waiting at 12:50.
5. The EL message comes the night before Khamis and is shown at 07:00, before the clinic opens. On Easy, relief is always available (no goodwill).
6. The counter gives OPD room numbers in turn (1, 2, 1, 2…).
7. Ultrasound: every booking visit plus about 30% of other antenatal doctor visits, 5–10 minutes.
8. Mood emoji thresholds: 15, 30, 60 minutes.
9. One autosave per difficulty instead of three slots; export/import removed.
10. The district grade is rescaled for 5 days (A needs lunch on time on 3 days or more).

## 8. Left to check with the user
- Whether the side rooms (physio/OT, nutrition) should send patients through the main registration counter.
- Medium (Jenis 3) and Hard (Jenis 1) problem lists and layouts, when we get there.
