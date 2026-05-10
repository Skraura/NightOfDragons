# What's New — v7.5.0

## 🌿 Lineage System Rewrite

### No more canvas crashes
A new **lineage safety engine** (`lineageEngine.js`) runs before any lineage data is sent to the canvas renderer. It detects and neutralises all known crash causes:

| Issue | What happens |
|---|---|
| Circular reference (A → B → A) | Edge is stripped, warning shown |
| Female set as own mother | Edge removed, warning shown |
| Male renesting (own father) | Allowed — but the previous instance is flagged for auto-kill |

### Renesting support
Males can now be set as their own father (**renesting** — a valid in-game mechanic). The engine recognises this, marks the previous dragon instance for auto-kill (since only 1 dragon per species per account is allowed), and keeps the lineage intact.

### Warning banner
If any lineage edges were removed or issues detected, a yellow warning banner appears above the canvas listing exactly what was fixed and why. No silent failures.

### Collapsible OCR Names
The "Family Tree Names" section (OCR raw data) in ADD DRAGON is now a **collapsible** `▸ OCR Raw Names` toggle — hidden by default, expands when you need it. This removes the visual clutter of a duplicate parents section.

---
_Next: v7.6.0 — Mate & harem polish (same-species validation, Ctrl+click multi-select, canvas mate lines)_
