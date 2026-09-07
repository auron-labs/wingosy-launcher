# Windows virtual gamepad testing proof of concept

Status: ready-for-agent

## Problem Statement

Wingosy can currently test controller-to-keyboard behavior inside its renderer, but those tests do not prove that Windows, Wingosy, or a separately launched RetroArch process can discover and respond to a controller. Keyboard, browser-event, and in-process gamepad simulation bypass the system controller boundary that a real player uses.

The project needs a small, deterministic proof of concept that can create a system-wide Xbox 360 controller on a dedicated Windows 10/11 test machine, drive it from automation, and clean it up reliably. The proof must fit the existing Rust and WebdriverIO tooling without making an archived virtual-controller driver part of Wingosy's normal application runtime.

## Solution

Build a standalone, Windows-only Rust adapter that uses ViGEmBus through the `vigem-rust` crate to create and control one virtual Xbox 360 controller. Give the adapter a small machine-readable command interface that deterministic E2E tests can invoke directly.

The adapter will accept complete controller states, validate them, send them to the virtual target, expose connection status, and provide explicit neutral and disconnect operations. It will also enforce a bounded dead-man lease so an abandoned test cannot leave buttons pressed. Controller creation and updates will be serialized, and only one controller will be supported during the proof of concept.

Add one focused native WebdriverIO/Mocha E2E path that uses the adapter and asserts an observable Wingosy or RetroArch outcome. Adapter acknowledgements, last-sent state, and rumble notifications may be retained as diagnostics, but they are not evidence that the application consumed an input.

The adapter is the single testing seam. E2E will call it directly; a future MCP facade may translate tool calls to the same interface without taking ownership of driver handles or controller semantics.

## User Stories

1. As a Wingosy maintainer, I want automation to create a system-wide Xbox 360 controller, so that I can test the same Windows controller-discovery path used by a real controller.
2. As a Wingosy maintainer, I want RetroArch to see the virtual controller as a separate process, so that the test covers the process boundary rather than only Wingosy's renderer.
3. As an E2E test author, I want to control the virtual gamepad through a small machine-readable adapter, so that tests do not need to understand ViGEmBus internals.
4. As an E2E test author, I want to send a complete controller state, so that every update has deterministic button, D-pad, stick, and trigger values.
5. As an E2E test author, I want invalid axis and trigger values rejected, so that malformed test input cannot silently produce an unintended controller report.
6. As an E2E test author, I want an explicit neutral operation, so that I can release every button and recenter every analog control between actions.
7. As an E2E test author, I want neutral to be idempotent, so that unconditional cleanup is safe after both successful and failed tests.
8. As an E2E test author, I want an explicit disconnect operation, so that a test can remove its virtual target before exiting.
9. As an E2E test author, I want disconnect to neutralize the controller first, so that removal cannot leave a logically held input in the test flow.
10. As an E2E test author, I want the adapter to report when ViGEmBus is missing, incompatible, inaccessible, or not ready, so that infrastructure failures are distinguishable from application failures.
11. As an E2E test author, I want controller creation to return an opaque handle, so that subsequent commands act on an explicitly identified controller lease.
12. As an E2E test author, I want stale or disconnected handles rejected, so that commands cannot appear to succeed against a controller that no longer exists.
13. As a test-machine operator, I want a bounded dead-man timeout, so that a crashed or abandoned test automatically releases all controls.
14. As a test-machine operator, I want accepted state updates to renew the controller lease, so that an active test can continue without accidental neutralization.
15. As a test-machine operator, I want lease expiry reflected in status, so that failures caused by automatic cleanup can be diagnosed.
16. As a test-machine operator, I want one controller at a time during the proof of concept, so that physical-device ordering and player-slot allocation are not hidden behind speculative multi-controller behavior.
17. As a test-machine operator, I want controller operations serialized, so that concurrent updates cannot race or corrupt the state sent to ViGEmBus.
18. As a CI maintainer, I want the adapter to run only on a deliberately provisioned Windows 10/11 machine with ViGEmBus already installed, so that tests do not install a kernel driver dynamically.
19. As a CI maintainer, I want the test to fail clearly when an unexpected competing controller or slot condition prevents deterministic execution, so that a misleading pass is not recorded.
20. As a CI maintainer, I want cleanup to run even after assertion failures, so that a reused runner remains safe for the next job.
21. As a developer running ordinary tests, I want virtual-controller tests to remain opt-in, so that normal Rust and Vitest checks stay fast and do not require Windows or ViGEmBus.
22. As a developer on a non-Windows host, I want the rest of Wingosy's checks to build without the virtual-controller adapter, so that the proof of concept does not break cross-host development workflows.
23. As a reviewer, I want the `vigem-rust` dependency isolated to the adapter and Windows target, so that it does not become an accidental runtime dependency of the Wingosy application.
24. As a reviewer, I want adapter logs to include timestamps, requested complete state, connection state, lease expiry, and teardown result, so that controller-side behavior can explain an E2E failure.
25. As a reviewer, I want the E2E assertion to inspect visible application behavior, so that an accepted controller report is not mistaken for proof that Wingosy or RetroArch consumed it.
26. As a reviewer, I want screenshots or equivalent app/window diagnostics captured on failure through the existing E2E facilities, so that controller, focus, and launch failures can be separated.
27. As a future MCP integrator, I want the adapter's controller semantics independent of MCP transport, so that LLM tooling can reuse the tested behavior without duplicating driver logic.
28. As a future MCP integrator, I want explicit handles and structured errors, so that tools do not depend on implicit connection state.
29. As a project maintainer, I want the archived ViGEmBus dependency and former updater-domain risk documented, so that a successful proof of concept is not mistaken for unconditional long-term approval.
30. As a project maintainer, I want promotion beyond the proof of concept to require a replacement and risk review, so that long-term test infrastructure does not silently depend on retired driver software.

