# Virtual gamepads for LLM/MCP testing and deterministic E2E

**Research date:** 2026-08-31<br>
**Scope:** Wingosy on Windows 10/11; Tauri 2/Rust backend; Bun/Vitest; native
WebdriverIO/Mocha E2E through `tauri-driver` and Edge. This is a research note,
not an implementation or dependency decision.

## Conclusion for Wingosy

**Recommendation:** for a minimal Windows proof of concept, use an Xbox 360
virtual target through [ViGEmBus][vigembus], driven by a small standalone
adapter. Call that same adapter directly from deterministic E2E and expose a
thin MCP facade for LLM use. Keep the MCP transport separate from the adapter.

**Verified fact:** [ViGEmBus][vigembus] was archived on 2023-11-02 and
[ViGEmClient][vigemclient] on 2023-09-08; both projects are retired. The
[end-of-life notice][vigem-eol] says there will be no future updates and warns
that old updater configurations can contact the former `vigem.org` domain,
potentially leaking a public IP address.

**Recommendation:** treat them as a pragmatic fit for an isolated POC/test
machine, not a comfortable long-term platform dependency. Any POC must use a
deliberately provisioned image, verify the signed release and updater state, and
record this maintenance/security risk before promotion.

This recommendation is narrower than “support virtual controllers” generally:
it targets the real XInput/controller-discovery path used by a separately
launched RetroArch process. It does **not** recommend adding a Rust crate,
Python helper, kernel-driver build, or MCP package to Wingosy now.

## What is actually being tested

There are three different mechanisms that are easy to conflate:

1. **System-wide virtual controller:** a driver or OS input device is visible
   to other processes. ViGEmBus creates a kernel-level Xbox 360 or DS4 device;
   Linux `uinput` creates a device consumed by userspace and in-kernel
   consumers. This is the only category that validates the actual controller
   discovery, XInput/HID mapping, and launch boundary for a separately launched
   game or emulator.
2. **In-process virtual joystick:** the test process or application exposes a
   joystick only through its own input API. SDL3's
   [`SDL_AttachVirtualJoystick`][sdl-virtual] makes a program-supplied device
   look like an SDL joystick to that SDL application; it is not an OS-wide
   controller for another process. Apple's `GCVirtualController` is likewise
   documented as a software controller configured for *your game*.
3. **Keyboard/mouse injection:** synthetic key, pointer, or browser events
   exercise focus and keyboard handlers, but do not enumerate as a controller
   and cannot validate an emulator's XInput/HID mapping. Wingosy's current
   [Gamepad-to-keyboard mapper][mapper] deliberately translates browser
   Gamepad API input into keyboard events, and its [closest tests][mapper-tests]
   assert those events. That is useful renderer coverage, not proof that a
   separately launched RetroArch process saw a controller.

The repository's native E2E harness already runs the full Tauri app with its
Rust backend through WebDriver, using Edge and `tauri-driver` ([testing
guide][testing] and [WDIO config][wdio]). The adapter should supplement that
harness at the system-device boundary, not replace Vitest or the existing E2E
stack.

## Comparison matrix

“System-wide” means another process can discover the device. “In-process” means
the target application must use that same API. Maintenance and license notes
are based on the linked primary source or are explicitly recommendations.

