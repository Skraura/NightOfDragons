# What's New — v7.9.0

## 📸 F8 Capture — Fixed (again, correctly)

### Root cause of "Only absolute URLs are supported"
Tesseract.js v5 internally calls `new Worker(workerPath)` via Node's `worker_threads`. Node 18+ requires the path to be a **URL object** (not a string, not a `file://` href string). Previous fix passed a raw string path — this version passes `pathToFileURL(path)` which returns a URL *object*, which is what Node 18 requires.

### Recessive stats auto-filled from OCR
The training data filenames encode both stats:
- `A.png` → dominant A, no recessive
- `A_B+.png` → dominant A, recessive B+
- `Ax_A.png` → dominant A (visual variant), recessive A

The template service now parses the filename and returns both grades. The capture service stores them automatically as `stat_*` (dominant) and `r_stat_*` (recessive). **No user action needed** — capture with F8 and both fields fill in.

## ⚙️ Dev Console — Fully Implemented

Three tabs in the Dev sidebar section (blue ⚙):

### 💬 Feedback Console
Full thread management for devs:
- Filter by type, author role (Admin/Member), top/recent
- Expand/collapse threads, reply, mark as done
- **Publish version note** — paste WhatsNew markdown → appears in `/versionNotes` collection for members

### ⚗️ Simulations
- **Quick Create** — pick species/gender/growth/stat preset (18A, 18A+, 18F, 18B, Mixed, Random), instantly create a `is_sim: true` tagged dragon
- **Lineage Scenarios** — 4 pre-built trees: Basic trio, Two litters, Renesting, 3 generations — creates all dragons with correct parent links
- **Sim Dragon List** — shows all sim dragons, delete individually or clear all with one button

### 🎓 OCR Training
The existing training page is now accessible directly from the Dev tab — no more hidden route. Capture samples, label them, and the template matcher picks them up on next app start.

### Training auto-loaded on startup
`templateService.loadAllTemplates()` is called and `await`-ed during app startup before the window opens, so OCR is ready immediately on first capture.

---
_Next: v8.0.0 — Final integration, QA, Firestore rules review, release_
