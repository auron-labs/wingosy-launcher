# 04 — Immersive library mode fixes

**What to build:** Immersive mode actually delivers its 10-ft promise: the dev HUD (FPS/GPU/LAT) is hidden from end users or gated behind a debug/developer flag (and stops reading "GPU" twice), duplicate tiles for the same game (e.g. two identical "Bonk's Adventure") are deduped, tile titles, filter pills, and the help bar are genuinely large enough for couch viewing, and the conflicting filled "Play" + "Download" buttons on the details screen resolve into a single state-appropriate primary action.

**Blocked by:** 01 — Design-system pass: typography, buttons, and interaction states.

**Status:** resolved

- [x] Dev HUD no longer renders for end users (hidden or debug-gated); no duplicated "GPU" label
- [x] Duplicate tiles for the same game are merged/deduped in the immersive grid
- [x] Titles, pills, and help bar text meet the large-type goal for 10-ft viewing
- [x] Details screen shows exactly one primary action appropriate to download state (never Play + Download together)

## Notes

- Immersive library records are deduped by normalized game name and platform before they enter the grid. The app keeps the backend record count separately so pagination still loads every page when a page contains duplicates.
- Tile titles, platform badges, filter pills, and controller help now use larger responsive type and touch/controller-sized spacing.
- The details screen has one contained primary: Play for local/downloaded games and Download for remote-only RomM games. Re-download, Favorite, and Delete remain outlined secondary actions.
- Investigated `src/`, `src-tauri/`, and the immersive debug/controller overlay for FPS/GPU/LAT output. No such HUD exists in the current source, so no gate was added; the screenshot finding appears to describe an already-removed overlay.

## Smoke test (human)

1. Enter Immersive mode and confirm repeated copies of the same game appear as one tile.
2. Check tile titles, All/Favorites/Recent pills, and the bottom help bar at a couch-viewing distance.
3. Open a downloaded game and confirm Play is the only contained action; open a remote-only game and confirm Download is the only contained action.
