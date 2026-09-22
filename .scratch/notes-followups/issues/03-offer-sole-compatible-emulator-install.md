# 03 — Offer sole compatible emulator install

**What to build:** When launch recovery finds no installed compatible emulator but exactly one compatible downloadable candidate, the existing missing-emulator recovery UI offers confirm/cancel installation. Confirm starts the existing installer with visible pending/result feedback; cancel changes nothing, and the user may press Play again after installation.

**Blocked by:** [02 — Correct Switch emulator compatibility](./02-correct-switch-emulator-compatibility.md)

**Status:** ready-for-agent

## Acceptance

- [ ] A Switch title whose sole compatible downloadable candidate is Eden offers Eden installation from the missing-emulator recovery surface.
- [ ] Confirm starts the existing `download_emulator` installation flow and exposes its pending/result state; it does not automatically relaunch the game.
- [ ] Cancel performs no installation.
- [ ] Zero or multiple compatible downloadable candidates, and unrelated launch errors, retain current guidance with no install prompt.
- [ ] RetroArch core readiness/filtering remains governed by `get_emulators_for_platform`; this is not a RetroArch core-manager flow.

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
