# DoD Tracker — Patch 8.2.1

## Summary

Full rewrite of `lineagePhysics.js` to faithfully match the Obsidian Graph View
physics feel. The previous engine used a cooling schedule (alpha decay) inherited
from d3-force that caused nodes to cluster too tightly and freeze before settling.

---

## What Was Wrong

The v8.2.0 engine multiplied all forces by an `alpha` value that decayed from 1.0
toward 0 each tick. This meant:

- Repulsion fired very strongly on the first frames (explosion)
- Then rapidly weakened as alpha dropped
- The simulation "froze" before nodes had time to spread out naturally
- Result: nodes ended up closer than they should be, and non-connected nodes
  were pulled toward each other by residual forces

---

## New Physics Model — Matching the Reference

Based on `testgraph.html` (the Obsidian-like reference simulation):

| Property | Reference value | Our value | Description |
|---|---|---|---|
| Repulsion | 5000 | 5000 | All-pairs Coulomb push, constant, no decay |
| Spring strength | 0.01 | 0.012 | Hooke k — only connected pairs |
| Spring length | 80–140 | 160 | Rest length (longer for our rectangular cards) |
| Centering | 0.0005 | 0.0005 | Tiny constant pull to origin |
| Damping | 0.85 | 0.85 | Aggressive velocity decay per tick |
| Alpha/cooling | none | none | No cooling — runs forever, settles via damping |
| Integration | v += f; v \*= d | same | Force = acceleration (mass = 1 implicit) |
| Collisions | position correction | same | No overlap via geometry, not forces |

### Obsidian Rule: non-connected nodes have no attraction

The previous engine applied spring forces to all nearby node pairs via a
global "attraction" parameter. This is the main reason nodes felt too close.

**In the new engine, springs only apply between nodes that share an edge.**
Non-connected nodes only experience:
- Repulsion from every other node
- Weak global centering
- Collision resolution

This matches exactly how Obsidian works: isolated notes drift far apart,
clusters of linked notes settle at comfortable spring-rest distances.

### No alpha decay = natural settling

The sim runs at full constant force strength indefinitely. Nodes settle because
the damping coefficient (0.85) removes ~15% of velocity every tick. Once
velocity falls below the noise threshold the graph looks still — but is still
technically running. This is identical to the reference implementation.

### Collision resolution via position correction

Instead of force-based collision (which can oscillate), overlapping node pairs
are separated geometrically each tick: the overlap is split 50/50 and each
node is pushed out. This is the same approach as the reference.

---

## PhysicsPanel Changes

The physics settings panel now exposes the correct parameters:

| Old slider | New slider |
|---|---|
| Repulsion | Repulsion (same) |
| Attraction | Link Strength (connected pairs only) |
| Edge Length | Link Length |
| Damping | Damping (same) |
| Gravity | Centre Gravity |

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/lineagePhysics.js` | Complete rewrite — constant-force model, no alpha decay |
| `src/components/LineageGraph.jsx` | Updated PhysicsPanel slider keys and labels |
