# What's New in v8.3.0 — Nest-Based Lineage Graph

## ⬡ Completely Rebuilt Lineage View

The Lineage graph has been redesigned from the ground up. It now uses a
**nest-based model** that mirrors how breeding actually works in Day of Dragons,
and renders with **D3 force simulation** for smooth, interactive physics.

---

## New Graph Model

### Female-Central Nodes (pink, large)
Every female dragon who has at least one child in the database becomes a
**central node** — the hub of her family cluster. She is always visually
distinct: larger circle, white border, bold name label.

### Male-Instance Nodes (blue, medium)
For each female-central node, one blue node is created **per male she nested
with**. If the same male nested with three different females, he gets three
blue nodes — one connected to each female. This reflects reality: each
nest is a separate breeding event.

### Child Nodes (small, pink/blue/orange by sex)
Children hang off the **male-instance node** (not the central female).
This correctly represents that a child belongs to a specific nest, not just
to the mother globally. Colour indicates sex:
- **Pink** — female child
- **Blue** — male child
- **Orange** — unknown sex

### Recursive Nesting
If a child female goes on to have her own children, she automatically
becomes a **new central female node** in the graph — her own cluster forms
around her, connected to the family above.

---

## Interaction

### Clicking a female-central node
→ The camera pans to her **child node** in her mother's cluster (showing where
she comes from), and **highlights her entire sub-cluster** (her central node +
all her male-instances + all their children).

### Clicking a male-instance node
→ **All instances of that male** across every female he nested with are
highlighted simultaneously, showing his full breeding history at a glance.

### Clicking a child node
→ Opens the right info panel for that dragon. The node and its parent
male-instance are highlighted.

### Right info panel
Clicking any node opens a panel showing dragon details: name, owner, species,
growth stage, grade, skin, bloodline quality, elder status, ticks, and notes.

---

## Physics (D3 Force)

Matches the reference Obsidian-like simulation:
- `d3.forceManyBody` charge −560 (all-pairs repulsion)
- `d3.forceLink` — distance 130px (female→male), 90px (male→child)
- `d3.forceCollide` — prevents node overlap (radii 38/28/20)
- Drag releases with no pin — physics immediately resumes (Obsidian style)
- Pause/Resume button in toolbar

---

## Sidebar

The right sidebar lists all dragons across all species, filterable by name.
Clicking a dragon in the sidebar pans the camera to that dragon's node
and opens their info panel.

---

## Files Changed / Added

| File | Change |
|------|--------|
| `src/lib/lineageNestGraph.js` | New — nest graph builder + highlight logic |
| `src/components/LineageGraph.jsx` | Complete rewrite — D3 SVG renderer |
| `src/components/LineageGraph.module.css` | Complete rewrite — new layout |
| `src/lib/lineagePhysics.js` | Kept for reference, no longer used by Lineage page |
| `package.json` | Added `d3 ^7.9.0` dependency |

---

## Migration

Run `npm install` after extracting — D3 is a new dependency.

The old canvas-based lineage view and its physics engine are no longer
used by the Lineage page. `lineagePhysics.js` is retained in case it is
needed by other features.
