# 02 — Search the Immersive Library by game name

**What to build:** Give players in Immersive mode a search control that finds games by name across the complete library. Search must use the existing case-insensitive partial-name behaviour, remain safe while paginated requests are changing, and leave the controller-oriented library experience intact.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Immersive mode provides a clearly labelled game-name search control whose query can be entered, edited, and cleared.
- [x] Search performs the existing case-insensitive partial-name match across the complete library rather than only the currently loaded games.
- [x] Changing or clearing the query restarts filtered pagination, resets game focus to the first visible result, and cannot allow an older request to overwrite the latest query.
- [x] Search composes with the All, Favorites, and Recent sections and, when a platform filter is available, preserves and combines with the selected platform.
- [x] Typing and editing while the search control is focused does not move grid focus, open a game, cycle sections, or trigger other library shortcuts.
- [x] A query with no matches presents a search-specific empty state, and clearing the query restores the applicable library results.
- [x] Automated tests cover partial and case-insensitive matching, clearing, filtered lazy loading, request-race handling, shortcut isolation, and composition with the existing library sections.

## Answer

Immersive mode now searches the complete paginated library by partial, case-insensitive game name while composing with section and platform filters. Query changes reset focus and pagination, stale page-one and lazy-page responses are ignored, search input isolates library shortcuts, and a search-specific empty state can be cleared to restore the applicable results. Frontend and Rust tests cover the requested behavior, and both Standards and Spec reviews approved the implementation.
