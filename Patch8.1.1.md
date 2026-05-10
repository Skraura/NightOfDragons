# DoD Tracker — Patch 8.1.1

## Summary

This patch completely reworks the OCR system to fix a hard crash on capture that
affected all users on Electron 29 + Node 18. Tesseract.js has been removed and
replaced with a fully offline, zero-dependency recognition pipeline.

---

## What was broken

Tesseract.js v5 spawns its recognition engine in a Node `worker_threads` Worker.
Electron 29 ships Node 18, and Node 18's `worker_threads` implementation changed
how it resolves worker script paths — it no longer accepts `file://` URL objects or
href strings passed directly; it requires a specific format that conflicts with how
Tesseract.js v5 constructs its internal worker.

**Symptom:** Every capture attempt crashed with:
```
TypeError: Only absolute URLs are supported
  at Worker.<anonymous> (tesseract.js/src/createWorker.js:247)
```
or alternatively:
```
TypeError: langPath is not a function
```

A secondary crash also occurred due to the raw PNG screenshot (~100MB on 1080p)
exceeding Electron IPC's ~64MB message size limit:
```
ERROR:connection.cc(711): Cannot send request of length 104121648
```

---

## What changed

### `electron/services/ocrService.js` — rewritten (v4 → v5)

**Tesseract.js completely removed.** Recognition is now handled by two methods:

**Method 1 — Template matching** (unchanged, already working in v8.1.0):
- Handles: all 22 stats, bloodline quality, gender, species, growth
- Uses `training-data/stats/`, `training-data/gender/`, etc.
- Dominant + recessive grades both recognized from filename convention
  (e.g. `Ax_B-.png` = dominant A+, recessive B-)

**Method 2 — Alphabet sliding-window OCR** (new, free, fully offline):
- Handles: player name, father/mother/grandparent names, skin dominant/recessive, ticks
- Uses `training-data/alphabet/` (A–Z, 0–9, HYPHEN, SPACE templates you already have)
- Slides a variable-width window across the pre-processed image, matching each
  position against every character template and greedily assembling the best string
- No internet, no API key, no native dependencies

**Method 3 — Claude Vision** (unchanged, optional paid fallback):
- Still available when `highAccuracyMode` is enabled and an API key is set
- Provides the best accuracy on unusual fonts or low-contrast screenshots

**`destroyWorker()`** kept as a no-op for API compatibility with `main.js`.

### `electron/services/screenshotService.js` — updated (v1 → v2)

The main-process capture path now compresses the screenshot to JPEG (quality 92)
before base64-encoding it for IPC transfer. This keeps the message well under the
64MB limit (~3–5MB instead of ~100MB) with no visible loss for template matching.

### `package.json`

- Version bumped to `8.1.1`
- `tesseract.js` removed from `dependencies`
- `tesseract.js-core` removed from `build.extraResources`
- `electron/tessdata` extraResource kept (no harm, folder is empty anyway)

---

## Migration / Install

```bash
# Remove the old Tesseract packages
npm uninstall tesseract.js tesseract.js-core

# Reinstall dependencies (nothing new to add)
npm install
```

If you see `Cannot find module 'tesseract.js'` errors after updating, make sure
you ran `npm uninstall tesseract.js` — the old package may still be cached in
`node_modules`.

---

## Known limitations of alphabet OCR

The sliding-window alphabet recognizer works well for clean, high-contrast in-game
text. It may struggle with:
- Very stylized or thin fonts
- Low-contrast screenshots (dark text on dark background)
- Names with special characters not in the training alphabet

If name recognition is inaccurate, enable **High Accuracy Mode** in Settings and
provide a Claude API key — Claude Vision handles any font reliably.

You can also improve accuracy by adding more images to `training-data/alphabet/<CHAR>/`
for characters that appear in your dragon names.

---

## What did NOT change

- All template matching logic (stats, bloodline, gender, species, growth) — unchanged
- Dominant / recessive detection from filename conventions — unchanged
- Calibration system — unchanged
- Auto-lineage linking (name → dragon ID matching) — unchanged
- CaptureConfirmModal pre-fill + user review flow — unchanged
- All Firebase, settings, hotkey, and export/import features — unchanged
