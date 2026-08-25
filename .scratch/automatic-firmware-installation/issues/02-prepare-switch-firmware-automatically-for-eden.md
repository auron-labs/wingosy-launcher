# 02 — Prepare Switch firmware automatically for Eden

**What to build:** On Switch Play through the selected Eden instance, prepare
the user's RomM-hosted `prod.keys` and firmware archive, validate and safely
install compatible artifacts into that instance, then launch Eden.

**Blocked by:** 01 — Prepare BIOS automatically before launch

**Status:** resolved

- [x] Switch Play through the selected Eden instance downloads the user's RomM-hosted `prod.keys` and firmware archive using the existing scoped download, integrity, and path checks.
- [x] The keys and firmware archive are validated for compatibility before installation or process spawn.
- [x] Valid artifacts are installed only into the selected Eden instance, and Eden launches only after preparation succeeds.
- [x] Missing, invalid, or incompatible artifacts stop launch with an actionable error; retries are idempotent.
- [x] No proprietary keys or firmware are bundled or sourced outside the user's configured RomM.

## Progress

- [x] Inspected the current worktree history and relevant code; the existing Eden implementation is already present in `src-tauri/src/bios.rs`, launch sequencing is already wired through `src-tauri/src/commands.rs`, and focused Rust tests cover the ticket's core paths.
- [x] Mapped the existing implementation to the acceptance criteria: RomM-scoped downloads and checks are in `prepare_eden_firmware_for_launch`, compatibility is checked before installation, installation is scoped by the selected executable's Eden data root, and launch failure occurs before emulator spawn.
- [x] Re-traced the confirmed review gaps: validation stops after the first compatible NCA, cache files without an expected MD5 are trusted, and portable Eden detection misses an existing executable-adjacent `user` directory.
- [x] Added focused Rust regressions for later incompatible NCAs with no install writes, cache files missing expected MD5, and adjacent portable `user` detection.
- [x] Implemented the root fixes: every enclosed NCA now requires a complete decrypted `NCA3` header, missing-MD5 cache files are never current, and an existing adjacent `user` directory selects portable Eden.
- [x] Verified focused Rust tests: `mise exec -- bun run test:rust:unit` passed (260 passed, 1 ignored), and `mise exec -- bun run test:rust:critical` passed (2 integration tests).
- Known unrelated lint blocker: `mise exec -- bun run lint:rust` reached clippy but failed on pre-existing `too_many_arguments` findings in `src-tauri/src/commands.rs:1416` and `src-tauri/src/commands.rs:1541`, outside this ticket diff.
- [x] Final standards review passed with no findings.
- [x] Final spec review passed with no findings.
- [x] Targeted rustfmt for `bios.rs` passed.
- [x] Full `mise exec -- bun run test:rust` passed (260 unit passed/1 ignored, 8 integration passed total with expected ignored tests).
- [x] `mise exec -- bun run test:unit` passed (72).
- [x] `mise exec -- bun run typecheck` passed.
- Whole-repo cargo fmt and clippy remain blocked by unrelated pre-existing files/findings; the changed `bios.rs` file is formatted.

## Answer

Switch Play now prepares the selected Eden instance from the user's RomM-scoped `prod.keys` and firmware archive, validates every artifact before installation, installs only compatible artifacts into that instance, and launches Eden only after preparation succeeds. Missing, invalid, or incompatible artifacts fail safely with actionable errors, retries are idempotent, and no proprietary keys or firmware are bundled. Verification passed with targeted `bios.rs` rustfmt, the full Rust suite, 72 unit tests, and typecheck.
