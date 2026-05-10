# What's New — v7.3.0

## 📊 Stats Overhaul

### In-game layout
Stats are now displayed in the exact same two-column layout as in-game:

| Body (left) | Resistances (right) |
|---|---|
| Life Expectancy | Toxin Tolerance |
| Scale Thickness | Impact Resistance |
| Endurance | Pierce Resistance |
| **Bile Production** *(new)* | Fire Resistance |
| Bite Force | Frost Resistance |
| Power | Plasma Resistance |
| Strength | Lightning Resistance |
| Nutrient Absorption | Acid Resistance |
| Water Retention | Venom Resistance |

### Bile Production added
`Bile Production` is now a tracked stat. Existing dragons will show `—` until you fill it in.

### Growth Rate removed
`Growth Rate` was not a real in-game stat and has been removed from the form and display. Any existing data is preserved in Firebase but ignored.

## 🧬 Recessive Stats
A collapsible **Recessive Stats** section now appears at the bottom of ADD DRAGON. Click the `▸ Recessive Stats` toggle to expand it. All 18 stats have a recessive equivalent (`r_stat_*`). The section auto-expands when editing a dragon that already has recessive data.

## 🚫 Duplicate Dragon Prevention
You can no longer accidentally register the same species twice on the same account. If you try, you'll see a toast error:
> `[Account] already has a living [Species]. Remove or mark it dead first.`

This only applies to living dragons — dead dragons don't count toward the limit.

## 📜 Registry Scrollbar
The dragon registry now uses a scrollbar instead of shrinking cards when there are many dragons. Each card has a guaranteed minimum height so the content is always readable.

---
_Next: v7.4.0 — Map improvements (1600×1600 coords, better stacking, zoom-aware spread, click-stack popup)_
