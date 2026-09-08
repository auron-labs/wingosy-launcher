# Windows virtual gamepad testing proof of concept

Status: ready-for-agent

## Problem statement

Wingosy's renderer tests can exercise controller mapping, but keyboard events and in-process gamepad simulation do not prove that Windows and Wingosy consume a real system controller. This proof of concept adds only the smallest test seam needed to cross that boundary on a provisioned Windows machine. It is not a claim that a separately launched RetroArch process has been certified by automation.

## Accepted solution

Build a small standalone, Windows-only Rust adapter using `vigem-rust` 0.2 to create and control exactly one virtual Xbox 360 controller. Keep the adapter and its ViGEmBus dependency outside Wingosy's shipped runtime. The adapter is test-owned: a deterministic E2E test or an autonomous agent starts one persistent process for its run, and that process owns the one controller for its entire lifespan.

Use a simple sequential, machine-readable process interface, with newline-delimited JSON over stdin/stdout as the reversible default. The process is not a network service. Callers send one command, consume its response, and then send the next command; they do not need to start a fresh process for every state. The command interface is available to E2E and autonomous callers now. An MCP facade is deliberately later work and must not introduce handles, ownership rules, or another driver abstraction in this proof of concept.

The adapter accepts complete normalized controller states, validates them, sends them to the target, reports connection/readiness status, and supports explicit neutral and disconnect cleanup. It reuses the crate's target/client lifecycle and errors rather than wrapping them in a new driver or concurrency framework.

## User stories

1. As a test author, I can start one Windows-only adapter process, connect one X360 target, and issue sequential machine-readable commands for all states needed by a run.
2. As a test author, I can send a complete state containing button booleans, D-pad direction, both normalized stick axes, and both normalized triggers, with invalid values rejected before a driver report is sent.
3. As a test author, I can explicitly send an all-neutral state and disconnect; both operations are safe to request during unconditional cleanup.
4. As a test-machine operator, I get a finite configurable inactivity timeout. Accepted complete state updates renew it; when it fires while the adapter is alive, the adapter requests an actual neutral report and remains connected and usable for later input. Status may retain the last-timeout diagnostic, but there is no expired lease state.
5. As a test author, I get clear command failures containing the actual adapter or `vigem-rust` lifecycle/driver error and enough command context to distinguish setup, input, readiness, and cleanup failures without an invented exhaustive error taxonomy.
6. As a CI maintainer, the virtual-controller path is opt-in, Windows-only, single-controller, and single-instance, while ordinary Rust, Vitest, non-Windows, and existing E2E workflows remain independent of ViGEmBus.
7. As a reviewer, I can see that the archived signed driver risk is isolated to this test-only proof of concept and that promotion requires a separate replacement and risk review.

## Implementation decisions

- Target Windows 10/11 only. Emulate one wired Xbox 360 controller through ViGEmBus; do not add DualShock 4, generic joystick, or another virtual-controller backend.
- Put the adapter in a small standalone Rust binary/process, not in Wingosy's Tauri application process. Make `vigem-rust` 0.2 a Windows-targeted dependency that cannot become part of the shipped application runtime.
- The process contract is sequential newline-delimited JSON over stdio. The initial commands are:
  - `connect`: connect to ViGEmBus, create one X360 target, wait for target readiness, and report the resulting connection status;
  - `set_state`: replace the entire report with a complete normalized state;
  - `neutral`: send the complete all-released/recentered report;
  - `status`: report connection and readiness plus the optional last-timeout diagnostic;
  - `disconnect`: best-effort neutralize, unplug the target, and release the client.
- The single process has one implicit controller context. Do not return, accept, renew, expire, invalidate, or test opaque handles or leases. A second controller is outside the process contract; provisioning and the one-process test setup provide the single-controller prerequisite.
- `set_state` contains button booleans, one D-pad direction, left/right stick axes in `[-1, 1]`, and triggers in `[0, 1]`. Convert only after validation, including endpoint values, to the native X360 report ranges.
- Use the simplest lifecycle/control serialization available through the adapter's sequential command loop and existing crate APIs. Do not add a general concurrency framework or a driver abstraction that duplicates `vigem-rust`.
- Configure a safe finite inactivity timeout, with a test-configurable value. The timer exists only while the adapter process is alive. Each accepted `set_state` resets it. On timeout, invoke the same actual neutral-report path used by the `neutral` command, retain a minimal diagnostic, and leave the target connected so a later `set_state` can be accepted. Do not claim that the timer protects against an adapter crash or process death.
- `neutral` and `disconnect` are best-effort cleanup operations. `disconnect` must attempt unplug/release even when its preceding neutral request fails, and must surface both relevant errors. EOF is normal process cleanup: attempt neutral, then unplug/release, without assuming that process drop alone is sufficient. Any process-death cleanup behavior is an actual Windows compatibility question to verify, not a reason to add a speculative watchdog.
- Preserve useful errors from the crate and driver, including readiness or connection failures, rather than adding a new exhaustive classification layer. Status is diagnostic only and is not proof that Wingosy consumed input.

## Provisioning and operator prerequisites