| Option | Device visibility / scope | Controller fidelity | Code API / bindings | Install, admin, and driver burden | CI / headless practicality | Maintenance / license | Fit for this repo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **ViGEmBus + ViGEmClient** | **System-wide Windows** kernel virtual device; games and other processes need no proxy DLL or API hook to detect it. | **High for an Xbox 360/XInput target**; also DS4. Good match for RetroArch's Windows XInput path. | Official C/C++ feeder SDK; MIT. Small API for connect, target creation, state updates, and rumble/LED callbacks. Rust and Python options are listed below. | Prebuilt production-signed Windows 10/11 binaries exist, but this is still a kernel driver and installer/admin/signing boundary. Pre-provision; do not install per test. | **Good after image provisioning** on a dedicated Windows runner; Windows-only and sensitive to device/slot state. | ViGEmBus BSD-3-Clause; ViGEmClient MIT. Both archived/retired in 2023; no future updates and updater-domain security warning. | **Best minimal POC.** Use only with explicit POC/test-machine risk acceptance and a replacement review later. |
| **vJoy** | **System-wide Windows** generic virtual joystick. | Generic HID joystick, not a turnkey Xbox/XInput identity; weaker match for XInput-oriented tests. | Native vJoy SDK/interface; binding choice would be separate. Less direct than the ViGEm X360 report model for this test. | Kernel driver and installer/signing surface. The referenced fork documents an old Visual Studio/Windows SDK/WDK/Inno Setup build stack and driver-signing requirements. | Possible on a provisioned Windows runner, but the old build/signing chain makes reproducibility and upkeep less attractive. | Referenced fork is MIT; maintenance/build age is a concern. | Comparison fallback only; **not recommended** for the first RetroArch/XInput proof. |
| **Windows Virtual HID Framework (VHF)** | **System-wide Windows HID** device tree, if a custom source driver is written. Windows 10+ framework; not a ready-made gamepad. | Whatever HID descriptor and reports the project authors; no turnkey XInput fidelity. | Kernel-mode WDM/KMDF source driver using WDK `Vhf.h`/`vhfkm.lib`, HID descriptors, callbacks, INF. | **High:** kernel-mode-only, WDK/KMDF/WDM, descriptor design, INF installation, signing, and driver lifecycle. | Technically automatable, but driver build/sign/install and reboot/device cleanup are poor minimal-test ergonomics. | Microsoft platform facility; the project would own the custom driver’s maintenance/security surface and licensing decisions. | Potential long-term ownership route if a custom identity is essential; **too expensive for this POC**. |
| **Linux `uinput`** | **System-wide Linux** userspace-created input device through `/dev/uinput`, delivered to userspace and in-kernel consumers. | Linux evdev/gamepad conventions; fidelity depends on emitted capabilities and the consumer, not Windows XInput. | Linux `uinput.h` ioctls; kernel docs recommend considering `libevdev`; Rust/Python libraries are optional wrappers. | No custom kernel-driver build, but the `uinput` kernel module, `/dev/uinput` access, and device permissions/rules must be provisioned. | **Good on Linux headless CI** when the device is available and permissions are configured. Not evidence for Wingosy's Windows runtime. | Kernel interface plus wrapper-specific licenses/maintenance; no new wrapper is selected here. | Useful cross-platform comparison and possible Linux test seam; **not the Windows proof**. |
| **SDL3 virtual joystick** | **In-process SDL only.** The attached joystick exists in the SDL application and accepts program-supplied input. | SDL joystick API fidelity, not OS/XInput fidelity for another process. | Maintained SDL3 C API: attach, set virtual axes/buttons, detach. | No kernel driver or admin install for the virtual device. Requires the app under test to use SDL3. | **Excellent** for an SDL application’s headless tests. It cannot drive Wingosy-launched RetroArch as a separate OS process. | SDL project/API and its applicable license; no driver maintenance. | Good only if the code under test owns an SDL input loop; **not a Wingosy/RetroArch controller boundary**. |
| **macOS `GCVirtualController` / DriverKit** | `GCVirtualController` is **in-process/game-specific**. System-level HID requires a DriverKit system extension/driver. | GameController API fidelity in the app; DriverKit can represent custom HID if fully implemented. | GameController Swift/Objective-C API for the virtual controller; DriverKit APIs for a system extension. | In-process route is light; system route has system-extension, signing, approval, and product/driver burden. | In-process tests are practical; system-level headless CI is comparatively difficult and not relevant to Windows evidence. | Apple SDK/platform terms; a DriverKit product becomes project-owned maintenance/security work. | Comparison only; no macOS implementation or cross-platform plan is proposed. |

## Binding and adapter decision

These are practical bindings to investigate, **not a recommendation to add a new
repository dependency yet**:

- **Official ViGEmClient C/C++:** the [feeder SDK][vigemclient] is MIT and is
  the reference API for connecting to ViGEmBus, adding an Xbox 360 target,
  sending X360 reports, and receiving rumble/LED notifications. It is not
  thread-safe, so a small adapter should serialize access.
- **Pure-Rust `vigem-client`:** [CasualX/vigem-client][rust-vigem] is MIT and
  talks directly to ViGEmBus without the C client. It is very small (the source
  currently shows six commits and low activity), so evaluate its Windows
  compatibility and maintenance before choosing it for a durable adapter.
- **Python `vgamepad`:** [vgamepad][vgamepad] is MIT and convenient for a spike;
  its Windows X360/DS4 path is documented as stable and it exposes bounded
  triggers/sticks, reset, update, and callbacks. It installs ViGEmBus through
  its Windows installer flow. It conflicts with this repository's preference
  not to add Python helpers, so it should remain an external experiment rather
  than a Wingosy dependency.
