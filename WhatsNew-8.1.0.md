# What's New — v8.1.0

## 🌿 Lineage Graph — Complete Rework

The old family-chart (f3) static tree layout has been **replaced entirely** with a live physics-based force graph, similar in feel to Obsidian's graph view.

### How it works
The graph runs a real-time simulation with four forces:
- **Repulsion** — nodes push each other apart (Coulomb-like)
- **Attraction** — edges act as springs pulling connected nodes together (Hooke)
- **Damping** — velocity fades each tick, the graph settles naturally
- **Gravity** — gentle pull toward canvas centre, prevents drift

The simulation runs until it cools down, then stops automatically.

### Controls

| Action | How |
|---|---|
| **Pan** | Drag the background |
| **Zoom** | Scroll wheel |
| **Move a node** | Drag it — position auto-saved |
| **Pin / Unpin a node** | Right-click — pinned nodes stay put when physics runs |
| **Select a node** | Click it — opens detail sidebar |
| **Pause / Resume** | ⏸ / ▶ in toolbar |
| **Save layout** | Appears after any move — click 💾 to persist all positions |
| **Reset layout** | ↺ button — clears saved positions, resets to auto-layout |

### Physics tuning panel (⚗)
Click the ⚗ button to open the live physics panel:

| Slider | Effect |
|---|---|
| **Repulsion** | How aggressively nodes push apart — higher = more spread |
| **Attraction** | Spring strength along edges — higher = nodes pulled tighter |
| **Edge Length** | Natural resting length of edges in pixels |
| **Damping** | Velocity decay — lower = bouncier, higher = settles faster |
| **Gravity** | Pull toward centre — prevents island clusters drifting off-screen |

All sliders update live — you'll see the graph react immediately.

### Edge types

| Edge | Meaning |
|---|---|
| White curved line with arrow | Parent → Child |
| Pink solid line | Primary Mate pair |
| Purple dashed line | Harem connection |

### Species tabs
The toolbar shows one tab per species that has registered dragons. Click a tab to switch — each species has its own independent layout saved separately.

### Layout persistence
Node positions are saved per-species to `localStorage` under `dod_lineage_layout_{species}`. Dragging any node marks the layout as dirty (💾 appears). You can save manually or let it auto-save on drag-release.

### Admin: Clan Graph
The admin "Clan Graph" view (was "Clan Canvas") now also uses the new physics graph showing **all clan members' dragons** for the selected species in one graph.

---

_Next: v8.2.0 — TBD_
