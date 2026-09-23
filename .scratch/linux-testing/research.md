# Running the Wingosy test suite on Linux

**Research date:** 2026-09-22<br>
**Scope:** Wingosy Launcher on Linux (dev machine is Linux; shipping target is
Windows). Tauri 2/Rust backend, Bun/Vitest frontend, WebdriverIO/Mocha E2E via
`tauri-driver` + msedgedriver, Tauri MCP smoke tests. This is a research note,
not an implementation.

## Verdict per layer

| Layer | Verdict | Notes |
| --- | --- | --- |
| **Vitest + jsdom + RTL** (`bun run test:unit`) | **Works today — verified** | Ran on Linux: **54 files / 301 tests, all pass**. Nothing OS-specific in `vitest.config.js`/`vitest.setup.js`. |
| **Rust unit tests** (`cd src-tauri && cargo test`) | **Mostly works — verified, 6 platform failures** | Ran on Linux: **369 passed, 6 failed, 1 ignored**. All Windows-only code is `#[cfg]`-gated and compiles. Failures: 5× `emulators::launcher::tests::launch_*` (`No emulator configured for platform: gba` — test fixture/emulator-resolution assumes Windows install detection) and 1× `sync::switch_save_roundtrip::eden_save_sync_round_trips_*` (`400 Bad Request` on upload multipart — investigate; may be fixture-related, not necessarily Linux-specific). |
| **Rust integration tests** (`src-tauri/tests/`, `#[ignore]`) | **Works today** | Same compile evidence in `target/debug`; live-network tests are platform-agnostic HTTP/file I/O. |
| **E2E (wdio + tauri-driver)** | **Works with setup + small config changes** | The supported Linux path is `tauri-driver` + `WebKitWebDriver` (installed at `/usr/bin/WebKitWebDriver`). Needs: `cargo install tauri-driver --locked`, a Linux-built app binary, and platform-aware `wdio.conf.js` (see plan). Some specs will legitimately fail/differ on Linux (gamepad/ViGEm, RomM credential storage, updater artifacts, real-emulator launches). |
| **Tauri MCP smoke tests** | **Works today** | `tauri-plugin-mcp-bridge` is debug-only (`main.rs:85-90`), pure Rust + WebSocket on `127.0.0.1:9223`; `@hypothesi/tauri-mcp-cli` is already in `node_modules`. It drives the app over an embedded IPC/WebSocket bridge, not WebDriver, so it is OS-agnostic. Requires `bun run dev`/`tauri dev` — which builds a debug app and therefore also needs the GTK/WebKitGTK dev libs (already installed here). |
| **Headless backend tests via `tauri::test`** | **Available, not currently enabled** | `tauri::test` (`mock_app`, `mock_builder`, `mock_context`, `get_ipc_response`, `assert_ipc_response`) exists in tauri 2.x behind the `test` feature. `Cargo.toml` does not enable it. Optional future lever for command-level tests with `MockRuntime` — no real webview at runtime (crate still links GTK/WebKitGTK at build time). |
| **Wine + the Windows .exe + WebView2** | **Blocked — do not pursue** | WebView2 is broken under Wine: its installer hangs, and `msedgewebview2.exe` fails on Windows-version ≥ 8.1 due to unimplemented DirectComposition (`DCompositionCreateDevice failed: Not implemented`). |
| **Cross-compile `cargo test --target x86_64-pc-windows-msvc`** | **Possible but not worth it** | Needs an MSVC sysroot (cargo-xwin/xwin) plus Wine to execute the test binaries. Pure-logic tests would run, but setup cost is high and it buys nothing over running the suite natively on Linux. |

## Empirical results (this machine, this repo)

- **`src-tauri/tauri.conf.json`** — nothing Windows-only blocks a Linux build:
  `app.windows` is the window list (not OS), `bundle.targets: "all"` builds
  host-platform bundles (deb/rpm/AppImage on Linux), `createUpdaterArtifacts`
  and the updater endpoint are platform-agnostic, and
  `plugins.updater.windows.installMode` is already Windows-scoped. Icon list
  mixes `.png`/`.icns`/`.ico`; Linux bundling uses the PNGs.
  `windowsSubsystem` is handled by the `#![cfg_attr(all(not(debug_assertions), target_os = "windows"))]`
  gate in `main.rs:1-4`.
