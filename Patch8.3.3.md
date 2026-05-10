# DoD Tracker — Patch 8.3.3

## Fixes

### Female → Male links are now visible

The lines connecting a female-central node to her male-instance nodes are now
drawn visibly, same style as parent→child links (`rgba(255,255,255,0.18)`,
1.6px). They were incorrectly set to `transparent` / width 0 in 8.3.2.

### Unknown placeholder node rule corrected

**Previous behaviour (wrong):** An Unknown ♀ or Unknown ♂ placeholder was
created whenever either parent was missing, including when both were blank.

**New behaviour:**
- **Only one parent is missing** (the other is set) → create an Unknown
  placeholder node for the missing parent so the child still connects
  correctly into the graph
- **Both parents are blank** → the dragon appears as a **floating node**
  with no connections, drifting freely in the graph via physics alone.
  No Unknown placeholders are created.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/lineageNestGraph.js` | Unknown placeholder only when one parent missing; floating node when both blank |
| `src/components/LineageGraph.jsx` | Cluster links visible; removed cluster-only filter guards |
