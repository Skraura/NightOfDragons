# DoD Tracker — Patch 8.3.2

## Summary

Fixed all broken logic in the nest-based Lineage graph introduced in v8.3.0/8.3.1.
Also clarifies what was actually removed in 8.3.1 (see note below).

---

## Note on 8.3.1 misunderstanding

In 8.3.1, the "mated links" that were removed were the **female-central →
male-instance** visible lines. This was wrong — those lines are required both
visually and physically to keep males orbiting their female cluster.

The links you wanted removed were the **old harem/spouse mate edges** from the
v8.2.x canvas lineage (the pink dashed lines between two adult dragons). Those
were already gone when the whole canvas renderer was replaced in v8.3.0.

In 8.3.2, the female → male connection is back, but implemented correctly:
- **Invisible to the user** (stroke transparent, width 0)
- **Present in d3 forceLink** so males are gravitationally bound to their female
- Only the **male-instance → child** lines are drawn visibly

---

## Bugs Fixed

### 1. Male nodes disconnected from female cluster

**Cause:** 8.3.1 removed the `addLink(mated, female, male)` call entirely.
Without any link between the female-central and male-instance nodes, d3's
`forceLink` had nothing to pull them together, so males floated freely.

**Fix:** Re-added as a `cluster` relation link. It is invisible (`stroke: transparent`,
`stroke-width: 0`, `pointer-events: none`) so users never see it, but d3 uses it
to keep the male orbiting the female at ~120px distance.

### 2. Disconnected dragons appearing on graph

**Cause:** Step 4 of the old builder added any dragon with `father_id` or
`mother_id` set, even if no corresponding parent was in the dataset, creating
floating orphan nodes.

**Fix:** The new builder only adds nodes when they participate in a real
parent→child relationship within the loaded dataset. A dragon with lineage
fields pointing to dragons outside the loaded set is simply not shown.

### 3. d3 mutates link source/target to objects after simulation starts

**Cause:** After `simulation.nodes()` and `forceLink.links()` are called, d3
replaces the string ids in `link.source` and `link.target` with the actual node
objects. The highlight logic was comparing `l.source === nodeId` (string vs
object), which always failed.

**Fix:** `buildHighlightSets` now resolves both forms:
```js
function srcId(l) { return typeof l.source === 'object' ? l.source.id : l.source }
function tgtId(l) { return typeof l.target === 'object' ? l.target.id : l.target }
```

### 4. Dragons with no lineage data appearing

**Fix:** Any dragon with no `father_id`, no `mother_id`, and no children in the
dataset is excluded entirely from the graph.

### 5. Unknown parent placeholders

If a child has a `mother_id` pointing to a dragon not in the dataset (or no
`mother_id` at all), an **Unknown ♀** placeholder central node is created.
Same for missing fathers: **Unknown ♂** placeholder male-instance node.
This ensures the child still appears correctly connected.

### 6. Dead dragon styling

Dragons with `is_dead === 1` now render as **grey nodes** regardless of type
(female-central, male-instance, or child). A 💀 prefix is added to the name
label. This applies to all three node types.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/lineageNestGraph.js` | Complete rewrite — correct cluster links, no orphans, unknown placeholders, dead flag |
| `src/components/LineageGraph.jsx` | Cluster links invisible, dead node grey, highlight d3-object-safe, link opacity on clear |