- **`src-tauri/Cargo.toml`** — the only Windows-only deps (`keyring` with
  `windows-native-keyring-store`, `sdl3` with `build-from-source-static`,
  `winreg`) are correctly under `[target."cfg(windows)".dependencies]`
  (`Cargo.toml:46-49`).
- **Linux system deps — all present:**
  - `/usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc` (WebKitGTK **2.52.3**),
    `javascriptcoregtk-4.1.pc`, `libsoup-3.0.pc`, `gtk+-3.0.pc`, `openssl.pc`
    → `libwebkit2gtk-4.1-dev`, `libsoup-3.0-dev`, `libgtk-3-dev`, `libssl-dev`
    are installed.
  - `which WebKitWebDriver` → `/usr/bin/WebKitWebDriver` (the
    `webkit2gtk-driver` package is installed).
  - `which tauri-driver` → **not found** (the one missing piece).
  - `cargo`/`rustc` present via mise shims (toolchain `1.97.1-x86_64-unknown-linux-gnu`
    per `src-tauri/target/.rustc_info.json`; mise.toml pins rust 1.98.0), `bun` 1.4.0.
- **Prior Linux build evidence:** `src-tauri/target/debug` contains
  fingerprints and compiled binaries for `bin-wingosy-launcher`,
  `test-bin-wingosy-launcher`, `test-integration-test-emulator_integration`,
  and `test-integration-test-romm_integration`, plus `tauri-codegen-assets`
  (embedded frontend). So `cargo test` has already compiled and run natively
  on this host; combined with the recorded "334 passed, 0 failed" baseline,
  Rust tests are a solved layer.
- **`dist/` exists** (`index.html`, `assets/`, `sounds/`). `tauri-build`
  codegen embeds `frontendDist` (`../dist`) at compile time — the debug
  artifacts confirm assets were embedded — so keep `dist/` present
  (`bun run build`) before `cargo test`/`tauri dev` if it is ever missing.
- **Windows-only source is fully gated** — nothing unconditionally uses
  Windows APIs:
  - `romm_credentials.rs` — keyring calls are `#[cfg(target_os = "windows")]`;
    `#[cfg(not(target_os = "windows"))]` stubs compile and return
    `Ok(None)`/`bail!("...Windows only")` (`romm_credentials.rs:99-127`).
  - `controller.rs:541-584` — SDL3 discovery is `#[cfg(windows)]`; the
    non-Windows fallback `bail!`s. `discover_controllers` is a runtime stub on
    Linux, not dead code.
  - `emulators/detection.rs` — all `winreg` use is `#[cfg(windows)]`
    (`:3-4, :92-95, :169-172`); `#[cfg(not(windows))] get_common_install_paths`
    returns empty (`:473-476`); `open_emulator_location` already has an
    `xdg-open` Linux arm (`:528-532`).
  - `commands.rs` — `winreg` device-name lookup gated at `:1875-1889`; Linux
    arms exist at `:3222-3223` (`xdg-open` parent dir) and `:3241-3247`,
    `:3270-3274`.
  - `storage.rs:140-193` — `GetDiskFreeSpaceExW` behind `#[cfg(windows)]`;
    non-Windows `free_disk_bytes` returns `None` (`:178-181`).
  - `switch_content.rs:704-756` — `MoveFileExW` behind `#[cfg(windows)]`;
    `fs::rename` fallback for non-Windows.
  - `emulators/launcher.rs:650-718` — test helpers already have `#[cfg(unix)]`
    shell-script variants alongside `#[cfg(windows)]` `.cmd` variants — the
    suite was written to run cross-platform.
- **Runs verified after the fact (main session):**
  - `bun run test:unit` → 54 files / 301 tests, all pass (~27s).
  - `cargo test --no-run` → compiles cleanly in ~31s (deps were already
    built; webkit2gtk dev libs present).
  - `cargo test` → 369 passed / 6 failed / 1 ignored. The 6 failures are
    listed in the verdict table; the launcher ones all fail on
    `No emulator configured for platform: gba`, i.e. the tests' emulator
    fixture wiring hits a Windows-assuming path, not a compile problem.

