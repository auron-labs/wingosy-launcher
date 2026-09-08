# Virtual gamepad adapter

This is a test-owned, standalone process for one implicit Xbox 360 controller.
It is outside `src-tauri/` and is not part of the Wingosy application runtime.
The ViGEm dependency is selected only for Windows targets.

## Checks

Run these commands from the repository root. They are deliberately separate from
the ordinary `src-tauri` checks:

```text
mise exec -- cargo test --manifest-path tools/virtual-gamepad-adapter/Cargo.toml --locked
mise exec -- cargo fmt --manifest-path tools/virtual-gamepad-adapter/Cargo.toml -- --check
mise exec -- cargo check --manifest-path tools/virtual-gamepad-adapter/Cargo.toml --all-targets --locked
mise exec -- cargo clippy --manifest-path tools/virtual-gamepad-adapter/Cargo.toml --all-targets --locked -- -D warnings
```

The available-host checks do not need ViGEmBus. Do not run the real-driver smoke
on a non-Windows host. On a provisioned Windows test machine, the opt-in smoke is:

```text
mise exec -- cargo run --manifest-path tools/virtual-gamepad-adapter/Cargo.toml --example windows_smoke
```

The opt-in native Wingosy navigation proof uses the debug adapter binary and is
selected separately from the default WDIO specs. Build the adapter, then run it
with the normal native E2E prerequisites on Windows:

```text
mise exec -- cargo build --manifest-path tools/virtual-gamepad-adapter/Cargo.toml --locked
bun run test:e2e:virtual-gamepad
```

The proof derives `tools/virtual-gamepad-adapter/target/debug/` from the
repository root. A prebuilt binary can be selected with
`WINGOSY_VIRTUAL_GAMEPAD_ADAPTER_PATH` when the default path is not suitable.

## NDJSON protocol

The process reads one JSON object per line and writes one JSON response per line.
It owns one implicit target; it exposes no controller handles, slots, leases,
network interface, or second-controller operation.

Commands are `connect`, `set_state`, `neutral`, `status`, and `disconnect`.
`set_state` replaces the complete report. Every button below is required,
`dpad` is exactly one of `neutral`, `up`, `down`, `left`, or `right`, stick
`x`/`y` values are normalized to `[-1, 1]`, and triggers are normalized to
`[0, 1]`. Stick Y uses positive-up semantics, matching the native report.

```json
{"command":"connect"}
{"command":"set_state","state":{"buttons":{"a":true,"b":false,"x":false,"y":false,"start":false,"back":false,"guide":false,"left_thumb":false,"right_thumb":false,"left_shoulder":false,"right_shoulder":false},"dpad":"up","left_stick":{"x":0,"y":0},"right_stick":{"x":0,"y":0},"left_trigger":0,"right_trigger":0}}
{"command":"neutral"}
{"command":"status"}
{"command":"disconnect"}
```

`disconnect` and EOF attempt a neutral report before unplugging/releasing the
target. Both failures are retained in the error response or EOF diagnostic.
Repeated cleanup while already disconnected is safe. On non-Windows hosts,
driver actions fail with an explicit unsupported-platform error while protocol
conversion tests remain runnable.

## Inactivity timeout

The live process defaults to a 30-second inactivity timeout. Set
`WINGOSY_GAMEPAD_INACTIVITY_TIMEOUT_MS` to a positive, finite integer number of
milliseconds; zero, non-integer, non-finite, or values too large for the system
clock fail startup.
Each successfully dispatched `set_state` starts or resets the deadline.
`neutral` and `disconnect` disarm it. On expiry, the connected target receives a
complete neutral report and remains ready; no unsolicited NDJSON response is
written. The next `status` includes a short `last_timeout` diagnostic, and a
later valid `set_state` is accepted normally.

## Manual Windows provisioning

Provision a dedicated Windows 10/11 test machine manually before using the
adapter:

1. Obtain an archived ViGEmBus release from an approved archival or internal
   source. Deliberately verify the archive's expected checksum and its
   production Authenticode signature before installation; do not trust an
   unverified mirror or replacement package.
2. Install that already-verified release using the machine's normal elevated
   Windows administration procedure, then confirm that ViGEmBus can create a
   ready X360 target.
3. Do not run a retired updater. Its stale configuration may contact the former
   `vigem.org` domain. Disable or remove that updater behavior according to the
   machine's security procedure, and do not direct provisioning automation to
   that retired domain.
4. Keep competing physical or virtual controllers out of the test setup so the
   one-controller prerequisite remains deliberate. An abnormal exit may leave
   an orphaned target; stop the adapter and use existing Windows/driver controls
   or reboot before trying a fresh `connect`.

No install, update, download, driver provisioning, or bundling is automated by
this crate. ViGEmBus and `vigem-rust` are not dependencies of Wingosy's shipped
runtime; this note and adapter are test-only.
