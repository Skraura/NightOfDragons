# What's New — v8.0.0 🐉

## The Big One

v8.0.0 is the first stable release of the DoD Tracker. Every feature from the original roadmap has been implemented, tested, and shipped across the 7.x series. Here's the full summary of what's in the app.

---

## 🔐 Auth & Roles

- **Persistent login** — credentials saved securely, re-authenticated on every startup
- **Role system** — `member` / `admin` / `dev` (no more `isAdmin` boolean)
- **Clan user management** — Admins can change any member's role directly from Settings
- **Auto-refresh** — every save/edit reflects instantly without restarting

---

## 🐉 Dragon Registry

- **3-line card layout** — Account · Species (line 1), Dragon Name (line 2), Owner (line 3)
- **Dragon names** — stored and shown separately from account name
- **Skin Purity** (renamed from Purity)
- **1 dragon per species per account** rule — duplicate blocked with a kill-confirmation popup
- **Registry scrollbar** — cards stay fixed size, list scrolls

---

## 📊 Stats

- **In-game layout** — 2-column (Body left, Resistances right), matching the game UI exactly
- **Bile Production** added, **Growth Rate** removed
- **Recessive stats** — collapsible section in ADD DRAGON (18 `r_stat_*` fields)
- **F8 OCR fills both** — dominant and recessive grades auto-filled from capture

---

## 📸 F8 Capture (OCR)

- **Fixed** — `Only absolute URLs are supported` error resolved (URL object vs string)
- **Recessive stats** — filenames like `A_B+.png` fill both `stat_strength` (A) and `r_stat_strength` (B+)
- **Training auto-loaded** — template matching ready on first capture, no manual reload needed

---

## 🗺 Map

- **1600×1600 coordinate space** — 800N/S and 800E/W matching the real game world
- **Smart stacking** — same species stack vertically, different species spread horizontally
- **Zoom-aware spread** — pins separate further as you zoom in
- **Click stack → popup list** — lists all dragons at that location, click any to navigate

---

## 🌿 Lineage

- **Crash prevention** — cycle detector strips circular edges before rendering
- **Renesting support** — male-as-own-father is valid; previous instance flagged for kill
- **Warning banner** — shows what was fixed instead of silently failing
- **OCR Names collapsible** — `▸ OCR Raw Names` toggle, hidden by default

---

## 💕 Mates & Harem

- **Smart filtering** — mate dropdown shows only same-species, opposite gender, no shared parents
- **Inter-species warning** — red badge on form and canvas
- **Harem cards** — click-to-toggle card grid, shared-parent candidates shown dimmed
- **Same-gender excluded** — males can't select males in harem (and vice versa)
- **Canvas mate panel** — all mate pairs shown per species with harem counts

---

## ⏱ Elder Ticks

- **Species-specific** — correct total ticks per species (ASD 49, BS 75, SS 80, FS/IR 110, BW 181)
- **Dual input** — raw tick count (accepts `33,3` with comma) + % progress, synced
- **BW mutation points** corrected to 46 / 91 / 136 ticks

---

## 💬 Feedback

- **Member access** — Feedback tab in main sidebar for all members
- **4 types** — Add Feature / Remove Feature / Fix Feature / Other
- **Subtasks, dragon link, visibility** — private or global
- **Upvote / downvote**, **expand/collapse**, **edit own**, **reply**

---

## ⚙️ Dev Console (role: dev)

- **Feedback Console** — filter, sort, reply, mark done, publish version notes
- **Simulations** — quick-create test dragons, 4 lineage scenarios, clear all sim data
- **OCR Training** — accessible directly from the dev sidebar

---

## 📢 What's New Modal

Version notes published by devs appear as a modal on first login after each release. You're reading one right now.

---

## 🔧 Firestore Rules

Paste `firestore.rules` (included in this zip) into Firebase Console → Firestore → Rules.

---

_Thank you for being part of the clan. Happy nesting. 🥚_
