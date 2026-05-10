# What's New — v7.8.2

## 💬 Feedback System — Member Side (fully implemented)

### Accessible to everyone
The **Feedback** tab now appears in the main sidebar for all clan members. No login required beyond your normal account.

### Submitting feedback
Click **+ New Feedback** to open the submission form:

| Field | Details |
|---|---|
| **Type** | ➕ Add Feature / ➖ Remove Feature / 🔧 Fix Feature / 💬 Other |
| **Title** | Short summary (required) |
| **Description** | Full detail — free text, multi-line |
| **Sub-points** | Add multiple sub-tasks / points with `+ Add point` |
| **Dragon link** | Optional — link one of your dragons for context |
| **Visibility** | 🌐 Global (everyone sees it) or 🔒 Private (only you + devs) |

### Thread view
Below the form, all global threads are listed in a Discord-style compact layout:
- **Collapse/Expand** arrow — shows just the title by default, expands for full body + subtasks + replies
- **Upvote ▲ / Downvote ▼** — vote on any thread
- **Reply** — add a reply to any thread (visible when expanded)
- **Edit** — edit your own thread's title, body, and sub-points
- **Delete** — delete your own threads (devs/admins can delete any)

### Sorting & filtering
- Filter by type (Add Feature / Remove Feature / Fix Feature / Other)
- Sort by **Recent** (newest first) or **Top** (highest net votes)

### Dev view (via Dev sidebar section)
In the Dev section, `dev-feedback` shows **all** threads including private ones, with additional controls:
- **Mark as done** — greys out the thread and marks it resolved
- Toggle resolved threads on/off

## 📋 Updated Firestore Rules
Paste the contents of `firestore.rules` (included in this zip) into your Firebase Console → Firestore → Rules tab. The new rules add proper read/write permissions for `/feedback` and `/versionNotes` collections.

---
_Next: v7.9.0 — Dev console & simulation tools (stat presets, quick-create test data, lineage scenarios)_
