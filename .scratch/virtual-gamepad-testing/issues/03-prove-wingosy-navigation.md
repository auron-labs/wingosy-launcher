# 03 — Prove virtual D-pad navigates Wingosy

Parent: Windows virtual gamepad testing proof-of-concept specification

Blocked by: 01 — Drive one system controller through a persistent adapter; 02 — Release unattended input without ending the controller session

Status: ready-for-agent

## What to build

Implement one opt-in WebdriverIO/Mocha native system test using the existing
readiness and navigation helpers and the existing single-instance E2E setting.
Choose two concrete, deterministic controls in a prepared Wingosy view: a known
initially focused control and a different known focus destination.

Start one adapter process for the test run, connect its ready target, navigate to
the prepared view, and send controller commands through the adapter rather than
injecting renderer events. Fail when the app, fixture, readiness condition, or
chosen controls are absent. Assert the initial visible focus, then send a
complete state with the selected D-pad direction pressed and use a bounded
observable wait to assert the visible focus transition. Send the corresponding
released/neutral state and assert the known post-release focus or state. Adapter
responses, status, last-sent state, rumble, and renderer-only events are not
application evidence.

Always attempt neutral and disconnect in teardown, including setup and assertion
failures. Report teardown failure separately without hiding the primary failure,
using existing diagnostics only. Keep this test explicitly selected so ordinary
suites do not acquire a ViGEmBus requirement.

## Acceptance

- [ ] The opt-in test is single-instance, starts the adapter once, connects a
      ready target, reuses existing readiness/navigation seams, and fails rather
      than silently succeeding when its app, fixture, controls, or readiness is
      absent.
- [ ] The test asserts the known initial focus, a visible focus move caused by a
      D-pad press after a bounded wait, and the expected released/neutral result
      for the selected controls. It does not substitute adapter acknowledgements
      or renderer injection for the visible proof.
- [ ] Setup and assertion failures still trigger neutral and disconnect cleanup;
      teardown failures are reported separately with minimal existing diagnostics.
- [ ] Implementation and meaningful available-host/static or existing-harness
      checks are complete. Windows execution is deferred to the final handoff;
      no Windows access is required to close this implementation ticket, while
      unresolved compile or code-test failures remain blockers.

## Final human handoff (not an implementation prerequisite)

After the implementation checks are complete, request this short ordered check
and record implementation completion separately from Windows runtime verification;
leave the latter pending until the run and do not claim a Windows pass before it:

1. Provision the deliberately verified signed archived driver and ensure no
   competing controllers are present, if that prerequisite is not already met.
2. Run the implemented adapter smoke and the selected opt-in Wingosy navigation
   test; do not ask the operator to duplicate either test manually.
3. Perform the residual manual RetroArch check: confirm it recognizes the
   virtual Xbox 360 controller and observe one visible press/release result via
   the adapter.

This handoff is the final ticket's human validation request, not a separate
human-only ticket and not a prerequisite for implementing or completing the
automated work. Do not add a cross-platform fake controller or a mocked
end-to-end claim to compensate for an unavailable Windows host.