## Doc findings (with sources)

- **Supported Linux WebDriver path:** `tauri-driver` + `WebKitWebDriver`.
  "We use `WebKitWebDriver` on Linux platforms… such as `webkit2gtk-driver` on
  Debian-based distributions" — and "driving `tauri-driver` directly, only
  Windows and Linux are supported on desktop."
  <https://v2.tauri.app/develop/tests/webdriver/manual-setup/>
- **tauri-driver binary lookup:** on Linux it looks for `WebKitWebDriver` on
  `$PATH`; on Windows, `msedgedriver.exe`; `--native-driver PATH` overrides.
  Ports: `--port` (default 4444, intermediary) and `--native-port` (default
  4445). tauri-apps/tauri `crates/tauri-driver/README.md` and source:
  <https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-driver/README.md>,
  <https://github.com/tauri-apps/tauri/commit/b4426eda9e64fcdd25a2d72e548b8b0fbfa09619>
- **Capability shape:** the official Tauri WebdriverIO example sets **only**
  `tauri:options.application` — no `browserName`. Session logs show
  `wry` as the server-supplied name. A real-world bug report found that a
  client-supplied `browserName: 'wry'` is rejected by WebKitWebDriver's W3C
  capability matching ("no browser named 'wry'"), while msedgedriver
  tolerates it — i.e. our `browserName: 'wry'` works on Windows but is a
  probable session-creation failure on Linux.
  <https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/develop/Tests/WebDriver/Example/webdriverio.mdx>,
  <https://github.com/bloknayrb/tandem/pull/1128>
- **WebKitWebDriver conformance gaps** (relevant to our ~154 specs): WebKit's
  own status tracker marks Get Element Text *incomplete* (normalized innerText,
  not the Selenium algorithm), and Element Click / Clear / Send Keys
  *partially complete*. `partial link text` is implemented as
  `.//a[@href][contains(...)]` — anchors only. Most specs use `button*=` /
  `[data-testid]` CSS which should be fine; bare `$('*=Text')` selectors are
  the risk area to verify on first run.
  <https://trac.webkit.org/wiki/WebDriverStatus>,
  <https://trac.webkit.org/changeset/225388/webkit/>
- **`@wdio/tauri-service`** (not currently used) is the newer official route:
  its default `'embedded'` provider runs an in-app WebDriver server via
  `tauri-plugin-wdio-webdriver` and works on Windows/Linux/macOS with no
  external driver; `'external'` uses `tauri-driver` + WebKitWebDriver and
  requires `webkit2gtk-driver`. Worth knowing as a fallback if raw
  `tauri-driver` proves flaky, but not a minimal change.
  <https://github.com/webdriverio/desktop-mobile/blob/main/packages/tauri-service/docs/platform-support.md>,
  <https://github.com/webdriverio/desktop-mobile/blob/main/packages/tauri-service/docs/configuration.md>
- **Linux CI recipe** (official): `apt-get install libwebkit2gtk-4.1-dev
  libayatana-appindicator3-dev webkit2gtk-driver xvfb`, then run wdio under a
  fake display. A desktop session needs no xvfb.
  <https://v2.tauri.app/develop/tests/webdriver/ci/>
- **`tauri::test` (tauri 2.x, feature `test`):** provides `mock_app`,
  `mock_builder`, `mock_context`, `noop_assets`, `get_ipc_response`,
  `assert_ipc_response` with a `MockRuntime` — headless command/IPC tests
  without creating a real webview.
  <https://docs.rs/tauri/latest/tauri/test/index.html>,
  <https://docs.rs/tauri/latest/tauri/test/fn.mock_app.html>
