# DoD Tracker — Changelog

## Beta1.1 (2026-05-10)

### Capture System — Percentage-Based Calibration
- Box positions are now stored as **percentage ratios** (0.0–1.0) instead of absolute pixels
- The capture engine resolves those ratios at runtime against the actual screenshot dimensions, so **one calibration works on every screen resolution automatically**
- `localStore` stores a single `boxconfig-pct.json`; no more per-resolution files
- A **Dev-authored bundled calibration** (`resources/bundled-calibration.json`) ships with the build — users who never calibrate still get sensible defaults
- Dev "Save as Bundled" button in the calibration window writes directly to the resources folder, so the next packaged build ships with the Dev's latest layout
- Calibration progress bar added (% complete, field count)
- `captureService` now reads resolution from the screenshot metadata instead of querying the display, so off-screen or virtual display captures are always correct

### Dev Tools
- Dev shortcut **Ctrl+Shift+F5** added as an alternative to Ctrl+F5 for the dev data-store / OCR-training window (both registered at startup; both are no-ops for non-Dev/Admin users)
- Settings card for Devs now lists both shortcuts and explains the bundled-calibration workflow

### Bug Fixes
- **Registry card cutoff** — cards at the bottom of the grid were visually cut off despite the scrollbar being present. Fixed by adding `min-height: 0` to `.main`, `.content`, and `.list` so the flex tree can properly shrink, plus a `padding-bottom: 40px` on the grid container for breathing room

---

## Beta1.0 (2026-05-09) — First Public Release

### Access Control
- **Lineage & Feedback tabs** are now grayed out and non-clickable for members; Admin and Dev roles retain full access
- **Breeder clan role** in DragonForm is now restricted to Admin/Dev — members cannot assign or see this option in the dropdown
- **Breeder Pairings** list in the Nesting Calculator is Admin/Dev only and invisible to regular members

### Nesting Calculator — Smart Parent Selection
- Selecting a mother now transforms the father selection into a **filtered popup** (and vice versa)
- The popup lists only dragons that are: the **same species** as the first selection, **opposite gender**, and with **no shared direct parents**
- Search bar inside popup for quick name lookup
- Breeder pairings quick-load panel (Admin/Dev only): lists all compatible Breeder×Breeder pairs by species, click to load into calculator

---

## v6.1.0 (2026-04-22)

### New Features

#### Firebase Auth — Email-based login
- Users now sign in with **email + password** (not username)
- Registration requires an email, password, and a **display name** (your main Steam handle)
- Session persists across restarts via local JSON token

#### Multi-Account (Steam handles)
- One Firebase user can own **multiple in-game accounts** (Steam handles)
- Manage accounts in **Settings → Steam Accounts** — add or remove handles
- When adding a dragon, a dropdown lets you choose which account owns it

#### Map System
- New **Map** tab in the sidebar (between Lineage and Settings)
- Full interactive world map: mouse-wheel zoom, click-drag to pan
- Dragon pins per species using emoji icons + first letter of growth stage
- **Click** a pin → jumps to that dragon in the Registry
- **Hold-drag** (400 ms) a pin → live repositions it; release saves the new location
- Filter by species and growth stage
- Admin **Clan tab** shows all dragons from all members, with optional user filter
- Dead dragons (💀) shown greyed on the map

#### Dragon Location
- Location field added to Add Dragon / Edit Dragon form
- 48 named locations from the in-game map (dropdown), plus custom X/Y% coordinates
- Location badge shown on dragon cards in the registry

#### Registry — Right-click Context Menu
- **Left-click** a dragon card to open the context menu:
  - Edit
  - Change Location
  - Kill Dragon ☠ (keeps dragon in lineage with 💀 marker, greyed out)
  - Delete (permanent)

#### Dragon Form Improvements
- **Name field removed** (was optional, caused confusion)
- **Account selector** — choose which Steam handle owns this dragon
- **Location picker** — 48 known locations or custom coordinates
- **Cross-clan lineage** — Father/Mother dropdowns show your own dragons AND other members' dragons of the same species. Other members' dragons display only as "Owner's ♂ Species" — no stats or skins are leaked
- Dead dragons remain selectable as parents with 💀 prefix

#### F8 Capture → Full Dragon Form
- F8/hotkey capture no longer opens a minimal review modal
- OCR data is injected directly into the full **Add Dragon** form, pre-filling species, gender, growth, all stats, bloodline quality, lineage names, and traits
- User can complete location, account, clan role, skins before saving — same as manual add

#### Lineage — Dead Dragons
- Dragons marked as dead still appear in lineage trees with a 💀 icon and greyed card
- Dead dragons can still be selected as parents/grandparents in lineage dropdowns

### Fixes

- **Tesseract OCR crash** — Fixed all 8 capture field failures (`stat_bile_production`, `father_name`, `mother_name`, etc.). Root cause: `pathToFileURL()` produces `file://` URLs that Node.js worker threads don't accept as module paths. Fixed by using `require.resolve()` directly for `workerPath` and `new URL('file://'+...)` for `corePath`

### Cleanup

- Removed orphaned `ClanCanvas.jsx` page (replaced by `ClanLineageCanvas` component)  
- Removed stale services: `authService.js`, `boxConfigService.js`, `dragonService.js`, `exportService.js`, `settingsService.js` (all functionality now in `firebaseService.js` and `localStore.js`)
- Fixed duplicate `getCloudSettings` key in `preload.js`
- Removed unused `useEffect` imports from `AuthPage.jsx` and `DragonForm.jsx`

---

## v6.0.0 (2026-04-21)

### New Features

#### Clan Lineage Canvas (Admin-only)
- New **Clan Canvas** entry in the admin section of the sidebar
- Shows every registered dragon from every clan member in a single family-chart canvas per species
- **Stat Pool Diversity** heatmap bar — grade distribution across all clan dragons
- Filter panel: by member, role, gender, elder status, min bloodline quality
- Dragon cards show **owner username** badge
- Multi-lineage group pagination (same as personal Lineage)
- Live Reload button
- Access-denied gate for non-admins

---

## v5.3.0 (2026-04-18)

- Migrated from SQLite + PocketBase to **Firebase Firestore + Firebase Auth**
- Users and Dragons stored in Firebase; calibration, settings, crop history remain local
- `growth` field replaces `role` in OCR/calibration (Hatchling/Juvenile/Adult/Elder)
- `clan_role` (Fighter/Breeder) is internal meta only, not OCR'd
- Training data hard-coded / bundled; new folder structure with dominant stat sub-images
- Box calibration now stored as local JSON (no DB)
- App minimises before calibration so the game is fully visible
- Tesseract `workerPath` fix (v5.3 attempt — fully resolved in v6.1)
