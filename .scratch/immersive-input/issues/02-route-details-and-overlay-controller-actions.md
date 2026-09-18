# 02 — Route game-details and overlay controller actions by visible priority

**What to build:** Complete the centralized Immersive controller route so game details, menus, and dialogs receive actions according to what the player can currently see. Details navigation and activation happen once, while an open menu or dialog takes priority over the screen behind it and Back closes that overlay before leaving details.

**Blocked by:** 01 — Route Library and shell controller actions through the Immersive app seam.

**Status:** resolved

- [x] Directional controller input in game details moves focus among visible enabled actions, and A activates the focused action once.
- [x] B closes an active menu or dialog before navigating from game details back to the Library.
- [x] An open menu or dialog prevents controller input from moving background focus or triggering background actions.
- [x] Routing no longer depends on querying Library or game-details test identifiers or dispatching the same action to both the window and Library root.
- [x] Existing controller mappings, native keyboard shortcuts, debug correlation, and focused deadzone, repeat, ownership, and reconnect behavior remain unchanged.
- [x] Observable app-seam tests cover details focus movement, single activation, Back priority, and overlay suppression; mapper tests tied only to removed routing internals are updated or removed.

## Implementation progress

- [x] Slice 1 — Route details and overlays through the app seam and add observable app-seam regressions. Targeted immersive app and mapper tests pass (46 tests); repository typecheck still reports the existing unrelated baseline errors.
- [x] Slice 2 — Remove obsolete mapper routing internals/tests and run targeted verification. Mapper tests (21) and app tests (12) pass; targeted lint passes. Broader checks retain unrelated baseline failures documented for review.
- [x] Review — Independent code review approved the final diff with no Standards or Spec findings.

Review pass 1 requested corrections: ignore hidden retained overlays when routing, and add game-details menu suppression coverage at the app seam.

Review pass 1 corrections completed: routing now filters hidden overlays, details-menu priority is covered at the app seam, and the mapper cleanup remains applied. Targeted mapper tests (21) and app tests (24) pass.

## Answer

Controller actions now route once through the Immersive app seam. Visible menus and dialogs take priority over details and Library behavior, hidden retained overlays are ignored, and Back closes the active overlay before navigating away from details. The mapper no longer queries Immersive test identifiers or dispatches one action to both window and Library roots; obsolete routing tests were replaced by app-seam behavior coverage while repeat diagnostics remain covered.

Final targeted verification passed 34 tests across the app route and mapper suites. Independent code review approved the implementation. The full unit suite, frontend lint, and typecheck still report the repository's unrelated existing Immersive baseline failures; changed-file targeted lint passes and typecheck reports no changed-file errors.
