# DoD Tracker — v7.1.0 TODO

## Bug Fixes

- [x] **Auto-refresh after add/edit** — After adding or editing a dragon, changes appear immediately without needing to restart the app. Triggered via `dragon:refresh` event + `loadDragons()` call.

- [x] **Gender dropdown keyboard navigation** — In ADD DRAGON, the Gender dropdown ignored keyboard presses (e.g. pressing `M` to jump to Male) because of emoji in option labels. Fixed by restructuring `GENDERS` so the emoji is separate from the match text, using `<select>` `accessKey` / value-based approach, and stripping emoji from the native option text so browser key-matching works.

- [x] **Mutation point names** — Corrected displayed names for trait milestones:
  - Social 4 pts → **Nesting** (was "Dominant (4pts)")
  - Scavenger 4 pts → **Survivor** (was "Scavenger (4pts)")
  - Fast 1–3 pts → **Movement** (was "Fast")
  - Fast 4 pts → **Fast** (unchanged)

## UX Improvements

- [x] **Bigger Hungry checkbox** — The 🍖 Hungry checkbox in ADD DRAGON is now larger and easier to click (24×24 px target area).

- [x] **Accidental click-off warning** — Clicking outside the ADD DRAGON modal now shows a "Are you sure? You'll lose your progress." confirmation dialog before closing.

- [x] **Elder ticks as percentage** — Elder Tracker now shows and stores ticks as 0%–100% instead of 0–1. Input in DragonForm uses 0–100 range; stored value is divided by 100 internally for compatibility.

- [x] **Purity → Skin Purity rename** — The "Purity" field label is now "Skin Purity" everywhere (form, detail view, list).

## Map

- [x] **Stacked pins** — Dragons at the same map location are now fanned out in a small arc so all pins are visible. Hovering over a stacked group shows a badge with the count. At high zoom levels they spread further apart for easy clicking.

## Dragon Registry

- [x] **Dragon names** — Added a "Name" field to the dragon form, shown between Owner and Account+Species in the registry list. Names appear in the Elder Tracker too.

## Mate / Harem Feature

- [x] **Mate status** — You can mark one dragon as the mate of another; both dragons show each other as mates in their detail view.

- [x] **Harem list** — Each dragon can have a list of "harem" dragons — potential bonk partners you've approved (e.g. no shared parents). Shown as a quick-glance list in the dragon's detail panel.

- [x] **Canvas mate view** — On the Lineage Canvas (and optionally the map), mates are shown connected by a coloured line so you can see all pairs for a species at a glance.

## Technical Notes

- All new fields (`name`, `mate_id`, `harem`) are stored in Firebase under the dragon document.
- Harem is a JSON array of dragon IDs.
- Mate relationship is bidirectional: setting A's mate to B also sets B's mate to A (and clears the old mate link if either had one).
