# DoD Tracker — v5.2 To-Do List

Progress tracker for the v5.2 cloud account system upgrade.

---

## Phase 1 — Backend & Database

- [x] Bump DB version to 5
- [x] Add `role TEXT DEFAULT 'member'` column to `users` table (migration)
- [x] Update `users` CREATE TABLE definition to include `role`
- [x] Create `cloudAuthService.js` (PocketBase hybrid auth)
- [x] Update `authService.js` — add `role`, `seedAdmins()`, `updatePassword()`, `updateRole()`
- [x] Seed admin accounts on startup: **Skraura** and **Infernik** (idempotent)

---

## Phase 2 — IPC & Electron Bridge

- [x] Replace auth IPC handlers with hybrid (cloud first → local fallback)
- [x] Add `isAdmin` to session state
- [x] Patch `session:setUser` to carry `isAdmin`
- [x] Add `auth:getCloudSettings` IPC handler
- [x] Add `auth:saveCloudSettings` IPC handler
- [x] Add `auth:updateRole` IPC handler (admin only)
- [x] Add `auth:updatePassword` IPC handler (admin only)
- [x] Expose new methods in `preload.js`

---

## Phase 3 — Frontend

- [x] `App.jsx` — pass `isAdmin` through login flow and session sync
- [x] `AuthPage.jsx` — cloud status badge (🟢 online / 🔴 local mode)
- [x] `AuthPage.jsx` — admin `★` pip on quick-select user buttons
- [x] `SettingsPage.jsx` — Cloud Account Settings section
  - [x] Enable/disable toggle
  - [x] PocketBase URL input
  - [x] Test connection button
  - [x] Save button
  - [x] Setup guide (step-by-step PocketHost instructions)
  - [x] Admin indicator when logged in as admin
- [x] `Sidebar.jsx` — `★` admin badge next to username
- [x] `Sidebar.jsx` — `☁` cloud source indicator in subtitle

---

## Phase 4 — Documentation

- [x] `CHANGELOG.md` — v5.2 entry with full diff table
- [x] `TODO-v5.2.md` — this file

---

## Phase 5 — Build & Validation

- [x] `vite build` passes with 0 errors
- [x] Project zipped and delivered

---

## Backlog (future versions)

### v5.3 — Admin Panel
- [ ] Admin page: view all registered users (cloud + local)
- [ ] Admin page: change member role (member ↔ admin)
- [ ] Admin page: reset a member's password
- [ ] Admin page: delete a member account

### v5.3 — War Ping System
- [ ] Discord webhook URL field in Settings
- [ ] Four ping level buttons (Local / Important / War / Pulled Out)
- [ ] Ping button visible to all members
- [ ] Ping history log (last 20 pings)
- [ ] Cooldown timer to prevent spam

### v5.4 — Shared Lineage Canvas
- [ ] "Send to clan" button on Lineage tab
- [ ] Exports current species tree as JSON to a shared PocketBase collection
- [ ] Admin "Shared Lineage" tab: merged canvas from all members
- [ ] Conflict resolution when two members register the same dragon name

### v5.5 — War Ping System (admin controls)
- [ ] Admin window: manually trigger any ping level
- [ ] Ping permissions: restrict ping levels by role
- [ ] Ping announcement message customization

---

## Notes

**PocketBase free hosting:** https://pockethost.io — no credit card, ~500MB storage, sufficient for a clan registry.

**Collection setup in PocketBase admin panel:**
```
Collection name: users
Fields:
  username     Text    required, unique
  password     (auto-managed by PocketBase auth)
  isAdmin      Bool    default: false
```

**Fallback behavior:** If PocketBase URL is empty or `enabled: false`, the app behaves exactly like v5.1 — 100% local SQLite, no network calls. Existing databases are fully compatible.
