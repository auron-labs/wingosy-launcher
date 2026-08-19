# 07 — Extend RetroArch reliability to the Game Boy family

**What to build:** Extend the proven RetroArch launch path to Game Boy, Game Boy Color, and Game Boy Advance using the intended Gambatte and mGBA cores, with the same preflight guarantees and safe couch launch behaviour as NES.

**Blocked by:** 05 — Establish the reliable RetroArch NES slice.

**Status:** resolved

- [x] Game Boy and Game Boy Color resolve the intended Gambatte core as an absolute existing path.
- [x] Game Boy Advance resolves the intended mGBA libretro core as an absolute existing path.
- [x] All three platforms reject missing cores before emulator startup with structured errors.
- [x] All three preserve configured emulator selection and RetroArch save synchronization.
- [x] Automated tests cover every mapping, managed and external paths, fullscreen arguments, and ROM paths containing spaces and Unicode.
- [x] No unrelated RetroArch platform is marked verified by this ticket.

## Answer

Production mappings and the shared launch/save-sync paths required no production changes. Characterization tests cover Game Boy and Game Boy Color Gambatte plus Game Boy Advance mGBA across external/platform-default and managed/per-game RetroArch selection, absolute existing cores, fullscreen and safe Unicode arguments, and structured missing-core errors before emulator startup. No unrelated RetroArch platforms were marked verified. Review found no actionable diff or scope issues.

Verification:

- `mise exec -- cargo check --manifest-path src-tauri/Cargo.toml --tests --target x86_64-pc-windows-gnu` passed.
- `mise exec -- cargo clippy --all-targets --all-features --target x86_64-pc-windows-gnu -- -D warnings` passed.
- `mise exec -- npm run typecheck` passed.
- `mise exec -- npm run test:unit` passed 35 tests.
- Focused and full host Rust tests could not compile because system `gdk-3.0` pkg-config metadata is missing.
