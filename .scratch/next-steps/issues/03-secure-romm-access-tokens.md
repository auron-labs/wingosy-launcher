# Keep RomM access tokens out of TOML

Type: task
Mode: agent
Status: ready-for-human
Blocked by: 02

> Follow this plan step by step and update `../spec.md` when done.
>
> Drift check: `git diff --stat a96ce03..HEAD -- src-tauri/src/config/mod.rs src-tauri/src/commands.rs src-tauri/src/romm_credentials.rs`

## Status

- **Priority:** P0
- **Effort:** S
- **Risk:** MED
- **Depends on:** 002
- **Category:** security
- **Planned at:** commit `a96ce03`, 2026-08-23

## Why this matters

Windows Credential Manager is already the project's credential store, but the
legacy refresh path writes a usable access token into serialised `config.toml`.
Beta users may share config/support files or back them up, exposing their RomM
server session.

## Current state

- `src-tauri/src/config/mod.rs:188-202` serialises `RomMConfig.auth_token`.
- `src-tauri/src/commands.rs:1360-1365` saves a refreshed access token there.
- `src-tauri/src/romm_credentials.rs:14-84` already stores refresh and device
  tokens in Windows Credential Manager.
- Pairing and direct-token connection already clear `config.romm.auth_token` in
  `src-tauri/src/commands.rs:1203-1213,1473-1481`.

## Scope

In scope: the three files above and their tests. Out of scope: a new credential
database, cross-platform secure storage, OAuth redesign, or printing/token
inspection. Never copy token values into a test fixture, log, issue, or plan.

## Steps

1. Reuse the existing Windows Credential Manager path for the current access
   token after refresh; do not add a second credential store.
2. Clear `romm.auth_token` before saving configuration. On startup, migrate a
   legacy non-empty field into Credential Manager and clear it only after the
   secure write succeeds. If the write fails, return a reconnect-required error
   rather than discarding the only usable session.
3. Ensure disconnect deletes both secure entries and clears legacy config fields.
4. Add focused tests around migration state and clearing behavior without using
   real token material. Exercise the real Windows keyring manually.

## Verification and done criteria

- [x] `cargo test --manifest-path src-tauri/Cargo.toml` passes on Windows.
- [x] `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` exits 0.
- [ ] Pair, restart, refresh, BIOS access, sync, and disconnect work on Windows.
- [ ] After those actions, `config.toml` contains no usable access, refresh, or
      device token.
- [ ] A failed Credential Manager write does not silently lose the session.

## STOP conditions

- The implementation would persist the token in another plaintext file.
- Existing beta builds have already escaped to testers; report that token
  rotation/re-pairing guidance is also required.

## Maintenance notes

Configuration may describe which auth method is used, but secret-bearing values
belong only in the platform credential store or process memory.

## Comments

Implementation securely migrates legacy access tokens before clearing them,
stores refreshed access tokens in the existing Windows Credential Manager
device-token entry, refuses config saves carrying legacy access tokens, and
disconnect attempts both secure deletions before clearing fields. Focused tests
were added without real keyring/token material. `mise exec -- bun run typecheck`
passed; `mise exec -- bun run test:unit` passed (8 files, 41 tests); `git diff
--check` passed. Full Rust test and Clippy were attempted but blocked before
crate compilation because Linux lacks `javascriptcoregtk-4.1`; the Windows
cross-check was blocked by missing `x86_64-w64-mingw32-gcc`. Windows Credential
Manager/manual Pair/restart/refresh/BIOS/sync/disconnect remain to be
exercised. Existing Windows criteria remain unchecked.

### 2026-08-24 — Reopened after completed-task audit

The audit confirmed that delete-before-store and partial-failure ordering defects
remain unresolved. Windows credential testing is pending.

### 2026-08-24 — Implementation follow-up complete

Follow-up ordering now stores replacement credentials before the config commit and
obsolete cleanup. Disconnect clears and saves config before either cleanup attempt,
so a save failure deletes nothing. A rotated refresh is persisted before access for
recovery. Six focused tests use synthetic markers only. Verification passed:
`mise exec -- bun run typecheck`; `mise exec -- bun run test:unit` (10 files, 55
tests); frontend lint (0 errors, 7 pre-existing warnings); and `git diff --check`.
Rust targeted/full test and Clippy were attempted but remain blocked by existing
Linux non-Windows cfg, reqwest, and other pre-existing crate compile failures. The
Windows cross-check is blocked by missing `x86_64-w64-mingw32-gcc`. Windows Pair,
restart, refresh, BIOS, sync, and disconnect flows, plus Credential Manager
inspection, remain required.

### 2026-08-26 — Native Windows verification and Clippy cleanup

The full native Windows Rust suite passed: 270 unit tests passed with 1 ignored,
4 emulator integration tests passed with 9 network/download tests ignored, and
4 RomM parsing integration tests passed with 7 live-server tests ignored. Strict
Clippy initially found two over-wide private credential-persistence test seams;
their related callbacks are now grouped without changing ordering or storage
behavior. Strict Clippy then passed across all targets and features.

Computer Use observed the native build restoring an existing RomM-backed library,
but input injection into the fullscreen Tauri/WebView window failed after the
documented recovery. Pair/restart/refresh/BIOS/sync/disconnect and direct Windows
Credential Manager inspection remain required, so this ticket stays
`ready-for-human`.
