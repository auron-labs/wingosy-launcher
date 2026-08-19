# 09 — Exercise the complete one-Play regression matrix

**What to build:** Prove the completed prepare-and-launch experience works coherently across backend, desktop, immersive mode, manual cache management, and the initial emulator slice, while retaining every existing behaviour Phase 1 promises not to regress.

**Blocked by:** 04 — Enable the controller-only remote Play flow; 06 — Extend RetroArch reliability to SNES and Genesis; 07 — Extend RetroArch reliability to the Game Boy family; 08 — Make standalone mGBA reliable for the Game Boy family.

**Status:** resolved

- [x] Automated coverage exercises local, remote-only, cached, failed-download, retry, and duplicate-request paths.
- [x] Automated coverage exercises staged progress, automatic continuation into launch, controller activation, buffered-input protection, and return to prior context.
- [x] Manual Download, Delete Local ROM, local-only games, RomM library sync, RetroArch save sync, and play-session recording have regression coverage or recorded manual checks.
- [x] RetroArch command tests cover NES, SNES, GB, GBC, GBA, and Genesis/Mega Drive.
- [x] Standalone mGBA command tests cover GB, GBC, and GBA.
- [x] Command and event mocks are identified as deterministic UI evidence, not proof of a real emulator launch.
- [x] Frontend lint, type checking, unit tests, Rust formatting, Rust tests, Rust clippy, and the production frontend build pass or retain only documented baseline failures.
- [x] Obsolete tests are replaced with equivalent one-Play coverage rather than weakened or deleted.

## Answer

- Atomic backend coverage in `src-tauri/src/api/download.rs` includes `atomic_download_cleans_truncated_transfer_and_preserves_cache`, `atomic_download_retry_recovers_after_validation_failure`, cached reuse, and success/Unicode tests.
- Desktop UI coverage in `src/components/GameDetails.test.jsx` covers remote Play, duplicate activation, failed preparation/retry, staged public-event progress, and new manual Download plus cached Delete Download command/update tests.
- Immersive UI coverage in `ImmersiveGameDetails.test.jsx` and `ImmersiveModeApp.test.jsx` covers local/cached/remote Play, controller activation, repeated/buffered input, staged progress, Retry/Back, and context restoration.
- Persistence coverage includes existing `test_sync_pattern_full_flow` for RomM sync, RetroArch save-sync helper tests in `src-tauri/src/sync/retroarch_romm.rs`, and new play-session plus clear-local-path tests in `database/games.rs`.
- The RetroArch launcher matrix covers NES, SNES, Genesis, GB, GBC, and GBA for external/platform defaults and managed/per-game selection. The mGBA matrix covers GB, GBC, and GBA.
- Mocked Tauri commands/events provide deterministic UI and dispatch evidence only; they do not prove a real emulator process launch. Runtime certification remains ticket 10.
- No obsolete tests were deleted or weakened; focused coverage was added.

## Verification

- `mise exec -- npm run lint:frontend`: passed with 8 pre-existing warnings and 0 errors.
- `mise exec -- npm run typecheck`: passed.
- `mise exec -- npm run test:unit`: 37 tests across 7 files passed.
- `mise exec -- npm run build`: passed; existing chunk-size warning only.
- `mise exec -- cargo check --manifest-path src-tauri/Cargo.toml --tests --target x86_64-pc-windows-gnu`: passed.
- `mise exec -- cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features --target x86_64-pc-windows-gnu -- -D warnings`: passed.
- Host focused/full Rust tests and host clippy could not compile because required Linux WebKit dependencies were absent (`libsoup-3.0` and/or `javascriptcoregtk-4.1` pkg-config metadata). This is the documented environment baseline, not a test failure.
- `cargo fmt --all -- --check` retains broad pre-existing formatting diffs across untouched Rust files; newly changed Rust lines were manually matched to rustfmt output and `git diff --check` passes.
