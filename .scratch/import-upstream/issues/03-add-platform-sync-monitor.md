# 03 — Add the per-platform library sync monitor

**What to build:** Add one shared monitor view that shows per-platform RomM library state and supports safe scoped synchronization, retry, and full-library Sync all from desktop and immersive navigation.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] The monitor shows each platform's name, server ROM count, locally indexed RomM count, downloaded count based on known local state, and current progress/result, clearly distinguishing metadata sync from ROM downloading and save synchronization.
- [x] Each platform supports Sync and Retry, while Sync all retains full-library reconciliation; completion refreshes overview counts and affected library data.
- [x] Full and scoped sync use a backend full/scoped activity guard: overlapping work returns a clear busy result instead of starting another reconciliation or pruning pass.
- [x] Scoped cleanup prunes only the selected platform's RomM entries, and only after every relevant page has fetched and applied successfully. Failed or partial runs clear dirty markers without treating an incomplete fetch as an empty remote library.
- [x] Scoped synchronization preserves unrelated platforms, local-source games, and personal state including local paths, favorites, hidden status, and play history, while retaining existing request retry behavior. Sync all still removes indexed games from platforms no longer returned by RomM, and its existing games-array response remains compatible with current setup/settings callers.
- [x] Requests use remote numeric platform identity. If several remote platforms map to one local platform ID, a single-platform run refuses destructive reconciliation and directs the user to Sync all.
- [x] The same monitor view is navigable from desktop and immersive utilities, and active status remains visible across navigation so reopening it does not imply that a run stopped. Representative desktop and immersive monitor states are included in the existing screenshot-capture coverage without duplicate captures.

**Context:** Parent spec: “Selective upstream adoption”; upstream commit `57bc35f` and PR #13 are the reviewed sources. Sync history remains session-local.

## Verification

- [x] Reuse the existing RomM fixture and database seam to exercise paginated scoped success, interrupted later-page cleanup, personal/unrelated-state preservation, and overlapping-sync rejection.
- [x] Run the focused Tauri smoke check from both modes, including progress, counts, library refresh, and monitor navigation.

## Implementation progress

- [x] Slice 1: Backend platform overview, scoped synchronization, shared activity guard, safe cleanup, and focused orchestration tests.
- [x] Slice 2: Shared session-local monitor UI, desktop/immersive navigation, refresh behavior, and screenshot-capture coverage.
- [x] Slice 3: Integrate and verify the complete ticket, fixing only gaps found against the acceptance criteria.
- [x] Slice 4: Remove remaining code/runtime blockers and complete automated desktop and immersive smoke verification without human intervention.
- [x] Review: Run the repository code-review workflow and address all blocking findings.

## Comments

- 2026-09-18: Both code-review axes approved the implementation after refresh-error semantics and orchestration-level overlap coverage were corrected.
- 2026-09-18: Automated real-App smoke coverage now exercises desktop and immersive navigation, exact counts, progress persistence across navigation, completion, and refreshed library data. No human verification remains.

## Answer

Implemented the shared RomM platform sync monitor, safe full/scoped backend reconciliation, desktop and immersive navigation, session-local progress/results, and screenshot coverage. Added automated real-App smoke coverage for both modes and focused backend orchestration tests for paging, cleanup safety, state preservation, ambiguity, and overlapping-sync rejection.
