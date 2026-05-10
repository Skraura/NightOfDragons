# DoD Tracker — Installation & Setup Guide

## Requirements

| Tool       | Version  | Download |
|------------|----------|----------|
| Node.js    | 18+      | https://nodejs.org |
| npm        | 9+       | Comes with Node |

That's it. No Python, no external tools, no account required.

---

## Quick Start (Development)

```bash
# 1. Clone or extract the project folder
cd dod-tracker

# 2. Install dependencies (first time only — takes ~2 minutes)
npm install

# 3. Start the app
npm run dev
```

The app window opens automatically. You're ready.

---

## First-Time Setup (in the app)

1. **Create an account** — click "Create Account" on the login screen. Username + password
   are stored locally in SQLite. No email, no cloud.

2. **Calibrate boxes** — go to Settings → Box Calibration:
   - Open Day of Dragons and navigate to any dragon's stat page
   - Click "Start Calibration" in the tracker
   - A transparent overlay appears over your screen
   - For each field listed (Species, Skin, Stats, etc.), click and drag a box
     around where that value appears in the game UI
   - Click "Save Layout"
   - This only needs to be done once per screen resolution

3. **Press F8 in-game** — the app captures the screen, runs OCR, and shows
   you the results to confirm before saving. Done.

---

## OCR Engines

### Tesseract (default — FREE, no setup needed)
- Runs entirely on your machine
- No API key, no internet, no cost
- Works well for standard game UI text

### Claude Vision (optional — better accuracy, costs money)
- Uses the Anthropic API (~$0.01–0.05 per F8 press)
- Enable in Settings → OCR Engine → Claude Vision
- Requires an API key from https://console.anthropic.com/settings/keys

---

## Building a Distributable

```bash
# Windows (.exe installer)
npm run build:win

# Linux (.AppImage + .deb)
npm run build:linux

# Output is in: dist-electron/
```

### Linux build dependencies (if needed)
```bash
# Debian/Ubuntu
sudo apt install rpm fakeroot dpkg

# For the app to run on other Linux machines:
# The AppImage is self-contained — no dependencies needed
```

---

## Linux Screenshot Notes

The app tries these methods in order:
1. **Electron desktopCapturer** — works on X11 and XWayland (recommended)
2. **grim** — Wayland native: `sudo apt install grim`
3. **scrot** — X11 fallback: `sudo apt install scrot`
4. **gnome-screenshot** — GNOME fallback

Day of Dragons runs via XWayland even on Wayland compositors, so method 1 should
always work if the game is running.

---

## Linux Wayland / F8 Hotkey

If the F8 global hotkey doesn't fire on pure Wayland (no XWayland), you may
need to grant the app the `GlobalShortcuts` portal permission:

```bash
# This is usually automatic. If not:
flatpak permission-set globalshortcuts dod-tracker yes
```

---

## Data Location

All data is stored locally:

| Platform | Path |
|----------|------|
| Windows  | `%APPDATA%\dod-tracker\dod-tracker.db` |
| Linux    | `~/.config/dod-tracker/dod-tracker.db` |

Back up this file to keep your dragon registry safe.

---

## Uninstall

- **Windows:** Control Panel → Programs → DoD Tracker → Uninstall
- **Linux (AppImage):** Delete the `.AppImage` file and `~/.config/dod-tracker/`
- **Linux (deb):** `sudo dpkg -r dod-tracker`
