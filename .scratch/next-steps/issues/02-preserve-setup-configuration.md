# Preserve RomM configuration through setup

Type: task
Mode: agent
Status: ready-for-agent
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

- [ ] `bun run typecheck` exits 0.
- [ ] `bun run test:unit` passes.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes on Windows.
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
