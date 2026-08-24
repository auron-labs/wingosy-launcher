# Keep RomM access tokens out of TOML

Type: task
Mode: agent
Status: ready-for-agent
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

- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes on Windows.
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` exits 0.
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
