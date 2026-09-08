# 01 — Drive one system controller through a persistent adapter

Parent: Windows virtual gamepad testing proof-of-concept specification

Blocked by: None

Status: resolved

## Implementation progress

- [x] Claimed as the next unblocked task from `.scratch/STATE.md`.
- [x] Implement the standalone adapter, boundary tests, Windows smoke executable,
      and operator provisioning note.
- [x] Run targeted available-host verification (four focused adapter tests plus adapter
      format, check, and Clippy passed on Linux; Windows driver execution remains
      deferred as specified).
- [x] Review the completed change with the `code-review` skill (approved after
      the focused command-boundary correction).
- [x] Resolve the ticket and commit the approved implementation.

Review pass 1 requested a focused correction: exercise valid and invalid
`set_state` input through the real adapter command boundary while recording the
dispatched report. The implementation agent completed that correction and reran
the focused adapter checks successfully.

## What to build

Build the complete standalone Windows-only Rust adapter for one implicit Xbox 360
controller. Use `vigem-rust` 0.2 behind a persistent, sequential newline-delimited
JSON stdio process. The process must support `connect`, `set_state`, `neutral`,
`status`, and `disconnect` without becoming a network service or introducing
controller handles, slots, or another driver abstraction.

`set_state` accepts and validates a complete normalized report: button booleans,
one D-pad direction, stick axes in `[-1, 1]`, and triggers in `[0, 1]`. Convert
valid endpoint values to the native X360 report and preserve useful lifecycle and
driver errors with enough command context to diagnose setup, input, readiness, or
cleanup failures. Reuse the crate lifecycle and error behavior rather than adding
an exhaustive classification framework.

Make `neutral` and `disconnect` safe cleanup operations. EOF and explicit
disconnect must attempt neutralization and then unplug/release even if neutral
fails, and must report the relevant errors. Keep the dependency and adapter
outside Wingosy's shipped runtime so ordinary and non-Windows checks remain
independent of ViGEmBus.

Include concise operator instructions for manually provisioning a deliberately
verified, production-signed archived driver, including the retired-updater
warning. Do not install, update, bundle, or automate driver provisioning.

## Acceptance

- [x] One persistent process can connect one ready X360 target, accept sequential
      commands, report status, send complete states, neutralize, and disconnect;
      it exposes no handles, leases, service, or second-controller behavior.
- [x] Focused boundary tests cover complete normalized endpoint states, reject
      out-of-range axes and triggers before sending a report, and verify the
      command path produces the expected native report. Tests use only the
      smallest recording seam needed for this boundary.
- [x] EOF and explicit disconnect attempt neutral then unplug/release, preserve
      cleanup errors including a neutral failure, and do not rely on process drop
      alone.
- [x] An opt-in Windows-only real-driver smoke executable is implemented for
      connect/readiness, A press/release, D-pad press/release, neutral, and
      disconnect. Its Windows run is deferred to the final human handoff.
- [x] The provisioning note isolates the archived signed-driver and stale-updater
      risk and makes no shipped-runtime or automated-install claim.

## Verification and scope

Run applicable available-host Rust, non-Windows, and adapter boundary checks;
ordinary project checks must remain unaffected. Actual driver compatibility is
explicitly unverified without Windows and does not block completion of this
ticket or ticket 02. The Windows smoke run is a deferred handoff check, not a
reason to add a Windows emulator, a mock of the whole driver, inventory or slot
policing, or unrelated refactoring.

## Answer

Implemented a standalone test-owned Rust adapter under
`tools/virtual-gamepad-adapter/`. It provides the sequential NDJSON lifecycle,
complete normalized X360 reports, validation and native conversion, explicit
neutral-first cleanup, a Windows-only real-driver smoke executable, and concise
manual provisioning guidance. Four focused host-independent tests exercise the
actual serialized command boundary and cleanup error behavior.

Adapter tests, formatting, check, and Clippy pass on Linux. The repository-wide
quality task remains blocked by a pre-existing extra newline in `AGENTS.md`, and
the specified real-driver compile/run remains deferred to a provisioned Windows
machine.
