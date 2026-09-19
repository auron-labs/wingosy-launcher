# 11 — Distribute BIOS and firmware to managed emulators

**What to build:** After Wingosy obtains BIOS or firmware for a platform, place it in the expected location for each relevant managed emulator so it is usable without manual copying.

**Blocked by:** 10 — Keep BIOS downloads alive across navigation.

**Status:** resolved

- [x] Completed BIOS and firmware downloads are distributed to the relevant installed managed emulators.
- [x] Existing valid emulator files are not overwritten with invalid or incomplete downloads.
- [x] The UI reports whether distribution completed or failed.
- [x] Tauri MCP verifies the observable result for one available platform and managed emulator.

## Comments

- 2026-09-19: Distribution now limits work to installed Wingosy-managed emulator targets, matches platform aliases, validates cached artifacts against RomM size/checksum metadata, and stages copies before atomic replacement. Checksumless downloads also validate known size metadata before replacing the cache.
- 2026-09-19: Focused verification passed: 37 BIOS Rust tests, 6 BIOS UI tests, Rust formatting, frontend formatting/lint, typecheck, production build, and `git diff --check`. Clippy reached the application crate but remains red on five unrelated branch-baseline findings in `sync/mod.rs`, `api/download.rs`, `database/connection.rs`, and `sync/switch_romm.rs`; the ticket-touched BIOS and atomic-replacement warnings were corrected.
- 2026-09-19: Tauri MCP drove the running Windows app through Settings → BIOS, invoked distribution, and observed `Distributed 239 file copies (eden: 239).` The IPC result identified the managed Eden target at `C:\Users\azza\AppData\Roaming\Eden`. Evidence is saved under `evidence/11-distribute-bios/`.

## Answer

Wingosy now distributes only verified cached BIOS and firmware to relevant installed managed emulators. Sources with missing checksums, mismatched checksums or sizes, partial extensions, stale emulator paths, external emulator paths, or managed-directory escapes cannot replace emulator files. Copies are staged and atomically replaced, including Eden key/firmware installation, while the existing BIOS alert reports completion or failure.
