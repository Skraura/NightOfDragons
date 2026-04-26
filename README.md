# DoD Tracker

A desktop app for tracking your dragons in **Day of Dragons** — with AI-powered stat capture via F8.

## Tech Stack

- **Electron** — desktop shell, global hotkeys, screen capture
- **React + Vite** — UI renderer
- **SQLite (better-sqlite3)** — local database, no cloud
- **Claude Vision API** — reads your in-game stat UI from screenshots
- **sharp** — crops screenshot regions per your calibration

## Setup

### Prerequisites
- Node.js 18+
- An Anthropic API key ([get one here](https://console.anthropic.com/settings/keys))

### Install & Run

```bash
npm install
npm run dev
```

For production build:
```bash
npm run build
```

## First Time Setup

1. **Create an account** — all data is local, no internet account needed
2. **Settings → Add API key** — your Anthropic key (stored locally in `localStorage`)
3. **Settings → Calibrate** — open Day of Dragons, go to a dragon's stat screen, then click Calibrate and draw boxes around each field
4. **Press F8 in-game** — the app captures, reads, and asks you to confirm the data

## Project Structure

```
electron/
  main.js              — Electron main process, IPC handlers, F8 hotkey
  preload.js           — Secure renderer↔main bridge
  database.js          — SQLite schema & init
  services/
    authService.js     — bcrypt register/login
    dragonService.js   — dragon CRUD
    captureService.js  — screenshot + Claude Vision pipeline
    boxConfigService.js— calibration box storage

src/
  pages/
    AuthPage.jsx       — Login/register screen
    DashboardPage.jsx  — Main layout
    SettingsPage.jsx   — API key + calibration launcher
    CalibratePage.jsx  — Transparent overlay for drawing boxes
  components/
    Sidebar.jsx        — Nav + stats
    DragonList.jsx     — Scrollable dragon list
    DragonDetail.jsx   — Selected dragon full view
    DragonForm.jsx     — Add/edit modal
    CaptureConfirmModal.jsx — Review F8 captures before saving
    TitleBar.jsx       — Custom frameless window controls
  lib/
    dragonData.js      — Species, skins, grades, constants
```

## How the F8 Capture Works

1. User presses F8 anywhere
2. `captureService.js` takes a full screenshot
3. For each calibrated box region, it crops that area with `sharp`
4. Each crop is sent to Claude Vision with a specific prompt (e.g. "What grade is shown?")
5. Results come back and are shown in `CaptureConfirmModal`
6. User confirms/corrects → saved to SQLite as a new dragon

## Data Model

All data lives in `~/.config/dod-tracker/dod-tracker.db` (Electron userData).

**tables:** `users`, `dragons`, `capture_history`, `box_configs`

Dragons store: species, gender, skin (dominant + recessive), role, 8 stat grades, ticks, elder status, father/mother lineage, notes.

## Notes

- Box calibration is per user + per screen resolution (e.g. `1920x1080`)
- The calibration overlay is a separate transparent Electron window
- The API key is stored in localStorage of the renderer process (not in SQLite) — it's only used in the Electron main process via a settings table workaround if needed
