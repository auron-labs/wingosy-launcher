# Certify and gate the Windows beta

Type: task
Mode: human
Status: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 08, 09

> Follow this plan on Windows 11 with permitted content and a beta RomM instance.
> Update `../spec.md` only after every must-pass gate is evidenced.
>
> Drift check: `git diff --stat a96ce03..HEAD -- .github/workflows/beta.yml e2e-webdriver .scratch/transparent-romm-launching`

## Status

- **Priority:** P0
- **Effort:** M
- **Risk:** LOW
- **Depends on:** 001–005, 008, 009
- **Category:** tests / release
- **Planned at:** commit `a96ce03`, 2026-08-23

## Why this matters

Phase 1 has strong source and mock evidence but no real Windows emulator run.
The current beta workflow can publish an arbitrary ref after building it without
running the repository's checks. The first invite must consume a tested candidate,
not use testers as the build gate.

## Current state

- `.scratch/transparent-romm-launching/issues/11-phase-1-release-gate.md:21-107`
  reports `PARTIALLY VERIFIED`, zero real Windows tests, and no certified combination.
- `.github/workflows/ci.yml:36-69` runs frontend/Rust checks on Windows.
- `.github/workflows/beta.yml:10-16,65-93` accepts an arbitrary ref and publishes
  without those checks.
- Existing WebDriver specs cover setup, downloads, cores, launch, and immersive
  flows; `TESTING.md` documents their prerequisites.

## Scope

In scope: `.github/workflows/beta.yml`, existing tests only where a reproduced
defect requires it, the existing certification ledger, and beta release evidence.
Out of scope: commercial ROMs, checking in emulator binaries/user data, broad
emulator certification, or weakening tests to obtain green results.

## Steps

1. Make beta build only `main` (remove arbitrary-ref publication). Before package
   publication, run install, frontend build/lint/typecheck/unit tests, Rust tests,
   and Clippy. Prefer a draft prerelease so the exact signed installer can be
   manually accepted before testers or updater clients see it.
2. On clean Windows 11, run the documented unit and WebDriver suites. Record exact
   commands, versions, and failures; fix reproduced blockers in separate changes.
3. For RetroArch NES, SNES, GB, GBC, GBA, and Genesis, record the managed profile
   and manifest version, real installation, detection, core resolution, remote
   first Play, cached replay, process/content, fullscreen/controller input,
   return to Wingosy, and failure/retry behavior.
4. Perform at least one pre/post-launch save round trip. If it fails or cannot be
   proven, keep automatic sync outside the beta promise.
5. Install beta N, create user configuration/database/ROM pointers, update to beta
   N+1, and prove all three persist. Check uninstall behavior and document what
   user data remains.
6. With a wired or Bluetooth XInput controller, navigate library → details → Play
   → RetroArch menu → clean exit → Wingosy. Disconnect/reconnect it once and
   smoke-test a second standard-mapped pad. Record controller family and transport.
7. Publish the draft only after the ledger and release checklist are attached or
   linked and every must-pass row is green.

## Commands and done criteria

- [ ] `bun install --frozen-lockfile`, `bun run build`, `bun run lint:frontend`, `bun run typecheck`,
      `bun run test:unit`, `bun run test:rust`, and `bun run lint:rust` exit 0 on Windows.
- [ ] `bun run test:e2e` executes specs (not merely workers) and all beta-critical
      setup/sync/download/launch/immersive cases pass.
- [ ] All six promised RetroArch ledger rows contain real Windows 11 evidence.
- [ ] The tested installer contains the recorded RetroArch/core manifest, and
      repair restores its managed delta without changing external configuration.
- [ ] A standard/XInput controller completes navigation, play, clean exit,
      disconnect/reconnect, and return without duplicate or stuck input.
- [ ] Clean install and N→N+1 update preserve config, database, and ROM pointers.
- [ ] The published tag identifies the exact tested commit and CI run.
- [ ] No user data, credentials, copyrighted content, or emulator binary is committed.

## STOP conditions

- A promised combination lacks permitted test content or a real runtime result.
- The candidate differs from the installer that was manually accepted.
- Any update loses configuration, database contents, ROM paths, or saves.
- A failing test is proposed for deletion/skipping solely to publish.

## Maintenance notes

The ledger is the support matrix's evidence source. Repeat install/update smoke
for every beta; repeat full emulator certification when launcher/core behavior changes.
