# 03 — Reliable Eden Save Sync

**What to build:** Make Eden save synchronization use the correct save root and trustworthy title metadata, with the necessary Eden config/NAND/save/BIOS-root agreement owned in this ticket. Run existing RomM negotiation before launch and again after a started Eden process exits, including non-zero exits, while retaining safe conflict handling, nonblocking warnings, durable pending failures, and later retry. Preserve configured-RomM BIOS preparation and the existing authentication, key, firmware, ZIP, backup, and restore behavior.

**Blocked by:** None — can start immediately
**Status:** ready-for-human

## Acceptance criteria

- [x] With save sync enabled, pre-launch negotiation resolves the correct Eden save root and title identity before Eden starts.
- [x] A newer remote save is restored before launch; an unresolved identity explicitly skips the operation and cannot write to the wrong title.
- [x] Post-launch negotiation runs only after Eden has started and exited, including a non-zero exit, and does not run when process creation fails.
- [x] After Eden exits, when negotiation selects upload because local data is newer, the newer local save is uploaded and reported as successful.
- [x] Conflicts never silently overwrite either the local or remote side.
- [x] Offline, authentication, path, and transfer failures remain nonblocking warnings with durable pending status and actionable retry on a later launch.
- [x] A corresponding pending failure is cleared only after negotiation succeeds.
- [x] Trustworthy title metadata is preferred over filename-only identity; no mandatory container parser is added.
- [x] Existing Eden save ZIP safety, backup/restore, RomM authentication, device identity, and configured-RomM BIOS preparation remain intact.

## Verification

- [x] Automated launch and negotiation seam tests cover pre/post decisions, newer remote restoration, newer local data/upload, conflicts, pending retry, unresolved identity, non-zero exit, and spawn failure without duplicating ZIP tests.
- [ ] Human check: perform a normal save upload and confirm its reported success plus pre-launch negotiation; remote restoration is proved by automated tests, not inferred from a local relaunch.

## Scope boundaries

- Reuse the existing RomM negotiation and ZIP safety flow; do not add a new parser, background service, scheduler, or save dashboard.
- A focused shared Eden resolver may be introduced or reused for root agreement, but this ticket must not require the controller ticket to be completed first.
- Do not alter configured sources for RomM keys or firmware, or make sync failures block game launch.

## Comments

- 2026-09-07: Claimed for implementation. Reuse points confirmed in the shared launch pipeline, Switch RomM negotiation/ZIP flow, pending-save-sync database record, and the existing Eden data-root resolver used by BIOS and controller setup.
- 2026-09-07: Implemented shared Eden NAND/save-root resolution, authenticated RomM title-identity preference with ambiguity refusal, pre/post negotiated transfer orchestration, non-zero Eden-exit post-sync, phase-aware durable pending failures, and successful transfer reporting in desktop and immersive launch surfaces. Existing ZIP, authentication, device identity, BIOS preparation, controller, and RetroArch behavior remain on their existing paths.
- 2026-09-07: Focused verification passed: Switch RomM 9 tests, Switch save 7 tests, RomM API 27 tests, database 1 test, commands 51 tests, and immersive launch UI 17 tests. The frontend production build and `git diff --check` passed. Rust tests required a temporary workaround for the repository's existing Tauri ACL mismatch; capability and generated-schema files were restored with no diff.
- 2026-09-07: Final independent review approved both Standards and Spec axes. The implementation is ready for the required live Windows Eden/RomM check, so the ticket remains open as `ready-for-human`.

## Answer

Eden save sync now resolves its NAND save directory from the same data root used by BIOS and controller preparation, while preserving an explicit save-root override. It prefers authenticated RomM base-game metadata for title identity, accepts a pathname fallback only when exactly one valid base title ID is present, and refuses ambiguous or unresolved identities before any transfer.

Negotiation restores newer remote data only before launch and uploads newer local data after a started Eden process exits, including non-zero exits. Spawn and validation failures do not run post-sync. Conflicts and transfer failures remain nonblocking warnings with phase-specific durable pending state; only a successful retry of the corresponding phase clears that state. Successful restores/uploads are returned by the launch command and shown in desktop and immersive Snackbar feedback.

The remaining verification is the minimal human check on Windows with configured Eden and RomM: change a save during normal play, exit and confirm the upload-success message, then relaunch and confirm pre-launch negotiation completes.