- Provision a dedicated Windows 10/11 test machine manually with a deliberately verified, production-signed archived ViGEmBus release. Do not download, install, update, or configure the kernel driver from the test or shipped application.
- ViGEmBus and the official ViGEmClient are archived/retired. The known end-of-life risk is stale updater configuration contacting the former `vigem.org` domain; disable or remediate that behavior and do not direct operators to that retired domain.
- Before a run, the operator ensures no competing physical or virtual controller will make device/slot selection ambiguous and confirms that ViGEmBus can create a ready target. This is a manual prerequisite, not automated enumeration or slot policing.
- If an abnormal exit leaves an orphaned virtual target, the operator stops any remaining adapter, removes/disconnects the stale target with the existing Windows/driver controls or reboots the test machine, and retries only after a fresh `connect` reports ready. This is simple operator recovery, not an automated recovery subsystem.
- The proof does not require reimaging, exact-image certification, Windows Server support, or a project to automate device enumeration and recovery.

## First automated visible proof

Add one focused, opt-in WebdriverIO/Mocha system test using the existing native Tauri E2E harness. Reuse setup/navigation helpers, not pass-regardless assertions or silent-success skips from existing E2E tests. Reuse `e2e-webdriver/helpers.js` for readiness and navigation and retain `wdio.conf.js` with `maxInstances: 1`.

The implementation must select two concrete existing Wingosy controls in a deterministic prepared view: a known initially focused control and a different known focus destination. The test must:

1. start the adapter process once for the test run, connect the ready target, navigate to the prepared Wingosy view, and fail if the app, fixture, controls, or readiness condition is absent;
2. assert that the known starting control is focused before input;
3. send a complete state with the chosen D-pad direction pressed and assert, after a bounded observable wait, that focus visibly moves to the known destination; and
4. send the corresponding released/neutral state and assert the known post-release focus/state.

The assertion is the visible Wingosy focus transition caused by the system controller press/release. Adapter responses, connection status, last-sent state, rumble, or a renderer-only event cannot satisfy it. The test does not separately launch RetroArch. This proves Wingosy consumes the system controller; it does not prove a separately launched RetroArch process discovers or consumes it.

Always attempt neutral and disconnect in test/suite teardown, including setup and assertion failures. Report teardown failure separately without hiding the primary assertion failure. The virtual-controller WDIO path must remain explicitly selected; it must not add a ViGEmBus requirement to ordinary suites.

## Validation

- Add focused Rust tests at the validation/conversion boundary: complete-state acceptance at normalized endpoints, rejection of out-of-range axes/triggers, and the command behavior that produces the native report. Do not add redundant constant/getter/serde/crate-implementation tests.
- Add one minimal timeout test seam that advances or controls time, verifies an accepted `set_state` postpones the timeout, then invokes the same timeout command behavior and captures the actual requested neutral report from a recording target. In that same seam, send a subsequent input and verify it is accepted after neutralization. Assert the captured report is complete neutral; do not assert only an expired flag or a neutral intent. Do not add stale-handle tests or a mock lifecycle framework.
- Keep the real driver smoke opt-in and Windows-only. It complements, rather than duplicates, the visible E2E test: create/connect a ready X360 target, send an A press and release, send a D-pad press and release, send neutral, and disconnect.
- Keep the visible E2E proof focused on the concrete Wingosy focus transition and existing readiness/navigation seams. Existing Vitest controller-mapping coverage remains unchanged and is not system-controller certification.
- Reuse existing diagnostics only. `wdio`'s `afterTest` currently logs failures; do not claim that global screenshot capture already exists. If a lightweight existing screenshot API is useful at the failure point, it may be used, but no diagnostics framework, desktop screenshot-analysis tooling, or mandatory exhaustive state logging is required.
- Human checks are limited to necessary driver/machine provisioning and the residual manual RetroArch compatibility check: confirm RetroArch discovers the virtual Xbox 360 controller and that one visible press/release result occurs. Do not require a person to repeat the automated adapter smoke or Wingosy E2E test.
- If process-death cleanup is to be relied upon later, verify it on the actual Windows environment before documenting a guarantee. This proof of concept makes no watchdog or crash-cleanup claim.

## Out of scope

- Opaque controller handles; lease-expiry/invalidation state machines or stale-handle tests. The finite inactivity timeout is in scope and is not a lease.
- A network service, MCP facade in this stage, or future MCP-specific ownership/handle requirements.
- Multiple controllers, slot assignment/policing, competing-device enumeration, controller hot-plug orchestration, or parallel system-controller tests.
- Installing, compiling, signing, updating, distributing, or bundling ViGEmBus; making ViGEmBus or `vigem-rust` part of the shipped Wingosy runtime.
- Partial state deltas, event scripts, macros, recording, playback, timing choreography, rumble/LED features, or using adapter acknowledgements as application evidence.
- Automated runner reimage/recovery, exact-image certification, speculative process watchdogs, or a new concurrency/driver abstraction.
- Autonomous RetroArch certification, claims covering every emulator/core/game/device configuration, or desktop screenshot analysis.
- Replacing existing Rust, Vitest, or WebdriverIO coverage, or promoting the archived ViGEm stack to permanent CI without an explicit replacement and risk decision.

## Further notes and research boundary

- `vigem-rust` 0.2 is a young dependency with limited adoption. Keep it behind this adapter boundary so a future replacement does not change the E2E command semantics.
- ViGEmBus supports Windows 10/11 but not Windows Server. Readiness, cleanup, reuse, and any process-death behavior must be established by actual Windows checks rather than inferred from a host-independent test.
- Focus and device-readiness latency are likely failure sources. Use observable readiness and bounded waits, and retain only the minimal adapter/application diagnostics needed to explain a failure.
- Supporting comparison and source research remains in `.scratch/virtual-gamepad-testing/research.md`. This latest narrowed specification governs implementation; older research or discussion recommending opaque handles, lease state machines, automated recovery, or autonomous RetroArch certification is superseded.
