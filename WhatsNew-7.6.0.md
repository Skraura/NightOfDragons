# What's New — v7.6.0

## 🖼 New App Logo
Updated to the new clan logo (purple background variant).

## 🃏 Registry Card Layout Redesigned
Cards now use a clean 3-line layout — no more cramped single line:
```
🐉  AcidAccount · ASD  ♀  [ELDER]
    Ember                        ← dragon name (accent colour)
    Owner: Skraura
```
- **Line 1** — Account · Species + gender glyph + status badges
- **Line 2** — Dragon name (only shown if set)
- **Line 3** — Owner (main clan member)

## ⚠️ Click-off Warning (proper modal)
Clicking outside the ADD DRAGON popup while you have unsaved changes now shows a **proper in-app modal** instead of a browser `confirm()` dialog:
> "You have unsaved changes. Are you sure you want to leave?"
> **[No, stay]** · **[Yes, discard]**

## 💀 Duplicate Dragon → Kill Confirmation Modal
When you try to register a dragon that already exists on an account, instead of an error toast you now get a confirmation popup:
> "This action will set **[Dragon Name]** (Account: **[Account]**) as Dead, then register the new dragon."
> **[Cancel]** · **[Yes, set as dead & proceed]**

## 🔐 Auth Fix (carried from hotfix)
- `restoreSession()` is now properly `await`-ed on startup — auth token is guaranteed before the window opens
- `ensureAuth()` is called before every Firestore write operation (create, update, delete, setMate, saveNestingSpot, etc.) — tokens are refreshed automatically mid-session
- No more `PERMISSION_DENIED` errors on `dragon:create`, `dragon:delete`, `account:add`, `account:remove`

---
_Next: v7.7.0 — Member feedback system (submit threads, upvotes, type tags, dragon links)_
