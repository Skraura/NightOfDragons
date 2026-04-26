# Day of Dragons — UI Redesign Documentation

## Overview

This document describes all visual and functional modifications made to the Day of Dragons dragon tracker application.

---

## 1. Theme System

### Dark / Light Mode
- **Default theme:** Dark (`--bg: #0d0d0f`, near-black background).
- **Light theme:** Clean off-white (`--bg: #f4f4f6`), white surfaces.
- Switching between themes is done via **Settings → "Light theme" toggle**.
- All colors are driven by CSS variables, so the entire UI flips instantly without any page reload.

| Variable | Dark | Light |
|---|---|---|
| `--bg` | `#0d0d0f` | `#f4f4f6` |
| `--surface` | `#16171b` | `#ffffff` |
| `--surface2` | `#1e1f26` | `#f0f0f4` |
| `--text` | `#f0f0f2` | `#0d0d0f` |
| `--muted` | `#8a8a9a` | `#5a5a70` |

---

## 2. Dragon Cards

### Top Color Bar
- Each card has a **3px colored top border** whose color matches the dragon's **skin**.
- Color mapping:

| Skin | Color |
|---|---|
| Crimson | `#c0392b` |
| Gold | `#d4ac0d` |
| Leucistic | `#a8c4d0` |
| Leumelan | `#7f8c8d` |
| Melanistic | `#2c3e50` |

---

### Gender Colors
- **Female ♀** is displayed in **pink** (`#ff7eb3`).
- **Male ♂** is displayed in **blue** (`#4da6ff`).
- The gender symbol appears both in the card title row and as a colored badge in the meta row.

---

### Dragon Type Badge + Icon
Each dragon species gets its own **color accent and icon**:

| Species | Icon | Color |
|---|---|---|
| Shadow Scale | 🌙 Moon | `#7c5cbf` (purple) |
| Flame Stalker | 🔥 Fire | `#e5713a` (orange) |
| Acid Spitter Drake | ☣ Biohazard | `#4caf50` (green) |
| Blitz Striker | ⚡ Lightning | `#f5c542` (yellow) |
| Broodwatcher | 👁 Eye | `#4db6ac` (teal) |

The badge uses the species color for text and a tinted background (`color + 15–18% opacity`), matching a soft pill style.

---

### Stats Color Gradient (D → A++)
Stats go through a red-to-green gradient based on rank order:

```
F → E → D- → D → D+ → C- → C → C+ → B- → B → B+ → A- → A → A+ → A++
```

- **F / D range:** Red tones (`rgb(220, 60, 60)`)
- **C / B range:** Orange-yellow tones
- **A / A++ range:** Green tones (`rgb(60, 220, 60)`)

Each stat value also renders a **small fill bar** that visually shows the progress from weakest to strongest.

---

### Dominant / Purity / Skin Cells
- **Dominant:** Shown in indigo (`#5c72f5`) when active, greyed out when not.
- **Purity:** Shown in soft purple (`#a78bfa`) when present.
- **Skin:** Colored using the skin color mapping above.

---

## 3. Settings Panel

Accessible via the **"Settings" button** in the top bar. A slide-in panel appears from the right with:

- **Light theme toggle** — switches the entire app between dark and light mode.
- **Show owner toggle** — shows or hides the "Owner: X" line on each card.

Clicking outside the panel (on the overlay) closes it.

---

## 4. Search & Filtering

- **Search bar** — filters dragons by name, species, skin, or owner (case-insensitive).
- **All / ♀ Female / ♂ Male** filter buttons — filters the grid by gender.
- A count line (`Showing X of Y dragons`) updates live as filters are applied.

---

## 5. Card Interactions

- **Hover:** Card lifts slightly (`translateY(-2px)`) and border brightens.
- **Heart button:** Click to like/unlike a dragon. Liked dragons show a filled red heart (`♥`), others show an outline (`♡`).

---

## 6. Layout & Typography

- **Grid:** Responsive auto-fill with a minimum card width of 300px.
- **Font:** System UI / Inter for a clean modern look.
- **Rounded cards:** `border-radius: 14px` for soft, modern containers.
- **Stat cells:** Nested `border-radius: 8px` secondary surface tiles for each attribute.

---

## 7. Data Notes

The demo uses sample dragon data matching the screenshot provided (Bloodie, Thunder, Golden, Chessy, Goldie, Misty + additional generated dragons for showcase). To connect this to the live `DoD_Public_Dragon_Sheet.xlsx` data, the dragon array (`DRAGONS`) should be populated from the spreadsheet's **Dragons** sheet, mapping columns: `Specie → species`, `Gender → gender`, `Skin → skin`, `Role → age`, etc.
