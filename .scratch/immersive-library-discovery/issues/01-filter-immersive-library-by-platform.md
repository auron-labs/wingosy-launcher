# 01 — Filter the Immersive Library by platform

**What to build:** Give players in Immersive mode a controller-friendly way to narrow the library to one platform or return to all platforms. The selected platform must govern the complete paginated library, not only games that happen to be loaded, while preserving the existing All, Favorites, and Recent sections.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Immersive mode offers “All platforms” and every platform represented in the library, using the library's platform display names.
- [x] Selecting a platform shows only games from that platform across initial loading and subsequent lazy-loaded pages; selecting “All platforms” restores the unfiltered library.
- [x] Changing or clearing the platform resets game focus to the first visible result and cannot allow an older request to overwrite the latest selection.
- [x] Platform filtering composes with the All, Favorites, and Recent sections, including a clear empty state when the active combination has no games.
- [x] The platform control is usable by pointer and keyboard/controller without breaking existing grid navigation or game selection.
- [x] Automated tests cover selecting and clearing a platform, paginating within the active platform, request-race handling, and focus/empty-state behaviour.

## Comments

- 2026-09-01: Claimed for implementation.
- 2026-09-01: Implementation agent completed the platform controls, complete-dataset paginated filtering, request invalidation, focus/empty-state behaviour, and automated coverage. Targeted tests (31), full unit tests (108), typecheck, and frontend lint passed; lint reported 7 pre-existing warnings. Awaiting code review.
- 2026-09-01: Spec review approved with no findings. Standards review found one judgement-call duplication in first-game focus lookup; sent back for focused cleanup before approval.
- 2026-09-01: Implementation agent extracted the shared first-game focus helper. Targeted tests (22), typecheck, and `git diff --check` passed. Awaiting standards re-review.
- 2026-09-01: Standards re-review found one remaining call site in section cycling that should reuse the new helper; sent back for a final focused cleanup.
- 2026-09-01: Implementation agent reused the shared focus helper in section cycling. Targeted tests (22) and `git diff --check` passed. Awaiting final standards approval.
- 2026-09-01: Final standards re-review approved with no findings; spec review remained approved with no findings.
- 2026-09-01: Final verification passed: targeted tests (31), full unit suite (108), typecheck, frontend lint (7 pre-existing warnings), and `git diff --check`. Ticket resolved.
