# 04 — Dismiss game-details launch error

**What to build:** The desktop game-details launch failure alert has an accessible in-place dismiss action. Dismissing removes the displayed failure through unrelated rerenders; a later failed Play attempt displays the next failure, while Retry/Open Settings and active progress behavior remain available.

**Blocked by:** None — can start immediately

**Status:** resolved

## Acceptance

- [x] A failed desktop Details launch shows a keyboard-accessible dismiss/close action alongside applicable recovery controls.
- [x] Dismiss removes the alert even when retained `launchProgress.stage === "failure"` is still present, and it stays absent on unrelated rerender.
- [x] A subsequent failed Play shows a new failure alert.
- [x] Active launch/progress behavior and existing Retry/Open Settings controls remain intact.

## Evidence and context

Original NOTES bullet: the Cuphead “alert stays on every page with no way to dismiss it” (`NOTES.md:5-6`). Static inspection confirms the desktop `GameDetailsLaunchStatus` in `game-details-actions-panel` renders Retry/Open Settings but no in-place close. `useGameDetailsActions` and `useGameDetailsActionState` own local `launchError`; `GameDetailsLaunchStatus` also treats retained failure progress as a failure, so clearing only the error is insufficient. `library-controls` and the immersive failure modal have their own close/back behavior, while no global launch-error banner was found. Cross-page persistence was not confirmed; this ticket is deliberately limited to the confirmed desktop Details omission. This is code-inspection evidence, not a runtime reproduction.

## Minimal implementation plan

1. Add local visible-failure dismissal state through `useGameDetailsActionState`/`useGameDetailsActions`, resetting it when `launchGameAction` records a new failed attempt.
2. Pass the focused dismissal callback to `GameDetailsLaunchStatus` and render an accessible close action without changing its existing alert/recovery controls.
3. Make the desktop Details display combine dismissal state with `launchError` and failure `launchProgress`, without discarding broader launch context.

## Scope and preservation

Do not add a notification system, alter immersive behavior, or broadly clear progress/context. The reported cross-page persistence is not an acceptance claim.

## Targeted verification

Add one focused existing desktop Details interaction regression: fail Play, dismiss, rerender, then fail Play again and confirm visibility plus recovery controls. No separate global-banner coverage is needed.

## Comments

- 2026-09-22: Claimed for implementation. TODO: (1) confirm the existing desktop Details state/render/test seams, (2) implement dismissal plus the focused regression, (3) run review and final verification.
- 2026-09-22: Slice 1 complete. Confirmed the existing seams in `use-game-details-action-state.js`, `use-game-details-actions.js`, `game-details-action-operations.js`, `game-details.jsx`, `game-details-actions-panel.jsx`, and `game-details.test.jsx`; dismissal must gate only visible failure rendering and reset on each newly recorded failure.
- 2026-09-22: Slice 2 complete. Added local visible-failure dismissal, reset it on each newly recorded launch failure, added an accessible close action, and covered dismiss/rerender/subsequent-failure behavior. Focused Details tests (20) and typecheck pass; repository-wide frontend lint still reports 45 pre-existing out-of-scope errors, while scoped checks on changed implementation files pass.
- 2026-09-22: Slice 3 complete. Independent `code-review` review approved the change with no standards or spec findings. Full unit suite passes: 53 files, 294 tests.

## Answer

Desktop game-details launch failures now include an accessible dismiss action. Dismissal hides the current local error and retained failure progress without clearing broader launch context, persists through unrelated rerenders, and resets when a later Play attempt records a new failure. Existing active progress and Retry/Open Settings behavior is preserved and covered by the focused regression.
