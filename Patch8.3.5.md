# DoD Tracker — Patch 8.3.5

## Lineage Graph — Complete Logic & UX Fix

---

## Node model corrections

### Child nodes are always orange with ♂/♀ inside

All child nodes render as orange (#ffd27a) regardless of the child's sex.
A small ♂ or ♀ symbol is drawn inside the circle to indicate sex. This
matches the original specification.

### Female-central → male-instance links are visible

The cluster link connecting a central female to each of her male-instance
nodes is rendered as a solid visible line (same style as parent→child links).
This was incorrectly hidden in previous patches.

### Male-instance is always one node per (father × mother) pair

If Ragnar nested with Luna AND Aurelia, he gets two separate blue nodes:
`Ragnar(with Luna)` and `Ragnar(with Aurelia)`. Each is only connected to
its own female. This was the original intent and is now correctly enforced.

### Child-female who is also a central female

If Luna's child Heart is also a central female (has her own nests), the graph
creates:
- A small orange child-node for Heart (as Luna's child)
- A separate pink central-female node for Heart (as a mother)
- A thin dashed yellow line connecting Heart's child-node to Heart's
  central-female node (a `ref` link showing they are the same dragon)

---

## Interaction fixes

### Male click — highlights only, no panning

Clicking any male-instance node highlights:
- ALL blue male-instance nodes that share the same canonical dragon id
- His orange child-node (wherever he appears as a child)

No camera panning occurs. Camera stays where it is.

### Female-central click — highlights cluster, no panning

Highlights the female node, all her male-instances, and all their children.
No camera panning.

### Pause/Resume button removed

The pause button has been removed from the toolbar per request.

### Reset button — full physics + view reset

The Reset button now:
1. Clears all pinned positions (fx/fy = null)
2. Scatters all nodes near the origin with small random offsets
3. Restarts the simulation with alpha = 1 (full energy)
4. Resets the zoom/pan to the initial centred view

This gives the same result as closing and reopening the Lineage page.

---

## Unknown placeholder rule (corrected)

- **One parent missing / not in dataset** → Unknown ♀ or Unknown ♂ placeholder
  node created. Child connects through it normally.
- **Both parents blank** → floating lone node, no connections, drifts freely.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/lineageNestGraph.js` | v3.0 — clean rewrite, correct cluster logic, ref links, unknown rule |
| `src/components/LineageGraph.jsx` | v11.0 — orange children with sex symbol, no pause button, reset resets physics |