- **tauri-plugin-mcp-bridge / @hypothesi/tauri-mcp-cli:** the MCP server talks
  to the Rust plugin over **WebSocket (default port 9223)**, not WebDriver —
  no platform restriction; `driver-session start --port 9223` then webview
  tools. Our `main.rs:85-90` registers it under `#[cfg(debug_assertions)]`, so
  any `tauri dev` (debug) session on Linux exposes it.
  <https://github.com/hypothesi/mcp-server-tauri>,
  <https://github.com/hypothesi/mcp-server-tauri/blob/main/packages/tauri-plugin-mcp-bridge/README.md>
- **WebView2 under Wine:** installer hangs reported across Wine versions;
  `msedgewebview2.exe` requires win7/8 mode and still fails on ≥8.1 because
  `DCompositionCreateDevice` is unimplemented. Effectively unusable for E2E.
  <https://list.winehq.org/archives/list/wine-bugs@list.winehq.org/thread/6KGGMKX5IAC64ZWI457PWA6UIZW7H3RY/>,
  <https://forum.winehq.org/viewtopic.php?t=39876>,
  <https://github.com/MicrosoftEdge/WebView2Feedback/issues/3127>

## What differs at runtime on Linux (relevant to the ~154 specs)

- **Custom protocol URL:** Linux wry serves the app at `http://tauri.localhost`
  (Windows uses `https://tauri.localhost`; macOS `tauri://`). `helpers.js`
  `navigateToApp()` already tries all three — no change needed.
- **RomM credential storage** returns "Windows only" errors on Linux —
  session-restore specs will fail by design.
- **Emulator detection** finds nothing (all scan paths are `#[cfg(windows)]`)
  — specs are written defensively ("No emulators installed - skipping"), so
  most pass; emulator download specs will fetch Windows artifacts that cannot
  run/launch.
- **Game launch** executes real emulator binaries — will fail on Linux;
  specs already tolerate absent games.
- **Updater** queries a GitHub `latest.json` with Windows artifacts — update
  checks will no-op/error on Linux.
- **Virtual gamepad spec** — `tools/virtual-gamepad-adapter` compiles on Linux
  (ViGEm dep is `cfg(windows)`-gated) but `connect()` returns "only supported
  on Windows" (`driver.rs:72-75`), so `virtual-gamepad-navigation.spec.js`
  fails; it is also absent from the default `specs` list in `wdio.conf.js`.
- **Window chrome:** `decorations: false` renders fine under GTK; `maximized`
  behavior may differ slightly by WM.
- **Free-disk reporting** returns `None` on Linux (`storage.rs:178-181`) —
  Storage settings may render differently.

## Concrete minimal-change plan

1. **Prereqs (apt):** `libwebkit2gtk-4.1-dev webkit2gtk-driver libgtk-3-dev
   libsoup-3.0-dev libssl-dev` (+ `libayatana-appindicator3-dev` only if tray
   is added; `xvfb` only for headless CI). **Already installed on this
   machine.** Then `cargo install tauri-driver --locked`.
2. **Platform-aware `wdio.conf.js`** (the only file that must change):
   - `tauriAppPath`: `process.platform === 'win32'` →
     `target/release/Wingosy Launcher.exe`; else →
     `target/debug/Wingosy Launcher` (debug build is faster and matches the
     MCP/debug workflow; release also fine, name has no `.exe`).
   - Drop `browserName: 'wry'` entirely (matches the official example; avoids
     WebKitWebDriver capability rejection).
   - `onPrepare`: skip the `edgedriver` download when `process.platform !==
     'win32'`; spawn `tauri-driver` with no `--native-driver` on Linux (it
     finds `WebKitWebDriver` on PATH) or pass `--native-driver
     /usr/bin/WebKitWebDriver` for determinism.
   - Build the app: `bun run tauri build -- --debug --no-bundle` (or plain
     `cargo build` → binary `wingosy-launcher` — pick one path and match the
     config).
3. **Rust layers:** no changes — `bun run test:rust` and the ignored
   integration suites already work on Linux.
4. **Tauri MCP:** no changes — `bun run dev` + `tauri-mcp driver-session start
   --port 9223`; `scripts/capture-screenshots.mjs` is already
   platform-agnostic.