## Implementation Decisions

- The proof of concept will target Windows 10/11 and emulate one wired Xbox 360 controller through ViGEmBus. DualShock 4 support and generic joystick identities are not needed.
- The virtual controller will be owned by a standalone Rust adapter, not by Wingosy's Tauri application process. This keeps test-only driver behavior out of the shipped application runtime and gives E2E and future MCP integrations one reusable boundary.
- The adapter will use `vigem-rust` 0.2 with only the Xbox 360 capability and serialization support needed by its command contract. The repository's pinned Rust toolchain satisfies the crate's minimum Rust version.
- The dependency will be Windows-targeted. Non-Windows builds and ordinary Wingosy tests must not require ViGEmBus or attempt to emulate a replacement controller.
- The adapter will expose a small machine-readable command interface suitable for direct invocation by WebdriverIO. The implementation should use the simplest existing repository-compatible process and serialization conventions; it does not need a network service.
- The command contract will provide create/connect, set complete state, neutral/release-all, status, and disconnect operations.
- Create/connect will connect to ViGEmBus, create one Xbox 360 target, wait for readiness, and return an opaque handle plus structured target and connection status. A second simultaneous controller request will fail explicitly.
- Set complete state will replace the entire Xbox 360 report. Its input will represent button booleans, D-pad direction, both stick axes, and both triggers. Stick axes will be validated in `[-1, 1]`, and triggers in `[0, 1]`, before conversion to the native report ranges.
- Every accepted state update will renew a bounded dead-man lease. Lease expiry will send a complete neutral report and mark the handle expired. The timeout will be configurable for tests but will have a safe finite default.
- Neutral will send a complete all-released report and will be safe to call repeatedly.
- Disconnect will neutralize first, explicitly unplug the target, release the client, and invalidate the handle. Cleanup must not rely solely on process drop behavior because driver calls can block or fail.
- Status will report connected, disconnected, or expired state; the opaque handle; Xbox 360 target kind; lease state; and structured adapter or driver errors. Last-sent state and host feedback may be included only as diagnostics.
- Adapter commands and target updates will be serialized. The proof of concept will not expose concurrent control over one target.
- Driver errors such as bus missing, version mismatch, access denied, target not ready, exhausted serials, and unavailable slots will remain distinguishable in structured results rather than being flattened into a generic failure.
- The E2E harness will invoke the adapter directly and use existing WebdriverIO readiness, navigation, and failure-diagnostic patterns. It will not route controller commands through Tauri commands or renderer JavaScript.
- The focused system test will send explicit press and release states, with neutral state between independent actions where needed. Readiness will be determined through observable conditions and bounded waits rather than fixed sleeps alone.
- The E2E assertion must observe a visible Wingosy or RetroArch result. Adapter acceptance, target connection, last-sent state, and rumble callbacks are diagnostics and cannot satisfy the behavioral assertion by themselves.
- Test and suite teardown will always attempt neutral and disconnect, including after setup errors or assertion failures. A runner-level recovery procedure will handle an adapter crash or abandoned virtual target before the next job.
- ViGEmBus will be pre-provisioned on a dedicated Windows 10/11 runner or image. Tests will not download, install, upgrade, or configure the kernel driver.
- Provisioning guidance will identify a verified production-signed archived release and the ViGEm end-of-life updater-domain warning. It will not direct operators to install software from the retired `vigem.org` domain.
- The proof will run without a competing physical controller. Unexpected controller/slot state will produce a clear infrastructure failure instead of silently selecting a different device.
- The crate and driver are accepted only for this isolated proof of concept. Moving the adapter into regular CI or treating ViGEm as durable infrastructure requires an explicit maintenance, security, and replacement review.

