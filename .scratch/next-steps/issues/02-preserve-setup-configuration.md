# Preserve RomM configuration through setup

Type: task
Mode: agent
Status: ready-for-human
Blocked by: none

> Follow this plan step by step and update `../spec.md` when done.
>
> Drift check: `git diff --stat a96ce03..HEAD -- src/components/SetupWizard.jsx src-tauri/src/commands.rs src-tauri/src/config/mod.rs`

## Status

- **Priority:** P0
- **Effort:** S
- **Risk:** MED
- **Depends on:** none
- **Category:** bug
- **Planned at:** commit `a96ce03`, 2026-08-23

## Why this matters

The first-run wizard successfully stores a paired RomM session, then Finish
replaces the entire config with defaults. This directly explains the reported
BIOS error and blocks the beta's main user journey.

## Current state

- `src-tauri/src/commands.rs:1185-1213` stores the approved server and credential.
- `src/components/SetupWizard.jsx:164-171` calls `complete_setup` with the chosen
  server and ROM directory.
- `src-tauri/src/commands.rs:142-146` ignores those values and saves
  `AppConfig::default()` over the existing configuration.
- `.scratch/ISSUES.md:1` reports that BIOS says RomM is not configured after sync.
- Existing Rust tests are inline `#[cfg(test)]`; React tests use Vitest and RTL.

## Scope

In scope: `src-tauri/src/commands.rs`, `src/components/SetupWizard.jsx`, one
focused test beside the changed logic. Out of scope: changing authentication
methods, BIOS behavior, or rebuilding the wizard.

## Steps

1. Change `complete_setup` to load the existing config, apply only setup values
   that were actually supplied, and save it. Preserve `romm.auth_method`, device
   ID, updater/display/audio settings, and any credentials already stored by
   pairing. Persist the selected ROM directory instead of silently ignoring it.
2. Add one regression check for: existing paired config + setup completion →
   server/session metadata survives and the ROM directory is applied. Keep the
   merge logic private and small; do not create a setup service abstraction.
3. Update the setup WebDriver path only if its current expectation encodes the
   destructive behavior.

## Verification and done criteria

- [x] `bun run typecheck` exits 0.
- [x] `bun run test:unit` passes.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml` passes on Windows.
- [ ] Manual Windows flow Pair → Sync → Finish → restart retains the connection.
- [ ] Opening BIOS after restart no longer reports an unconfigured server.
- [ ] Completing local-only setup still creates a valid default config.
- [ ] No files outside the stated scope are changed.

## STOP conditions

- Fixing this requires storing a credential in the TOML file.
- The live command signature differs from the wizard invocation after other work
  lands; reconcile the drift before editing.

## Maintenance notes

Setup completion must remain a merge, never a factory reset. Future wizard steps
should persist their own fields without replacing unrelated config sections.

## Comments

Implementation and frontend verification passed: `mise exec -- bun run typecheck` and
`mise exec -- bun run test:unit` (8 files, 41 tests). The focused Rust test was
blocked before compilation because Linux lacks `libsoup-3.0`; Windows-target cargo
check was blocked because `x86_64-w64-mingw32-gcc` is absent. Windows Rust and
manual-flow checks remain open.

### 2026-08-24 — Reopened after completed-task audit

The static merge is correct, but Windows Pair→Sync→Finish→restart and BIOS
verification remain pending.

### 2026-08-24 — Fresh automated verification

Automated verification passed: `mise exec -- bun run typecheck`;
`mise exec -- bun run test:unit` (10 files, 55 tests); the focused Rust setup
merge test; and full
`mise exec -- cargo test --manifest-path src-tauri/Cargo.toml`
(244 unit passed/1 ignored, 4 emulator integration passed/9 ignored, 4 RomM
integration passed/7 ignored). Windows Pair→Sync→Finish→restart and BIOS
manual acceptance remain pending, so the spec should remain `IN PROGRESS` and
this issue should remain `ready-for-human`.

### 2026-08-25 — Step 1 reassessment

Confirmed `complete_setup` still loads and merges the existing configuration,
applies only supplied setup values, and persists the selected ROM directory.
The existing focused test covers preservation of paired session metadata and
unrelated settings. No repair was identified; Windows runtime acceptance remains
the outstanding work.

### 2026-08-25 — Steps 2–3 reassessment

Confirmed the focused Rust regression still covers paired metadata preservation
and ROM directory replacement. The setup WebDriver path does not encode the old
destructive behavior, so no frontend or WebDriver change is needed.

Focused verification passed on Linux:
`mise exec -- cargo test --manifest-path src-tauri/Cargo.toml setup_merge_preserves_paired_config_and_applies_setup_values`
(1 passed).

Frontend verification also passed: `mise exec -- bun run typecheck` and
`mise exec -- bun run test:unit` (11 files, 74 tests).

The full Linux Rust suite passed: 266 unit tests passed/1 ignored, 4 emulator
integration tests passed/9 ignored, and 4 RomM integration tests passed/7
ignored. Native Windows and manual Pair→Sync→Finish→restart/BIOS checks remain
open.

Code review found the regression fixture still modeled legacy credentials inside
`AppConfig`. The fixture now reflects current secure pairing: session metadata is
preserved while credential secrets remain outside the TOML configuration.
The focused test and full Rust suite passed again after that correction.

This task cannot be resolved or committed as completed from this Linux host. A
human must still run the native Windows Pair → Sync → Finish → restart flow and
confirm BIOS retains RomM access; the issue therefore remains `ready-for-human`
and the roadmap remains `IN PROGRESS`.

### 2026-08-26 — Native Windows verification

The full native Windows Rust suite passed: 270 unit tests passed with 1 ignored,
4 emulator integration tests passed with 9 network/download tests ignored, and
4 RomM parsing integration tests passed with 7 live-server tests ignored. The
focused setup merge regression passed as part of that run.

Computer Use launched the native debug build against the existing Windows
profile and observed a populated RomM library after startup. A reversible config
rename also proved the first-run wizard renders, with the original config restored
before setup continued. Computer Use could not inject clicks into the fullscreen
Tauri/WebView window after its documented refocus-and-retry recovery, so
Pair → Sync → Finish → restart and the BIOS screen remain unverified. Keep the
ticket `ready-for-human`.