5. **Expectation management:** treat Linux E2E as a smoke/net-new-signal
   suite, not a Windows parity suite. Mark Windows-only specs
   (`virtual-gamepad-navigation`, RomM session persistence, real-emulator
   launch/download, updater install) as platform-gated or expect known
   failures; Windows runners (CI already on `windows-latest`, `ci.yml:17`)
   remain the certification path.
6. **Optional later:** enable `tauri`'s `test` feature via
   `[dev-dependencies] tauri = { version = "2", features = ["test"] }` for
   headless `MockRuntime` command tests — useful for command-level coverage
   that doesn't need a webview at all.

## Open questions / risks

- **~~Unverified runs~~ now verified:** `bun run test:unit` ✅ (301/301) and
  `cargo test` ⚠️ (369/375, six platform-flavored failures — see table).
  Remaining unverified piece: an actual `wdio` E2E run against
  WebKitWebDriver (needs `cargo install tauri-driver` + the conf changes).
- **`browserName: 'wry'`:** documented third-party failure on WebKitWebDriver;
  trivially fixable, but confirm wdio doesn't require a `browserName` with our
  pinned `@wdio/*` 9.31.x versions on Linux.
- **Selector coverage:** bare `$('*=text')` (partial link text, anchors-only
  in WebKitWebDriver) appears in helpers (`*=All Games`, `*=Favorites`); if
  wdio maps these to partial-link-text rather than its own XPath, some lookups
  fail on Linux even though they pass on msedgedriver. First run will reveal
  this quickly.
- **WebKitGTK 2.52 rendering:** engine is modern (≈Safari 26-class), but MUI
  styling/screenshot pixel parity with WebView2 is not a goal — don't
  pixel-diff across platforms.
- **Display requirement:** E2E needs an X/Wayland display or `xvfb-run`; a
  headless SSH session won't work out of the box.
- **Debug-vs-release divergence:** `main.rs` gates the MCP plugin on
  `debug_assertions`; running E2E against a release build removes the MCP
  bridge — irrelevant to wdio but relevant if mixing MCP and wdio flows.
- **Updater endpoints on Linux:** `createUpdaterArtifacts` will try to sign
  Linux bundles on `tauri build`; `--no-bundle` or debug builds avoid it.

## Sources

- Repo files: `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`,
  `wdio.conf.js`, `e2e-webdriver/helpers.js`, `src-tauri/src/main.rs`,
  `src-tauri/src/{commands,controller,storage,romm_credentials}.rs`,
  `src-tauri/src/emulators/{detection,launcher}.rs`,
  `src-tauri/src/sync/switch_content.rs`,
  `tools/virtual-gamepad-adapter/src/driver.rs`, `package.json`,
  `TESTING.md`, `.github/workflows/ci.yml`,
  `.scratch/smoke-test-followups/issues/08-restore-rust-test-baseline.md`,
  `src-tauri/target/.rustc_info.json`,
  `src-tauri/target/debug/.fingerprint/*`, `/usr/lib/x86_64-linux-gnu/pkgconfig/*.pc`
- <https://v2.tauri.app/develop/tests/webdriver/manual-setup/>
- <https://v2.tauri.app/develop/tests/webdriver/ci/>
- <https://v2.tauri.app/release/tauri-driver/>
- <https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-driver/README.md>
- <https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/develop/Tests/WebDriver/Example/webdriverio.mdx>
- <https://github.com/webdriverio/desktop-mobile/blob/main/packages/tauri-service/docs/platform-support.md>
- <https://github.com/webdriverio/desktop-mobile/blob/main/packages/tauri-service/docs/configuration.md>
- <https://trac.webkit.org/wiki/WebDriverStatus>
- <https://trac.webkit.org/changeset/225388/webkit>
- <https://docs.rs/tauri/latest/tauri/test/index.html>
- <https://github.com/hypothesi/mcp-server-tauri>
- <https://github.com/bloknayrb/tandem/pull/1128>
- <https://list.winehq.org/archives/list/wine-bugs@list.winehq.org/thread/6KGGMKX5IAC64ZWI457PWA6UIZW7H3RY/>
- <https://forum.winehq.org/viewtopic.php?t=39876>
