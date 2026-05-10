# What's New — v7.8.1 (Hotfix)

## 🗺 Map Coordinates — Full 1600×1600 Space Fixed
The DragonForm location picker was still converting coordinates using the old 100-unit range (`×200`) even after the MapPage was updated. This meant only coordinates within 0–100 in each direction were correctly mapped. Fixed: DragonForm now uses `×1600` (800N/S, 800E/W) consistently with MapPage.

## ⏱ Elder Ticks — Species-Specific Input with Comma Support
The Progression section in ADD DRAGON now shows **two linked inputs**:

| Input | What it does |
|---|---|
| **Elder Ticks** | Raw tick count — accepts both `.` and `,` (e.g. `33,3` for ASD) |
| **% Progress** | Percentage — auto-calculated from tick count and species total |

Both inputs are synced: editing one updates the other. The species total is shown next to the label (e.g. `/ 49 total for ASD`). Values come from the Elder Ticks spreadsheet:

| Species | Total ticks to Elder |
|---|---|
| ASD / BIO | 49 |
| BS | 75 |
| SS | 80 |
| FS / IR | 110 |
| BW | 181 |

BW mutation point percentages have also been corrected from the spreadsheet (46 / 91 / 136 ticks).

## 🧬 Harem — Same Gender Excluded
Males can no longer appear in a female dragon's harem, and vice versa. Harem candidates are now filtered to **same species + opposite gender only**, matching the Primary Mate filter.

## 📸 F8 Capture (OCR) — Fixed
The OCR worker was failing with:
```
The worker script or module filename must be an absolute path or a relative path
starting with './' or '../'. Wrap file:// URLs with new URL.
```
Root cause: Tesseract.js v5 in Electron's main process does **not** accept `file://` URLs for `workerPath`/`corePath`/`langPath`. Fixed by passing absolute filesystem paths directly instead of converting via `pathToFileURL()`. All capture fields (stats, species, gender, ticks, lineage names) should now OCR correctly.

---
_Next: v7.9.0 — Dev console & simulation tools_
