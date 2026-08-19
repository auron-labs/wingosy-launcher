# 11 — Run the Phase 1 release gate

**What to build:** Run the complete project-defined validation and produce the required Phase 1 completion report so maintainers can distinguish implemented behaviour, automated evidence, real Windows verification, regressions, and remaining gaps.

**Blocked by:** 10 — Record evidence-based emulator certification.

**Status:** resolved

- [x] All applicable frontend lint, type checking, unit tests, Rust formatting, Rust unit and integration tests, Rust clippy, production build, and Tauri/WebDriver suites are run.
- [x] Windows-specific tests are run on Windows when supported; unavailable checks are explicitly identified rather than silently skipped.
- [x] Failing tests are investigated and reported without weakening, skipping, or deleting them merely to obtain a green result.
- [x] Manual ROM download, Delete Local ROM, local-only games, RomM library sync, RetroArch save sync, play-session recording, and immersive controller navigation receive explicit regression statuses.
- [x] The completion report uses the exact structure required by the Phase 1 specification and lists exact commands and outcomes.
- [x] Overall status is `PARTIALLY VERIFIED` or `NOT VERIFIED` whenever real Windows emulator evidence is incomplete.
- [x] Any commits created for the phase are listed; no changes are pushed unless explicitly instructed.

## Answer

# Result

Overall status: PARTIALLY VERIFIED

## Task 1 — Prepare and launch

Status:

PARTIALLY VERIFIED. The implementation exists and deterministic frontend/source evidence is present, but native Rust execution and real Windows/RomM/emulator execution were unavailable on this Linux host.

Implemented:

The unified backend prepare-and-launch pipeline, atomic RomM download handling, cached reuse, local-game handling, save-sync wiring, and play-session recording are implemented by the prior Phase 1 work. No source changed in this release-gate ticket.

Files changed:

Implementation evidence is in `src-tauri/src/commands.rs`, `src-tauri/src/api/download.rs`, `src-tauri/src/emulators/launcher.rs`, and the relevant database/save-sync modules. These files were changed by prior phase commits; this ticket changed only its Markdown report.

Tests run:

Focused Rust filters for `atomic_download`, `launch_`, and `retroarch`, the default Rust suite, the Rust unit and critical suites, native Clippy, and the ignored integration suites were attempted but could not compile because Linux pkg-config metadata for `javascriptcoregtk-4.1` and/or `libsoup-3.0` is absent. This is an environment baseline/unavailable result, not a failing test assertion: no Rust tests executed and no Rust assertion failure is being claimed. The frontend unit, typecheck, lint, and build checks passed as recorded below. TDD/new tests were not applicable because this ticket changed only Markdown evidence/state and introduced no behavioral seam.

Manual verification:

Not available. The host is `Linux 6.17.0-22-generic x86_64`; no real Windows 11 environment, emulator, controller, or RomM runtime was available. RomM runtime credentials were unavailable; no secrets were inspected.

Remaining gaps:

Run the native Rust suites and exercise local, remote-only, cached, failed-download, duplicate-request, save-sync, and play-session behavior against a real Windows 11 app with a permitted ROM and live RomM runtime.

## Task 2 — Couch UX

Status:

PARTIALLY VERIFIED. The desktop and immersive one-Play flow has deterministic UI coverage and passed frontend validation, but no real Tauri/WebDriver, Windows, emulator, or controller run was available.

Implemented:

The shared Play flow, staged preparation progress, retry/back error handling, manual download/delete actions, controller activation and buffered-input protection are implemented in the existing frontend. No source changed in this release-gate ticket.

Files changed:

Implementation and test evidence is in `src/RomDownloadsContext.jsx`, `src/components/GameDetails.jsx`, `src/immersive/ImmersiveGameDetails.jsx`, and `src/immersive/ImmersiveModeApp.jsx` plus their tests. These files were changed by prior phase commits; this ticket changed only its Markdown report.

Tests run:

`ImmersiveGameDetails` passed 8/8, `ImmersiveModeApp` passed 2/2, and `GameDetails` passed 6/6. The full Vitest suite passed 7 files and 37/37 tests. Typecheck passed twice. Frontend lint completed with 0 errors and 8 pre-existing warnings. `npm run test:e2e` could not start the specs because Edge was absent: WebDriver reported 0 passed and 11 failed workers, with no actual specs executed; a worker also reported `write EINVAL` after the prepare-hook failure.

