# 03 — Desktop library grid improvements

**What to build:** The desktop library grid becomes navigable without hovering every tile: game titles visible on tiles (or an always-on label/list option), sort and filter controls (name, recently played, play time, downloaded status) matching what immersive mode already offers, the top-left download/cloud badge legible at rest, play/favorite actions discoverable without hover with comfortable hit targets, search gains a clear (✕) button and result count, and the sidebar Favorites heart stops being the only colored icon (reads as active state today).

**Blocked by:** 01 — Design-system pass: typography, buttons, and interaction states.

**Status:** resolved

- [x] Tile titles are visible without hover (on tiles or via a labels/list-view option)
- [x] Sort and filter controls exist on the desktop library (name, recent, play time, downloaded)
- [x] Download-state badge is legible at rest
- [x] Play/favorite actions are discoverable pre-hover with adequate hit targets
- [x] Search has a clear button, result count, and a visible keyboard-shortcut hint
- [x] Sidebar icon coloring is consistent (no single colored icon implying false active state)

## Notes

- `GameCard.jsx` now keeps a readable two-line title, download-state label, platform label, and 44px play/favorite controls visible at rest. Tooltips and accessible labels remain available for each action, while hover only enhances the card.
- `Library.jsx` adds desktop sort/filter selects, a result count, always-present clear-search affordance, and a visible `Ctrl+F to search` hint. The shortcut focuses and selects the search field.
- `gameFilters.js` owns the pure filtering and sorting rules (name, recently played, play time, favorites, downloaded, and not downloaded), with unit coverage in `gameFilters.test.js`. `App.jsx` uses the existing filtered-games command for globally sorted/filtered pages and retains the existing paged query for the default library view.
- `Sidebar.jsx` gives the primary navigation icons the same secondary color; Favorites no longer uses error red as a false active-state signal.

## Smoke test (human)

1. Open the desktop Library and confirm titles, download status text, and play/favorite buttons are visible without hovering a tile.
2. Change Sort by and Filter, including Recently played, Play time, Favorites, and Downloaded, and confirm the grid updates.
3. Type in search and confirm the count and clear button; press `Ctrl+F` to focus the field.
4. Check the sidebar: Favorites is the same neutral color as the other primary navigation icons.
