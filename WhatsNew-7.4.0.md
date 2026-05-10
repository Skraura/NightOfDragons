# What's New — v7.4.0

## 🗺 Map — Coordinate Space Expanded
The map now uses the full in-game coordinate range: **800N/S and 800E/W** (1600×1600 total, matching the real game world). Coordinate inputs now accept values up to 800. Existing pin positions are preserved — they were already stored as 0–1 fractions of the map image.

## 📍 Improved Pin Stacking
- **Same species at same location** → pins stack with a small vertical offset (zoom-aware — spread grows with zoom level)
- **Different species at same location** → pins spread horizontally side-by-side, one column per species
- The count badge on the group leader shows the total dragons at that spot

## 🖱 Click Stack → Mini Popup
Clicking a stacked group now opens a **mini popup list** showing all dragons at that location. Each row shows: species emoji, dragon name, species code, and gender. Click any row to navigate to that dragon's detail. Click the map background or ✕ to close.

---
_Next: v7.5.0 — Lineage system rewrite (renesting rules, loop prevention, crash-safe canvas, parent merging lines)_
