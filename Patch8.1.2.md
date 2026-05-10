# DoD Tracker — Patch 8.1.2

## Summary

Stat recognition completely reworked from image-histogram matching to
**color-guided glyph OCR**. A new **dev training capture tool** (Ctrl+F5)
lets dev/admin users label crops in real-time to build up the training dataset.
Confidence gap flagging added for icon matches.

---

## Why stats were misidentifying

The v8.1.1 approach used histogram + pHash to compare the entire stat crop
against stored training images. This failed because:

1. **Stats are text, not icons** — the game renders "A+", "C-" etc. as
   yellow/white glyphs on a black background. Histogram comparison of the
   full crop (including background) is dominated by the black background
   and misses the actual character differences.

2. **Crop sizes vary** — every user's calibration produces different crop
   dimensions, so the same "C+" on two screens produces completely different
   histograms.

---

## What changed

### `electron/services/ocrService.js` — v6.0

**Color-guided glyph OCR for stats and bloodline quality:**

1. Normalize crop to canonical size (120×60px for stats, 80×50px for bloodline)
2. Isolate **yellow pixels** (R>170, G>120, B<90, R−B>100) → dominant grade mask
3. Isolate **white pixels** (R>190, G>190, B>190, channel spread <40) → recessive grade mask
4. Run sliding-window alphabet template matching on each isolated mask
5. Clean result through grade validator

This works regardless of crop size or background because it only looks at
the colored glyph pixels.

**Icons unchanged** — gender, species, growth still use pHash/histogram
matching via templateService, which works well for icon images.

### `electron/services/templateService.js` — confidence gap

`matchTemplate()` now returns a `gap` field: the difference between the
best and second-best match scores. A small gap means the top two candidates
are very close (e.g. B vs C), indicating low certainty. This is used by
ocrService for confidence-flagging (idea 4).

Also added:
- `getWritableTrainingDataDir()` — in production, new training samples are
  saved to `userData/training-data/` instead of the read-only asar bundle
- `saveBatchSamples(entries)` — saves multiple labeled crops at once

### `electron/services/captureService.js`

After each capture, all cropped regions are stored in memory (`_lastCrops`).
The dev training tool retrieves these crops for labeling via `getLastCrops()`.

### `electron/main.js`

- **Ctrl+F5** global hotkey registered at startup (dev/admin only). Triggers
  a full capture then sends crops + OCR results to the renderer as a dev
  training payload.
- `training:saveBatch` IPC handler — saves labeled crops, enforces dev/admin
  role check in the main process.
- `training:getCrops` IPC handler — returns the last crop cache.

### `electron/preload.js`

New `window.api.training` methods exposed:
- `saveBatch(entries)` — save labeled crops
- `getCrops()` — get last capture crops
- `onDevCapture(cb)` / `onDevCaptureError(cb)` / `removeDevListeners()`

### `src/components/DevCaptureModal.jsx` + `DevCaptureModal.module.css` (new)

Full-screen modal shown on Ctrl+F5 (dev/admin only). Shows:
- Each cropped region as an image
- Dropdown to select the correct label (pre-filled with OCR guess)
- For stats: separate dominant + recessive dropdowns
- Save button → calls `training:saveBatch` → images written to training-data/

---

## How to use the dev training tool

1. Open the game to a dragon's stat page
2. Press **Ctrl+F5** (must be logged in as dev or admin role)
3. The modal opens showing all cropped regions
4. For each crop, confirm or correct the label in the dropdown
5. Click **Save Training Samples**
6. Labels are saved to `training-data/` and caches are immediately invalidated
7. Next capture will use the new samples

Repeat across multiple dragons / screen sizes to build a robust dataset.

---

## Files changed

| File | Change |
|------|--------|
| `electron/services/ocrService.js` | Color-guided glyph OCR for stats |
| `electron/services/templateService.js` | Gap scoring, writable dir, saveBatch |
| `electron/services/captureService.js` | Last-crops cache for dev tool |
| `electron/main.js` | Ctrl+F5 hotkey, training:saveBatch, training:getCrops |
| `electron/preload.js` | New training IPC surface |
| `src/components/DevCaptureModal.jsx` | New dev training UI |
| `src/components/DevCaptureModal.module.css` | New dev training styles |
