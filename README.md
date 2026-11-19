# KK Manager

A browser management game set in a Malaysian klinik kesihatan, seen from above. You are the Clinic Manager: keep patients moving to the doctor, and get the doctors to lunch at 1 pm.

- **Pick a clinic:** Easy (KK Jenis 4), Medium (KK Jenis 3) or Hard (KK Jenis 1). Only Easy is playable so far.
- **The Easy week:** Isnin to Jumaat. The clinic runs by itself; problems pop up and you choose what to do (patients piling up while the MCH doctors wait, lunch, a complaint, the printer, a doctor on EL, an emergency). After Jumaat the district officer grades the week.
- **Patients** queue for their doctor room (Bilik 1, Bilik 2, the MCH room with its ultrasound) and show their mood: 😊 😐 😟 😠.
- **Saves:** the week is saved in the browser at the start of each day.

Play it at https://drakmal.github.io/kk-manager/ (GitHub Pages, deployed by `.github/workflows/pages.yml` on every push to `main`).

## Run it

Needs Node 22.12 or later (Node 24 recommended).

```
npm install
npm test          # unit tests (Vitest)
npm run build     # production build into dist/, checks the JS stays under 500 KB
npm run preview   # serves dist/ at http://localhost:4173/kk-manager/
npm run e2e       # headless browser tests (Playwright, GPU off); E2E_PORT=4174 if 4173 is busy
npm run sim -- --seed 1 --days 5   # headless clinic days in the terminal
```

## Game data and the Google Sheet

The clinic's numbers (stations, visit types, staff, arrivals, tuning) live in `src/sim/data/*.json`. They are also kept in a Google Sheet, "KK Manager game data", so they can be edited without touching code. To change the game, edit the sheet, then ask Claude to "pull the sheet": it compares the sheet with the JSON files, shows what changed, and updates the files once you agree.

The popups’ times and thresholds are constants at the top of `src/popups/popups.ts`. (The sheet’s Tuning tab still has a "Campaign" group from the earlier 10-day campaign; it is no longer used.)

## Layout

- `src/sim/`: the clinic simulation. Deterministic, minute by minute, no browser code.
- `src/popups/`: every popup: when it fires, its text and what each choice does.
- `src/week/`: the Easy week, saves and the district review. Pure: storage comes in through an adapter.
- `src/game/`: the top-down drawing, the clock and the day controller (which stops the clock for popups).
- `src/ui/`: Preact screens.
- `docs/superpowers/`: the designs and the implementation plans.

No MOH/KKM logos or names are used. Characters and clinics are made up.
