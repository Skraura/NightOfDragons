# DoD Tracker — Patch 8.2.0

## Summary

Major Lineage graph update. New sidebar, drag-to-canvas, right-click link drawing,
link confirmation modal, Obsidian-tuned physics, and manually-moved node behaviour.

---

## New Features

### 1. Dragon Sidebar (right edge)

A collapsible sidebar lists all registered dragons. Click the arrow (‹/›) to toggle.

Each entry shows:
- Gender icon (♂/♀) in blue/red
- Dragon name
- Species (in species color) · Account · Main account

**Drag any dragon onto the canvas** to add it to the graph view, even if it belongs
to a different species than the current filter. Dropped dragons participate in physics
but are not persisted as part of the species filter — they are visual overlays.

A search box at the top of the sidebar filters by name, species, or account.

---

### 2. Drag-to-Canvas

Drag a dragon row from the sidebar and drop it anywhere on the canvas. The node
appears at the drop position and immediately starts participating in physics.

Already-present nodes are ignored (no duplicates).

---

### 3. Right-Click + Drag to Draw Links

**Hold right-click on any node and drag** to draw a dashed orange line to another
node or to empty space.

- **Release on a node**: the link confirmation modal appears with both dragons
  pre-filled.
- **Release on empty space**: the link modal appears with a search bar so you
  can find the target dragon.

The live link line shows an orange arrow tip as you drag.

---

### 4. Link Confirmation Modal

When a link is initiated, a modal shows:

- **From** and **To** dragon cards (with gender, name, species)
- A "change" button on the To dragon to re-search
- A search bar (when no target is pre-filled or after "change")
- **Link type selector**:
  - `Parent → Child` — source is the parent of target (sets father_id or mother_id)
  - `Child → Parent` — target is the parent of source
  - `Mate / Spouse`  — bidirectional mate link (calls `dragon.setMate`)
- Confirm writes the relationship to the database immediately

Gender is used to determine whether to set `father_id` (male) or `mother_id` (female).

---

### 5. Manual Node Movement + Physics

When you **drag a node**, it is:
1. **Pinned** temporarily while dragging (follows your cursor exactly)
2. After release, **unpinned** after 400ms — physics resumes but the node starts
   with zero velocity and only drifts gently
3. Marked with a small ⦿ indicator (vs 📌 for a hard-pinned node)

Manually-moved nodes have **reduced spring attraction** (30% of normal) so your
placement is mostly respected even while physics runs. Right-click a node to
hard-pin it (📌) and it will not move at all.

---

### 6. Obsidian-Style Physics (retuned)

Default values changed to match Obsidian Graph View feel:

| Parameter     | v8.1.x | v8.2.0 | Effect |
|---------------|--------|--------|--------|
| Repulsion     | 900    | 2200   | Nodes spread much further apart |
| Edge length   | 200    | 280    | Links have more slack before pulling |
| Attraction    | 0.07   | 0.04   | Links pull much more gently |
| Alpha decay   | 0.012  | 0.010  | Simulation runs longer before settling |
| Collision     | —      | 90px   | Nodes can't fully overlap |

New: **collision detection** — nodes push each other away when closer than 90px,
preventing stacking even at high repulsion decay.

New: **golden angle spiral** initial placement — avoids the cluster explosion that
happened when all nodes started near the centre.

New: **isolated node extra gravity** — nodes with no edges get slightly stronger
centre gravity to prevent them drifting off screen.

---

### 7. Double-Click to Open Registry

Double-clicking a node on the canvas opens the Registry panel for that dragon
(calls the `onOpenDragon` prop).

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/lineagePhysics.js` | Full rewrite — Obsidian physics, collision, spiral placement, manuallyMoved, addNode |
| `src/components/LineageGraph.jsx` | Full rewrite — sidebar, drag-to-canvas, link drawing, link modal, manual move |
| `src/components/LineageGraph.module.css` | New: sidebar, canvasArea, link modal, sidebarToggle styles |
