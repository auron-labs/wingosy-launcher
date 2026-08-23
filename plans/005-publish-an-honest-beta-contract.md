# Plan 005: Publish an honest beta support contract

> Follow this plan step by step and update `plans/README.md` when done.
>
> Drift check: `git diff --stat a96ce03..HEAD -- README.md DEV_README.md src/components/Settings.jsx .scratch/transparent-romm-launching/emulator-certification.md`

## Status

- **Priority:** P1
- **Effort:** S
- **Risk:** LOW
- **Depends on:** 001
- **Category:** direction / docs
- **Planned at:** commit `a96ce03`, 2026-08-23

## Why this matters

The application exposes many emulator/platform combinations while none has real
Windows certification. Beta testers need to know what is supported, what is
experimental, and what save behavior they can trust.

## Current state

- `README.md:9-15` broadly advertises 20+ platforms and save sync.
- `README.md:192-241` shows every Wingosy RetroArch/save-sync combination as
  planned and says current save actions are manual.
- `src-tauri/src/models/emulator.rs:55-288` exposes many standalone emulators;
  `retroarch_cores()` maps 12 platforms.
- `.scratch/transparent-romm-launching/emulator-certification.md:35-47` marks all
  nine Phase 1 runtime combinations `NOT VERIFIED`.

## Scope and contract

In scope: beta-facing copy in `README.md`, `DEV_README.md`, Settings, release
notes, and the certification ledger. Out of scope: deleting experimental code or
certifying it by assertion.

State exactly this first-beta promise: RetroArch on Windows 11 for NES, SNES, GB,
GBC, GBA, and Genesis; RomM pair/sync/download/one-Play; manual save management.
Standalone mGBA and every other emulator/platform remain experimental. Automatic
save sync is not promised until plan 006 records a real round trip.

## Steps

1. Put a short Private Beta section near the top of the README and in Settings.
   Label the six promised combinations and link to the ledger.
2. Mark all other emulator/platform rows experimental, not supported. Do not
   remove them or add an allowlist unless testers repeatedly mistake them for the
   certified path.
3. Make save copy explicit: manual upload/download is available; automatic sync
   is experimental until a real round trip passes.
4. Put known limitations and backup guidance into beta release notes.

## Verification and done criteria

- [ ] `rg -n "Private Beta|experimental|manual save" README.md DEV_README.md src/components/Settings.jsx` finds the contract in user-visible locations.
- [ ] No README checkmark claims a combination absent from the certification ledger.
- [ ] `bun run typecheck && bun run test:unit` exits 0 if UI copy changes.
- [ ] Release notes contain scope, backup guidance, and the feedback route from 007.

## STOP conditions

- A maintainer wants a different platform/emulator promise; update the contract
  and certification matrix together before proceeding.
- Someone asks to mark mocked or command-construction evidence as certification.

## Maintenance notes

Expand the support table only after a real Windows ledger row passes. Features
may remain accessible without becoming part of the beta promise.
