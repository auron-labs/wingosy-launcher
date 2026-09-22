# 03 — Offer sole compatible emulator install

**What to build:** When launch recovery finds no installed compatible emulator but exactly one compatible downloadable candidate, the existing missing-emulator recovery UI offers confirm/cancel installation. Confirm starts the existing installer with visible pending/result feedback; cancel changes nothing, and the user may press Play again after installation.

**Blocked by:** [02 — Correct Switch emulator compatibility](./02-correct-switch-emulator-compatibility.md)

**Status:** resolved

## Acceptance

- [x] A Switch title whose sole compatible downloadable candidate is Eden offers Eden installation from the missing-emulator recovery surface.
- [x] Confirm starts the existing `download_emulator` installation flow and exposes its pending/result state; it does not automatically relaunch the game.
- [x] Cancel performs no installation.
- [x] Zero or multiple compatible downloadable candidates, and unrelated launch errors, retain current guidance with no install prompt.
- [x] RetroArch core readiness/filtering remains governed by `get_emulators_for_platform`; this is not a RetroArch core-manager flow.

## Evidence and context

Original NOTES bullet: Cuphead “should ask the user if it should auto-install one if there’s once choice” (`NOTES.md:3-5`). Static inspection finds `getLaunchErrorPresentation` currently supplies missing-emulator guidance to open Settings, with no confirmation/install prompt. The existing `get_emulators_for_platform` command returns `EmulatorInfo` candidates including installation/download information, and `download_emulator` already supplies installer semantics. `handleDownloadEmulator` is Settings-local, so importing the Settings controller would couple unrelated UI. Ticket 02 establishes the correct candidate set first. This is code-inspection evidence, not a runtime reproduction.

## Minimal implementation plan

1. At existing missing-emulator recovery surfaces, query `get_emulators_for_platform` and derive the sole candidate from `EmulatorInfo.is_installed`, `has_download`, and `name` after ticket 02 compatibility filtering.
2. Reuse the existing `download_emulator` command and its progress/result conventions behind a minimal confirm/cancel interaction; keep `getLaunchErrorPresentation` as the error classification contract.
3. Refresh only the local recovery state needed to show installation progress/result and allow a later Play attempt.

## Scope and preservation

Do not build a global typed-error system, install automatically, import the Settings controller, or change backend RetroArch/core behavior. No new dependency or generic installer framework.

## Targeted verification

Add focused existing UI interaction coverage for confirm, cancel, and no prompt at zero/multiple candidates. Stub IPC/installation; do not perform a live emulator download.

## Comments

- 2026-09-22: Completed shared recovery seam: typed game-details IPC for candidate lookup/install, explicit missing-emulator classification, and reusable candidate/install state with focused tests. Typecheck and targeted tests pass.
- 2026-09-22: Completed standard Game Details recovery UI with confirm/cancel, pending/result feedback, no automatic relaunch, and zero/multiple/unrelated-error interaction coverage. The focused Game Details tests and typecheck pass.
- 2026-09-22: Completed immersive launch-dialog recovery with controller-aware confirmation, cancel, pending/result feedback, and no automatic relaunch. Focused immersive tests and typecheck pass.
- 2026-09-22: Moved the new desktop interaction coverage into a focused test module so changed files pass type-aware Ultracite checks. The full unit suite passes (293 tests before the split; focused post-split coverage also passes); full frontend lint remains blocked only by 45 pre-existing baseline errors outside this ticket.
- 2026-09-22: Final review found and the foundational slice corrected the installed-candidate precondition: recovery now offers nothing whenever any compatible emulator is already installed. The regression case and all focused recovery tests pass.
- 2026-09-22: Two-axis `code-review` re-reviewed the corrected complete diff and approved it with no remaining blocking Standards or Spec findings.

## Answer

Both standard and immersive missing-emulator recovery surfaces now query the backend-filtered compatible emulator list and offer an explicit named installation only when none is installed and exactly one uninstalled downloadable candidate remains. Confirm uses `download_emulator` with pending and result feedback without relaunching; cancel leaves the existing guidance intact and performs no installation. Focused interaction coverage proves confirm, cancel, zero/multiple candidates, unrelated failures, and the installed-candidate precondition.
