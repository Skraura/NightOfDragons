# DoD Tracker — Patch 8.3.1

## Summary

Cleanup patch on the v8.3.0 lineage rework. Removes the dragon search
sidebar and the mated/spouse lines that were added by mistake and didn't
match the intended design.

---

## Changes

### Removed: Dragon search sidebar

The right-side collapsible sidebar (dragon list, search box, drag-to-canvas)
has been removed from the Lineage view. It was carried over from the previous
canvas-based view (v8.2.x) and doesn't belong in the new nest-based graph.
The Lineage view now uses the full horizontal width for the graph.

### Removed: Mated / spouse edges

The dashed pink lines connecting female-central nodes to their male-instance
nodes have been removed. Per the design:

> "The children are only connected to the male, not the central female."

The female ↔ male relationship is implied by the cluster layout (the male
node orbits the female via physics), not by a visible edge. Only
**parent→child** edges (male-instance → child node) are drawn.

### Adjusted: Link force distance

With mated edges gone, the `forceLink` distance for non-parent links
defaults to 110px. Parent links remain at 90px.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/LineageGraph.jsx` | Removed sidebar state, JSX, mated link styling |
| `src/components/LineageGraph.module.css` | Removed sidebar CSS block |
| `src/lib/lineageNestGraph.js` | No longer creates mated edges in the link array |