- **Linux uinput libraries:** use the kernel interface directly or an optional
  wrapper such as the kernel documentation's `libevdev` suggestion. This is a
  comparison option, not part of the Windows POC.

The adapter boundary should be small and shared by E2E and MCP:

| Operation | Required behavior |
| --- | --- |
| `create/connect` | Create one Xbox 360 target, connect it, and return an opaque handle plus device/status information. Initially allow **one controller at a time**. |
| `set complete state` | Replace the whole report, not a partial delta: button booleans, D-pad, axes, and triggers. Validate axes in `[-1, 1]` and triggers in `[0, 1]` at the boundary; reject invalid values rather than silently sending an unsafe state. |
| `neutral/release-all` | Send a complete neutral report (all buttons up, axes centered, triggers zero), and make it safe to call repeatedly. |
| `disconnect` | Neutralize first, remove the target, close the client, and invalidate the handle. |
| `status` | Report connected/disconnected, handle, target kind, lease/dead-man state, and adapter/driver errors. Report last-sent state only as diagnostics. |

Every lease must have a bounded dead-man timeout: each accepted state update
renews the lease; expiry sends neutral/release-all and marks the handle
expired. E2E and MCP teardown should still explicitly neutralize and disconnect.
This protects a test machine when a browser, model, adapter process, or network
client disappears. The one-controller limit avoids inventing player-slot
allocation before the first path is deterministic.

The MCP layer should translate validated tool calls to those operations, not own
driver handles or device semantics. MCP tools have declared input schemas and
can return structured results ([MCP tools specification][mcp-tools]); a
stateful facade should return an explicit opaque controller handle from
`create/connect` and require it on later calls rather than relying on an
implicit MCP connection. A thin initial tool set could be `gamepad.create`,
`gamepad.set_state`, `gamepad.neutral`, `gamepad.status`, and
`gamepad.disconnect`, with deterministic ordering, bounded timeouts, and
human-visible confirmation/ownership appropriate to a tool that moves input.

## Evidence and assertions

The adapter can prove that it accepted and attempted to send a report and that
the driver target is connected. It cannot prove that a game consumed the input.
**Last-sent controller state and rumble callbacks are not proof that the game
acted.** Rumble is an output callback from the target path, not an assertion
that a particular A press or D-pad action changed game state.

Use observable application evidence for the assertion:

- WebDriver assertions against a visible RetroArch/Wingosy state change;
- screenshots and app/window state at the action boundary and on failure; and
- a known return/exit state after the emulator closes.

Keep adapter logs beside those artifacts with timestamps, requested complete
state, connection status, lease expiry, and teardown result. Treat them as
diagnostics that explain a failed assertion, not as a substitute for it. This
matches the repository's existing rule that command construction, mocked flows,
and download checks are not Windows runtime certification ([certification
ledger][ledger]).

## Bare-minimum POC and CI strategy

1. Pre-provision a dedicated Windows 10/11 runner or image with the chosen
   production-signed ViGEmBus release. Verify the archived-driver/updater
   warning and disable or repair stale updater behavior according to the
   [end-of-life guidance][vigem-eol]. Do **not** install a kernel driver
   dynamically in each test.
2. Ensure the runner has no competing physical controller, then have the
   standalone adapter create one virtual X360 device and expose `status`.
3. Send complete reports for A press/release and D-pad press/release, with a
   neutral report between actions where appropriate. Confirm the device and
   mapping in RetroArch, then run the same path through Wingosy.
4. Add one focused WebdriverIO/Mocha case that invokes the adapter directly,
   launches or reaches the permitted RetroArch flow, and asserts a visible
   Wingosy/RetroArch result. Keep existing Vitest tests for renderer/mapping
   behavior; do not relabel them as system-controller certification.
5. Put `neutral/release-all` and `disconnect` in unconditional teardown
   (`finally`/suite teardown), including after assertion failure. Preserve a
   runner recovery step for an adapter crash or abandoned device before the
   next job.

This gives LLM-driven MCP runs and deterministic E2E the same command/state
semantics while keeping transport, timing, screenshots, and WebDriver concerns
outside the device adapter.

## Risks and unknowns

- **Retirement and security:** ViGEmBus/Client have no future upstream updates;
  old updater components and the former update domain need explicit mitigation.
- **Support boundary:** ViGEmBus documents Windows 10/11 support for version
  1.17+ and explicitly says Windows Server is unsupported.
