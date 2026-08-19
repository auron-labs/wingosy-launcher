# 06 — Extend RetroArch reliability to SNES and Genesis

**What to build:** Extend the proven RetroArch launch path to SNES and Genesis/Mega Drive so both platforms receive the same executable validation, absolute core resolution, fullscreen launch behaviour, safe argument handling, and actionable failures as NES.

**Blocked by:** 05 — Establish the reliable RetroArch NES slice.

**Status:** resolved

- [x] SNES resolves the intended Snes9x core through the shared core-directory rule.
- [x] Genesis/Mega Drive resolves the intended Genesis Plus GX core through the shared core-directory rule.
- [x] Both platforms reject missing cores before emulator startup with structured errors.
- [x] Both platforms preserve configured emulator selection and RetroArch save synchronization.
- [x] Automated tests cover both mappings, managed and external paths, fullscreen arguments, and ROM paths containing spaces and Unicode.
- [x] No unrelated RetroArch platform is marked verified by this ticket.

## Answer

Existing generic production launch/save-sync paths required no production changes. Characterization tests now cover both mappings, external and managed paths, platform-default/per-game selection, fullscreen/safe Unicode arguments, and structured missing-core failures with no running process. Save-sync preservation is by leaving the shared production pipeline unchanged. Review found no production correctness or scope-creep issues.

Verification:

- `mise exec -- cargo check --manifest-path src-tauri/Cargo.toml --tests --target x86_64-pc-windows-gnu` passed.
- Targeted Windows `cargo clippy --all-targets --all-features --target x86_64-pc-windows-gnu -- -D warnings` passed.
- `mise exec -- npm run typecheck` passed.
- `mise exec -- npm run test:unit` passed 35 tests.
- Host focused/full Rust tests could not build because system `glib-2.0` pkg-config metadata is missing.
