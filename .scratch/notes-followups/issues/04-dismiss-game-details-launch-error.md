# 04 — Dismiss game-details launch error

**What to build:** The desktop game-details launch failure alert has an accessible in-place dismiss action. Dismissing removes the displayed failure through unrelated rerenders; a later failed Play attempt displays the next failure, while Retry/Open Settings and active progress behavior remain available.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance

- [ ] A failed desktop Details launch shows a keyboard-accessible dismiss/close action alongside applicable recovery controls.
- [ ] Dismiss removes the alert even when retained `launchProgress.stage === "failure"` is still present, and it stays absent on unrelated rerender.
- [ ] A subsequent failed Play shows a new failure alert.
- [ ] Active launch/progress behavior and existing Retry/Open Settings controls remain intact.

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
