# 01 — Route Library and shell controller actions through the Immersive app seam

**What to build:** Route controller actions through the existing Immersive app interaction flow so Library navigation and activation, section and platform browsing, settings, hints, and exit reach the appropriate visible receiver exactly once. Preserve native keyboard and text-entry behavior while removing the controller mapper's need to broadcast Library actions to multiple DOM targets.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] D-pad and left-stick directions move Library focus once per routed action, and A opens or activates the focused Library control once.
- [x] Existing controller buttons continue to navigate Library sections and platforms and open settings.
- [x] Shell actions such as hints, settings, Back, and exit only act in the appropriate current view and do not also trigger a Library action.
- [x] Search text entry and native keyboard navigation retain their current behavior, including suppression of controller shortcuts while typing.
- [x] Existing controller decoding, deadzone, ownership, disconnect/replacement handling, repeat timing, unsupported-controller state, and debug correlation remain intact.
- [x] Observable app-seam tests cover single activation and view-scoped routing without asserting synthetic event targets or helper call counts.

## Comments

### 2026-09-17 — Claimed and sliced

- Slice 1: add a mapper-to-app action callback while preserving polling, timing, ownership, fallback behavior, and debug metadata.
- Slice 2: wire Library and shell actions through a view-scoped Immersive app route and add observable app-seam regressions for one movement/activation and scoped shell behavior.
- Slice 3: run focused and full frontend verification, applying only fixes required by this ticket.
- Preserve native keyboard/text-entry behavior and current details/overlay behavior for ticket 02; no redesign, new route, Rust/schema change, or generalized input framework.

### 2026-09-17 — Slice 1 complete

- Added an optional mapper-to-app controller action callback with one delivery per decoded action.
- Kept legacy DOM routing when no callback is supplied, preserving focused mapper coverage and behavior outside the app seam.
- Focused mapper verification passed: 9 files, 22 tests; targeted lint and `git diff --check` also passed.

### 2026-09-17 — Slice 2 complete

- The Immersive app now owns a view-scoped controller route and supplies the visible Library root as its single Library receiver.
- Library movement/confirmation, settings, hints, Back/exit, and text-entry suppression have observable app-level regression coverage.
- Focused verification passed: 15 app tests and 22 mapper tests; targeted formatting/lint and `git diff --check` passed.
- Existing repository typecheck failures and an unrelated `immersive-library.test.jsx` fixture failure remain for final baseline confirmation.

### 2026-09-17 — Slice 3 complete

- Rechecked the diff against the ticket and added coverage that callback changes do not restart controller polling or route to a stale receiver.
- Mapper tests passed (9 files, 23 tests); app tests passed in three repeated runs; targeted routing tests passed apart from established Library fixture failures.
- Full-suite checks remain red on the existing baseline: 178 unit tests passed with 54 failures, typecheck has 6 existing errors, and frontend lint has 30 existing errors. Changed-file lint and `git diff --check` pass.

### 2026-09-17 — Review correction

- Review identified that supplying the app callback bypassed the mapper's existing open-menu priority.
- Restored that existing priority as a narrow compatibility step pending ticket 02's centralized overlay route, with an observable regression proving the menu receives the action while background hints/Library state remain unchanged.
- Focused app/mapper verification passed: 11 files, 39 tests; changed-file lint and `git diff --check` passed.

## Answer

Controller input now crosses a single mapper callback into an Immersive app-owned, view-scoped route. Library actions reach the visible Library receiver once, shell actions remain scoped to the active view, typing suppresses controller shortcuts, and the existing open-menu priority remains intact for compatibility until ticket 02 completes overlay routing. Final Standards and Spec reviews approved the change after 44 targeted tests and changed-file lint passed.