Manual verification:

Not available. `tauri-driver`, Microsoft Edge, and the `msedge` command were not found. No real mouse-free controller flow, emulator return, or Windows Tauri shell run occurred.

Remaining gaps:

Run the WebDriver suite and manually verify Play, progress, retry, Back, focus restoration, duplicate-input protection, emulator return, and controller navigation on Windows 11 with the real Tauri app.

## Task 3 — Emulator certification

Status:

PARTIALLY VERIFIED. Command-construction, path, source, and ledger evidence exists, but no combination is fully certified because all real Windows runtime evidence is missing.

Implemented:

RetroArch absolute core resolution, mapped platform command construction, managed/external installation handling, fullscreen arguments, safe ROM arguments, missing-core errors, and standalone mGBA command construction are represented in the implementation and automated test sources. The certification ledger records the boundary and evidence.

Files changed:

Implementation evidence is in `src-tauri/src/emulators/launcher.rs` and relevant emulator detection/core modules. The evidence ledger is `.scratch/transparent-romm-launching/emulator-certification.md`. These are prior phase evidence; this ticket changed only its Markdown report.

Automated tests:

The ledger records source and test references for all six RetroArch mappings and standalone mGBA GB/GBC/GBA command construction. Native host Rust test execution, native Clippy, emulator integration, RomM integration, and the ignored core buildbot test could not compile because Linux pkg-config metadata for `javascriptcoregtk-4.1` and/or `libsoup-3.0` is absent. This is an environment baseline/unavailable result, not a failing test assertion. Windows cross-target `cargo check --tests` and all-targets/all-features Clippy with `-D warnings` passed, but those checks do not execute tests or emulators.

Real Windows tests:

None. No Windows 11, emulator, permitted test content, controller, or RomM runtime was available. Every real Windows runtime field remains `NOT VERIFIED`.

Certified combinations:

None. All nine combinations in `.scratch/transparent-romm-launching/emulator-certification.md` are `PARTIALLY VERIFIED`; no combination is fully certified.

Not verified:

For all nine combinations, real installation, detection, core resolution where applicable, command execution, emulator process start, content load, fullscreen behavior, controller input, and save synchronization remain `NOT VERIFIED`. Standalone mGBA core resolution is `N/A` as recorded in the ledger.

Remaining gaps:

Complete the nine Windows 11 runtime exercises with permitted content, RetroArch or mGBA installations, a controller, and a live RomM runtime, including pre-launch/post-launch save round trips. Do not expand the support matrix based on source or mocked evidence alone.

## Regression checks

- Manual ROM download: PARTIALLY VERIFIED — `GameDetails` has automated UI coverage for the manual Download action and progress/update behavior; manual Windows/native and live RomM verification did not run.
- Delete local ROM: PARTIALLY VERIFIED — `GameDetails` has automated UI coverage for Delete Local ROM and the cached state update; manual Windows/native verification did not run.
- Local-only games: PARTIALLY VERIFIED — deterministic `ImmersiveGameDetails`/`ImmersiveModeApp` coverage exercises local launch behavior; native Rust and real Windows emulator evidence did not run.
- RomM library sync: PARTIALLY VERIFIED — existing source/Rust test coverage is recorded by issue 09, but native execution could not compile on this host; no live RomM round trip occurred and credentials were unavailable.
- RetroArch save sync: PARTIALLY VERIFIED — existing source/Rust save-sync coverage is recorded by issue 09, but native execution could not compile; no live emulator save round trip occurred.
- Play-session recording: PARTIALLY VERIFIED — existing source/Rust coverage is recorded by issue 09, but native execution could not compile; no real emulator session was recorded.
- Immersive controller navigation: PARTIALLY VERIFIED — `ImmersiveGameDetails`/`ImmersiveModeApp` coverage exercises controller dispatch, repeated/buffered input protection, and navigation wiring; no physical controller, Windows runtime, or emulator run occurred.

## Commits

- `c1ea66c feat: make RomM downloads atomic`
- `94b09c0 feat: unify local game launch pipeline`
- `da61ddf feat: add one-click remote play`
- `a13b886 feat: add controller-safe remote play`
- `f8885b6 feat: make RetroArch NES launches reliable`
- `4d79ed9 test: verify RetroArch SNES and Genesis launches`
- `531a687 test: verify RetroArch Game Boy family launches`
- `1047a83 feat: make standalone mGBA launches reliable`
- `6a74c4d test: cover one-play regression matrix`
- `944463e chore: add docs`
- `4d967eb docs: record emulator certification evidence`