## Testing Decisions

- The primary seam is the standalone adapter controlling a real ViGEmBus target. Tests should exercise the adapter contract and the externally observable system behavior, not its internal conversion functions in isolation unless those functions carry meaningful validation risk.
- Add focused Rust tests for complete-state validation and conversion boundaries, including accepted endpoint values and rejected out-of-range axes and triggers.
- Add focused Rust tests for controller lease state transitions and dead-man behavior using time/control seams that do not require the driver. Verify renewal, expiry-to-neutral intent, stale-handle rejection, idempotent neutral, and handle invalidation after disconnect.
- Keep driver-dependent adapter tests opt-in and Windows-only. A compatibility smoke test should create one real Xbox 360 target, wait until ready, send an A press and release, send a D-pad press and release, neutralize, and disconnect.
- Add one focused WebdriverIO/Mocha system test using the existing native Tauri E2E harness. It should invoke the adapter directly, reach the permitted Wingosy/RetroArch flow, send controller state, and assert one visible state change caused by that input.
- Use the existing E2E helper conventions for app readiness and navigation, and preserve the harness's single-instance execution model.
- Put adapter cleanup in unconditional suite/test teardown. A failed behavioral assertion must still attempt neutralization and disconnection and must report teardown failure separately.
- Preserve screenshots, visible app/window state, and adapter logs when the system assertion fails. These artifacts are diagnostics for controller discovery, focus, timing, and launch-boundary failures.
- Existing Vitest controller-mapping tests remain renderer coverage. They should continue to run unchanged and must not be relabeled as system-controller certification.
- Ordinary Rust tests, Vitest, and existing E2E suites must continue to run without a ViGEmBus installation unless the virtual-controller system test is explicitly selected.
- Human smoke testing is limited to running the adapter compatibility smoke test on the provisioned Windows machine, confirming RetroArch identifies the virtual Xbox 360 controller, and confirming the selected press/release action produces the expected visible result.

## Out of Scope

- Installing, compiling, signing, updating, or distributing ViGEmBus.
- Making ViGEmBus or `vigem-rust` part of the shipped Wingosy application runtime.
- Supporting Windows Server, Linux `uinput`, macOS virtual controllers, vJoy, SDL virtual joysticks, or a custom Windows Virtual HID Framework driver.
- Supporting DualShock 4 targets or controller identities other than one Xbox 360 target.
- Multiple simultaneous virtual controllers, player-slot assignment, controller hot-plug orchestration, or parallel system-controller tests.
- Accepting partial state deltas, event scripts, macros, recording, playback, or timing choreography inside the adapter.
- Proving compatibility with every emulator, core, game, anti-cheat system, or physical-controller configuration.
- Using rumble, LED notifications, adapter acknowledgements, or last-sent state as evidence that an application consumed input.
- Replacing existing Vitest, Rust, or WebdriverIO test coverage.
- Building the MCP facade in this proof of concept. The adapter contract should remain reusable by that later integration.
- Promoting the archived ViGEm stack to permanent CI infrastructure without a separate risk and replacement decision.

## Further Notes

- ViGEmBus and the official ViGEmClient were retired and archived in 2023. Their end-of-life notice warns that old updater configurations may contact the former `vigem.org` domain. The runner image must use a deliberately verified signed release and must disable or remediate stale updater behavior.
- `vigem-rust` is a young crate despite its useful high-level lifecycle and structured errors. At the time of selection, version 0.2 had one owner and limited adoption. Keep its use behind the adapter boundary so replacing it does not change E2E or future MCP controller semantics.
- ViGEmBus supports Windows 10/11 but does not support Windows Server. The exact runner image must prove installation, device enumeration, target readiness, cleanup, and reuse before the E2E result is considered repeatable.
- Focus and device-enumeration latency are expected sources of failure. Prefer observable readiness with bounded waits and retain both adapter and application diagnostics.
- The approved testing seam is the standalone adapter: deterministic E2E invokes it directly, while a later MCP facade may translate validated tool calls to the same operations.
- The supporting comparison and source research is recorded alongside this specification in the virtual-gamepad-testing research note.
