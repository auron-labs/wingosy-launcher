# 11 — Distribute BIOS and firmware to managed emulators

**What to build:** After Wingosy obtains BIOS or firmware for a platform, place it in the expected location for each relevant managed emulator so it is usable without manual copying.

**Blocked by:** 10 — Keep BIOS downloads alive across navigation.

**Status:** resolved

- [x] Completed BIOS and firmware downloads are distributed to the relevant installed managed emulators.
- [x] Existing valid emulator files are not overwritten with invalid or incomplete downloads.
- [x] The UI reports whether distribution completed or failed.
- [x] Tauri MCP verifies the observable result for one available platform and managed emulator.

## Comments

- 2026-09-18: Backend slice completed. Distribution now limits work to installed managed emulator targets, matches platform aliases, verifies cached artifacts against RomM size/checksum metadata, and stages copies before replacement. Focused BIOS tests (27) and Clippy with warnings denied passed.
- 2026-09-18: Frontend reporting slice completed. Regression coverage proves successful copy totals and rejected backend distributions are rendered as success/error alerts. Focused Vitest (4 tests), lint, formatting, and typecheck passed.
- 2026-09-18: Tauri MCP smoke passed with a disposable 31-byte GBA artifact from a local RomM mock. The BIOS UI reported `Distributed 1 file copies (mgba: 1).`, and the managed mGBA target matched the source bytes. Temporary runtime state and generated side effects were restored or removed.
- 2026-09-18: Final frontend build, lint, typecheck, coverage (47 files / 243 tests), focused BIOS UI tests, Rust formatting, and diff checks passed. Full unit/quality and additional Rust checks remain affected by unrelated baseline pagination, formatting, Tauri-capability, and tool-availability blockers documented by verification.
- 2026-09-18: Code review requested four backend corrections: propagate Switch metadata errors, preserve launch-time installation semantics, use atomic Windows replacement, and reject managed-path escapes. The backend agent addressed all four with regression coverage; 31 BIOS tests, Clippy with warnings denied, Rust formatting, and diff checks passed.
- 2026-09-18: Final review identified and corrected checksumless short-download handling. Streamed and staged files now validate available RomM size metadata before replacement; the existing target is preserved on mismatch. The final backend run passed 32 BIOS tests and Clippy, and code re-review approved both standards and spec axes with no remaining blockers.

## Answer

Wingosy now distributes verified cached BIOS and firmware to relevant installed managed emulators through staged, atomic replacement, including alias-aware platform matching and validated Eden firmware installation. Invalid, incomplete, unknown, or escaped sources do not replace emulator files, and the BIOS UI reports completion or failure. Tauri MCP verified a real UI distribution to a disposable managed mGBA target.
