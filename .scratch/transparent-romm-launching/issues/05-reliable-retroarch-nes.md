# 05 — Establish the reliable RetroArch NES slice

**What to build:** Make NES the first demonstrably reliable RetroArch path through the unified Play pipeline. Wingosy should resolve a managed or externally configured RetroArch executable, resolve the required core as an absolute path, reject invalid preflight state, and launch fullscreen with safe process arguments.

**Blocked by:** 04 — Enable the controller-only remote Play flow.

**Status:** resolved

- [x] Managed and external RetroArch executables are resolved and validated before launch.
- [x] The NES core mapping resolves to an absolute file beneath the detected RetroArch installation.
- [x] Core installation, detection, and launch use the same core-directory rule.
- [x] A missing required core returns a structured, actionable error without starting RetroArch.
- [x] The ROM path is passed as a separate process argument and supports spaces and Unicode.
- [x] The launch command requests fullscreen couch behaviour without depending on the working directory.
- [x] Existing platform-default and per-game emulator selection is preserved.
- [x] Existing RetroArch pre-launch and post-launch save synchronization is preserved.
- [x] Automated tests cover managed and external installs, absolute core resolution, missing core, and safe command construction.
- [x] Support documentation is not marked verified solely from automated command tests.

## Answer

Managed and external RetroArch now resolve an absolute executable/core path through one shared core-directory rule, with fullscreen and separate safe ROM arguments. Missing launches return structured no-spawn errors; selection and save-sync behavior remain preserved. Documentation is intentionally not marked runtime-verified.

Verification:

- `cargo clippy --all-targets --all-features --target x86_64-pc-windows-gnu -- -D warnings` passed.
- Windows-target `cargo check --tests` passed.
- Frontend typecheck, build, and 35 Vitest tests passed.
- Host `cargo test` could not execute on this Linux host because system `glib-2.0` development metadata is missing.