## Commands executed

```text
uname -srm && command -v tauri-driver || true && command -v microsoft-edge || true && command -v microsoft-edge-stable || true && command -v msedge || true
  -> Linux 6.17.0-22-generic x86_64; no tauri-driver, Microsoft Edge, or msedge command found.

mise exec -- npm run test:unit -- src/immersive/ImmersiveGameDetails.test.jsx
  -> passed, 8/8 tests.
mise exec -- npm run typecheck
  -> passed.
mise exec -- npm run test:unit -- src/immersive/ImmersiveModeApp.test.jsx
  -> passed, 2/2 tests.
mise exec -- npm run test:unit -- src/components/GameDetails.test.jsx
  -> passed, 6/6 tests.
mise exec -- npm run lint:frontend
  -> passed with 0 errors and 8 pre-existing warnings.
mise exec -- npm run typecheck
  -> passed a second time.
mise exec -- npm run test:unit
  -> passed, 7 files and 37/37 tests.
mise exec -- npm run build
  -> passed; only the existing >500 kB chunk warning was reported.
mise exec -- cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check
  -> failed on broad pre-existing rustfmt diffs in untouched Rust files, including sync and integration test files; no formatting was applied.
mise exec -- cargo test --manifest-path src-tauri/Cargo.toml atomic_download -- --nocapture
  -> could not compile because Linux pkg-config metadata for javascriptcoregtk-4.1 and/or libsoup-3.0 is absent; no test assertion ran.
mise exec -- cargo test --manifest-path src-tauri/Cargo.toml launch_ -- --nocapture
  -> could not compile for the same missing Linux pkg-config metadata; no test assertion ran.
mise exec -- cargo test --manifest-path src-tauri/Cargo.toml retroarch -- --nocapture
  -> could not compile for the same missing Linux pkg-config metadata; no test assertion ran.
mise exec -- npm run test:rust
  -> could not compile for the missing Linux javascriptcoregtk-4.1 and/or libsoup-3.0 pkg-config metadata; no Rust tests executed.
mise exec -- npm run test:rust:unit
  -> could not compile for the missing Linux javascriptcoregtk-4.1 and/or libsoup-3.0 pkg-config metadata; no Rust tests executed.
mise exec -- npm run test:rust:critical
  -> could not compile for the missing Linux javascriptcoregtk-4.1 and/or libsoup-3.0 pkg-config metadata; no Rust tests executed.
mise exec -- cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
  -> could not compile for the missing Linux javascriptcoregtk-4.1 and/or libsoup-3.0 pkg-config metadata; native Clippy did not execute.
mise exec -- cargo check --manifest-path src-tauri/Cargo.toml --tests --target x86_64-pc-windows-gnu
  -> passed.
mise exec -- cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features --target x86_64-pc-windows-gnu -- -D warnings
  -> passed.
mise exec -- cargo test --manifest-path src-tauri/Cargo.toml --test emulator_integration -- --ignored --nocapture
  -> could not compile for the missing Linux javascriptcoregtk-4.1 and/or libsoup-3.0 pkg-config metadata; no emulator integration assertion ran.
mise exec -- cargo test --manifest-path src-tauri/Cargo.toml --test romm_integration -- --ignored --nocapture
  -> could not compile for the missing Linux javascriptcoregtk-4.1 and/or libsoup-3.0 pkg-config metadata; no RomM integration assertion ran. RomM runtime credentials were unavailable; no secrets were inspected.
mise exec -- npm run test:rust:cores
  -> could not compile for the missing Linux javascriptcoregtk-4.1 and/or libsoup-3.0 pkg-config metadata; the ignored core buildbot test did not execute.
mise exec -- npm run test:e2e
  -> failed before specs because Edge was absent; WebDriver reported 0 passed and 11 failed workers, no actual specs executed, plus worker write EINVAL after the prepare-hook failure.
mise exec -- npm run tauri build
  -> timed out after 120 seconds while compiling; the frontend beforeBuild step passed.
mise exec -- npm run tauri build
  -> reached a deterministic failure because Linux libsoup-3.0 metadata is missing; the frontend beforeBuild step passed.
```
