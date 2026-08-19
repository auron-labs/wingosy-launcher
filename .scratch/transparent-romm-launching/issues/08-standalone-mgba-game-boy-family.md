# 08 — Make standalone mGBA reliable for the Game Boy family

**What to build:** Make standalone mGBA a reliable selectable emulator for Game Boy, Game Boy Color, and Game Boy Advance through the unified Play pipeline, covering both Wingosy-managed and external installations without claiming unsupported save synchronization.

**Blocked by:** 05 — Establish the reliable RetroArch NES slice.

**Status:** resolved

- [x] Managed and external mGBA executables are detected and validated before launch.
- [x] Invalid or missing configured executables return structured, actionable errors.
- [x] GB, GBC, and GBA ROM paths are passed as separate process arguments and support spaces and Unicode.
- [x] Fullscreen is requested only with an option supported by the installed mGBA version.
- [x] Existing platform-default and per-game emulator selection is preserved.
- [x] Wingosy does not advertise or attempt automatic mGBA save synchronization unless separately implemented and verified.
- [x] Automated tests cover all three platforms, managed and external installations, invalid executables, fullscreen construction, and Windows-style paths.

## Answer

Standalone mGBA now launches GB, GBC, and GBA games with the stable `-f` fullscreen option and the ROM as its own process argument. Tests cover external/platform-default and managed/per-game selection, Unicode and spaced paths, Windows-style path preservation, invalid or absent executables, structured startup failures, and the Windows mGBA detection aliases without invoking the running callback. Detection now requires executable candidates to be regular files, while save-sync machinery remains unchanged and valid per-game/platform selection precedence is preserved.

Verification:

- `mise exec -- cargo check --manifest-path src-tauri/Cargo.toml --tests --target x86_64-pc-windows-gnu` passed.
- `mise exec -- cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features --target x86_64-pc-windows-gnu -- -D warnings` passed.
- `mise exec -- npm run typecheck` passed.
- `mise exec -- npm run test:unit` passed 35 tests across 7 files.
- Focused and full host Rust tests could not compile because `gdk-3.0` pkg-config metadata is missing; `npm run test:rust` failed for that environment reason.
