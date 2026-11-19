# KK Manager

A browser management game set in a Malaysian klinik kesihatan. You are the Clinic Manager: set the roster and the SOP cards, keep the mothers in the KIA (MCH) unit moving to the doctor, and get the doctors to lunch at 1 pm.

- **Campaign, "Dua Minggu di KK":** 10 clinic days (Isnin to Jumaat, twice), with phone messages each night (emergency leave, relief, complaints, the boarding-school bus), a new doctor on day 4, and the district officer's visit at the end. Then endless mode.
- **Free play:** one day at a time, any day type, every SOP card open.
- **Saves:** 3 slots in the browser, autosaved every night, with export and import as a file.

Planned home: `drakmal.com/kk-manager` (GitHub Pages, deployed by `.github/workflows/pages.yml` on every push to `main`).

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

The campaign's own numbers (goodwill, relief limit, trainee learning, emergency-leave chance, complaint threshold) are constants at the top of `src/campaign/campaign.ts` and `src/campaign/night.ts`.

## Layout

- `src/sim/`: the clinic simulation. Deterministic, minute by minute, no browser code.
- `src/campaign/`: campaign state, nights, district review and saves. Pure: storage comes in through an adapter.
- `src/game/`: isometric drawing, the clock and the day controller.
- `src/ui/`: Preact screens.
- `docs/superpowers/`: the design and the three implementation plans.

No MOH/KKM logos or names are used. Characters and clinics are made up.
