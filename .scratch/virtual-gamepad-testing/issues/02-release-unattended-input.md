# 02 — Release unattended input without ending the controller session

Parent: Windows virtual gamepad testing proof-of-concept specification

Blocked by: 01 — Drive one system controller through a persistent adapter

Status: resolved

## What to build

Add a finite, configurable inactivity timeout to the persistent adapter while
the process is alive. Every accepted complete `set_state` resets the timeout.
When it expires, use the same actual neutral-report path as the `neutral`
command, retain only a minimal last-timeout diagnostic, and keep the target
connected and usable for later input. This is an unattended-input safeguard, not
an expired lease or controller-session termination.

Add the smallest controllable-time test seam needed to prove the behavior. The
test must capture the requested report, not merely an expired flag or a neutral
intent: an accepted state postpones expiry, expiry requests a complete neutral
report, and a subsequent input is accepted after neutralization. Document only a
short manual recovery note for an abnormal exit; do not promise crash cleanup.

## Acceptance

- [x] A finite timeout can be configured for the live adapter, and each accepted
      `set_state` postpones it without introducing handles, leases, or an expired
      controller state.
- [x] Timeout handling requests a complete actual neutral report through the
      existing neutral path, keeps the target connected, records a minimal
      diagnostic, and accepts later input.
- [x] One focused controlled-time/recording-target test verifies reset timing,
      the captured complete neutral report, and successful input after timeout;
      it does not test only flags or timer existence.
- [x] Available-host behavior checks and ordinary/non-Windows checks remain
      meaningful and independent of the Windows driver. The Windows execution
      check is deferred to the final handoff and lack of Windows access does not
      block implementation completion.
- [x] The operator note gives brief recovery guidance for an orphaned target
      after abnormal exit without adding a watchdog or automated recovery system.

## Verification and scope

Verify the controlled timeout behavior at the adapter seam and run applicable
available-host checks. Keep this slice limited to the live timeout and its
diagnostic; do not add stale-handle tests, lease state machines, flag-only timer
tests, general concurrency or lifecycle frameworks, or a cross-platform fake
controller backend. Unresolved compile or code-test failures remain real
blockers even though Windows runtime verification is deferred.

## Comments

- 2026-09-08: Implementation agent completed the inactivity-timeout slice and
  reported format, test, check, and Clippy passing. Orchestrator verification and
  code review are pending.
- 2026-09-08: Orchestrator reran all adapter tests and available-host checks.
  Independent Standards and Spec reviewers both approved the change with zero
  findings; Windows runtime execution remains deferred to the final handoff.