- **Driver lifecycle:** installation, administrator approval, code signing,
  architecture, reboot/device enumeration, and stale-device cleanup need to be
  proven on the exact runner image.
- **XInput slots:** physical controllers and device arrival order can make the
  XInput slot nondeterministic. Use a dedicated runner, inspect the connected
  device, and fail if the expected target is not the sole input device.
- **Consumer policy:** games or anti-cheat systems may reject virtual devices;
  a passing adapter test does not establish universal game compatibility.
- **Focus and timing:** emulator windows may not be focused when a report is
  sent, and launch/device enumeration has latency. Use observable readiness and
  bounded condition-based waits, not only fixed sleeps.
- **Crash cleanup:** a lost adapter or test process can leave a connected or
  held target. The lease neutralizer, unconditional teardown, and a runner
  reset/reimage path are required before parallel or reused jobs.
- **VHF cost:** VHF is a viable ownership path but requires a kernel-mode HID
  source driver, descriptor/report design, INF installation, signing, and a
  long-term security owner. It is not minimal test tooling.

## Sources

The following are primary sources used for the **Verified fact** statements
above; **Recommendation** sections and fit/POC choices are Wingosy-specific
conclusions from those facts.

- [ViGEmBus README][vigembus] — archived 2023-11-02; Windows kernel driver;
  Xbox 360/DS4 emulation; Windows 10/11 from 1.17; production-signed binaries;
  BSD-3-Clause; test/replay use case; Windows Server unsupported.
- [ViGEmClient README][vigemclient] — archived 2023-09-08; C/C++ feeder SDK;
  X360 state updates; rumble/LED callbacks; not thread-safe; MIT.
- [ViGEm end-of-life statement][vigem-eol] — no future updates and updater /
  former-domain security warning plus mitigation guidance.
- [CasualX/vigem-client][rust-vigem] — pure-Rust Windows client requiring
  ViGEmBus; MIT; six-commit/low-activity repository at research time.
- [yannbouteiller/vgamepad][vgamepad] — Python X360/DS4 wrapper; Windows stable,
  Linux experimental; ViGEmBus install flow; MIT.
- [jshafer817/vJoy][vjoy] — generic Windows virtual joystick; MIT; old build and
  driver-signing stack documented in the repository.
- [Microsoft VHF documentation][vhf] — Windows 10+; kernel-mode-only HID source
  driver using WDK/KMDF/WDM; HID descriptor and driver installation requirements.
- [Linux `uinput` documentation][uinput] and [Linux gamepad specification][linux-gamepad] —
  userspace-created input devices and gamepad event conventions.
- [SDL3 `SDL_AttachVirtualJoystick`][sdl-virtual] — program-supplied virtual
  joystick scoped to the SDL application.
- [Apple `GCVirtualController`][gcvirtual] and [HIDDriverKit][hiddriverkit] —
  game-specific software controller versus system-level driver route.
- [MCP server tools specification][mcp-tools] — tool schemas, structured
  results, explicit state handles, deterministic tool listing guidance, and
  input validation/security expectations.

[vigembus]: https://github.com/nefarius/ViGEmBus
[vigemclient]: https://github.com/nefarius/ViGEmClient
[vigem-eol]: https://docs.nefarius.at/projects/ViGEm/End-of-Life/
[rust-vigem]: https://github.com/CasualX/vigem-client
[vgamepad]: https://github.com/yannbouteiller/vgamepad
[vjoy]: https://github.com/jshafer817/vJoy
[vhf]: https://learn.microsoft.com/en-us/windows-hardware/drivers/hid/virtual-hid-framework--vhf-
[uinput]: https://docs.kernel.org/input/uinput.html
[linux-gamepad]: https://docs.kernel.org/input/gamepad.html
[sdl-virtual]: https://wiki.libsdl.org/SDL3/SDL_AttachVirtualJoystick
[gcvirtual]: https://developer.apple.com/documentation/gamecontroller/gcvirtualcontroller
[hiddriverkit]: https://developer.apple.com/documentation/hiddriverkit
[mcp-tools]: https://modelcontextprotocol.io/specification/2026-07-28/server/tools
[testing]: ../../TESTING.md
[wdio]: ../../wdio.conf.js
[mapper]: ../../src/immersive/useGamepadKeyboardMapper.js
[mapper-tests]: ../../src/immersive/useGamepadKeyboardMapper.test.jsx
[ledger]: ../transparent-romm-launching/emulator-certification.md
