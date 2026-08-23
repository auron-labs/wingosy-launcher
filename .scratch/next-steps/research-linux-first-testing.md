# Linux-first automated, LLM, and manual testing options

Research date: 2026-08-23. Scope: Wingosy Launcher (a Windows-native Tauri
v2, React, and Rust app), Linux-first development, an available Windows PC,
and future GitHub Actions Windows checks. This is a recommendation note; it
does not expand the current Windows beta contract.

## Current evidence and boundary

- The repository already has Vitest/React Testing Library unit tests, Rust
  tests, opt-in live Rust integration tests, and WebdriverIO Tauri E2E tests
  ([`TESTING.md`](../TESTING.md)).
- The current PR CI is Windows-only and runs build, lint, typecheck, unit
  tests, Rust tests, Clippy, and coverage
  ([`ci.yml`](../.github/workflows/ci.yml)).
- The current E2E harness is Windows-specific: it hard-codes the `.exe`, Edge
  driver, and Edge-driver download ([`wdio.conf.js`](../wdio.conf.js)). Several
  E2E assertions also deliberately refer to Windows `.exe` and AppData paths.
- This makes Linux a good default for fast, deterministic regression checks,
  but it cannot certify the shipped product. Tauri uses WebKitGTK on Linux and
  Edge WebView2 on Windows ([Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).
  Installer, registry/path discovery, WebView2 behavior, real emulators, and
  controller input remain Windows evidence.

### Local audit on 2026-08-23

- On Ubuntu, `bun run build`, `bun run typecheck`, and all 37 Vitest cases
  passed. Frontend lint exited successfully with 8 warnings.
- Frontend coverage was 19.61% statements/lines. The report is uploaded in CI,
  but no threshold currently turns a regression into a failure. Do not impose a
  broad target immediately; add tests around changed or beta-critical behavior,
  then ratchet a baseline instead of writing low-value tests for a percentage.
- `bun run test:rust` did not reach the tests because this Linux machine lacks
  `javascriptcoregtk-4.1` and the other documented Tauri system packages. This
  is an environment/bootstrap gap, not a Rust test failure.
- The Windows E2E directory contains 159 `it(...)` cases, 177 fixed
  `browser.pause(...)` calls, and 58 bare early returns. Some cases log a
  missing prerequisite and return successfully; at least one assertion contains
  `|| true`. The suite also deliberately runs setup first and shares app state.
  These counts do not make every case invalid, but they make a green full-suite
  result too weak for a release gate today.

The first E2E improvement should therefore be a small trustworthy smoke set:
clean test state, explicit fixture/precondition failure, condition-based waits,
real assertions, and automatic screenshot/log capture on failure. Keep live
download, RomM, emulator, and controller scenarios separate from that smoke.

## Recommended testing policy

| Tier | Where | Purpose | Required when |
| --- | --- | --- | --- |
| Fast | Linux local + PR CI | Build, lint, typecheck, Vitest, Rust tests, Clippy | Every PR |
| Focused UI | Linux local + PR CI | Critical renderer flows with mocked IPC | After a UI regression or when a flow cannot be expressed by current RTL tests |
| Native shell | Linux local / scheduled CI | Small platform-neutral Tauri WebDriver smoke | After the fast lane is stable |
| Windows runtime | Windows PC; later scheduled or dispatched Actions | Curated native smoke; full suite remains advisory until hardened | Before beta/release and changes to Windows-facing behavior |
| Human certification | Windows PC | Real RomM/emulator/content/controller/update outcomes | Before beta/release; re-run affected rows after relevant changes |

Make the first row the normal development loop. Do not relabel a Linux mock or
WebDriver run as Windows certification.

## Options, from smallest to largest

### 1. Split the current CI into a Linux required gate and a narrow Windows lane — recommended now

Add an Ubuntu job that runs the commands already owned by the repository:
`bun install --frozen-lockfile`, frontend build/lint/typecheck, `bun run test:unit`, `bun run test:rust`,
and `bun run lint:rust`. Install the standard Linux Tauri build dependencies;
Tauri documents `libwebkit2gtk-4.1-dev`, build tools, OpenSSL, appindicator,
and librsvg for Debian/Ubuntu
([official prerequisites](https://v2.tauri.app/start/prerequisites/)).

Keep the existing Windows job initially: it compiles the Windows-only `cfg`
paths that Linux cannot see, and it does not currently run the E2E suite. Put a
curated native smoke in a separate scheduled/manual workflow before considering
it a PR gate. GitHub provides both `ubuntu-latest` and
`windows-latest` runners and supports separate/matrix jobs
([runner selection](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job),
[matrix jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations)).

This needs no new test framework. Keep the ignored network tests opt-in: Rust
explicitly supports `#[ignore]` for expensive tests and
`cargo test -- --ignored` to run only them
([Rust test controls](https://doc.rust-lang.org/book/ch11-02-running-tests.html)).
Run the emulator-source suite on a schedule or before a release, and only run
the credentialed RomM suite against a dedicated non-production test instance.

### 2. Give LLM agents a deterministic Linux test contract — recommended now

Use the existing commands rather than a new LLM testing product. The agent
should select the smallest relevant test level, run it, and report the exact
command, result, and intentionally unrun Windows-only checks:

| Change surface | Agent must run on Linux | Escalate to Windows |
| --- | --- | --- |
| Pure React/helper behavior | `bun run test:unit`, typecheck, frontend lint | Only if it changes a user-visible native flow |
| Rust logic, storage, URL/path parsing | `bun run test:rust`, Rust lint | If it touches Windows paths, keyring, process launch, or installer behavior |
| Tauri command/UI boundary | Relevant unit tests plus build | Existing E2E spec or a focused Windows smoke |
| External emulator/RomM contract | Relevant ignored integration test, when safe | Manual evidence with the real permitted environment |

An LLM may create the smallest regression test in the suite already used by
the changed code; it must not call mocked IPC, synthetic binaries, or a skipped
spec “certification.” This maps directly to the distinction already recorded
in the [emulator certification ledger](../.scratch/transparent-romm-launching/emulator-certification.md).

For a Windows-capable LLM session, use the same release build and WDIO scripts
as a human. Capture command output, app/backend logs, and a screenshot on a
failure so the agent can diagnose a reproducible artifact, not a recollection.
GitHub Actions artifacts are designed for preserving test output such as logs
and screenshots
([GitHub artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts)).

### 3. Add a small Linux renderer-flow suite if the current unit tests leave UI gaps

First preference: add targeted Vitest tests using Tauri's official `mockIPC`
support. It lets a frontend test intercept and validate `invoke` calls, but it
does not execute a real webview or Rust backend
([Tauri API mocking](https://v2.tauri.app/develop/tests/mocking/)). That is
ideal for LLM-run Linux tests of loading/error/persistence UI states.

If jsdom fidelity proves insufficient, Tauri documents WebdriverIO browser
mode: it runs the renderer in Chrome against Vite without a Tauri binary or
driver, while intercepting `invoke()` calls
([Tauri WebDriver](https://v2.tauri.app/develop/tests/webdriver/)). Add only a
few critical flows (for example setup completion, settings persistence UI, and
launch-error recovery), not a duplicate of every RTL test.

### 4. Port only a platform-neutral E2E smoke to Linux

Tauri supports direct desktop WebDriver on Linux and Windows. Its official
Linux CI example uses WebKitWebDriver and `xvfb`, and recommends running Rust
tests before WebDriver
([Tauri WebDriver CI](https://v2.tauri.app/develop/tests/webdriver/ci/)).

Parameterize the current `wdio.conf.js` by platform and create a separate
Linux smoke selection containing only assertions without `.exe`, AppData, or
Windows emulator assumptions. On Ubuntu, install the driver and run it under
`xvfb`; on Windows retain Edge Driver. This is stronger than a mocked renderer
test, but it is not a reason to force the entire Windows-oriented E2E suite to
be cross-platform.

Tauri currently recommends the maintained `@wdio/tauri-service`, which can
use an embedded driver and has IPC mocking and log capture
([Tauri WebDriver](https://v2.tauri.app/develop/tests/webdriver/)). Treat a
migration to it as an alternative if the direct-driver configuration becomes a
maintenance problem, not a prerequisite for the Linux fast gate.

### 5. Make Windows automation gradual, then promotion-blocking

Start with `workflow_dispatch` or a nightly Windows workflow that builds the
release binary and runs a newly curated smoke selection; do not gate on all 159
existing cases merely because they execute. GitHub supports manually
started workflows
([manual workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow));
use this while stabilizing the suite and upload diagnostics on failure. Once
repeatable, require the Windows smoke on PRs that touch Tauri commands, emulator
detection/launch, updater, Windows paths, or the E2E harness. Reserve the full
suite and installer install/update check for beta and release candidates.

Keep the exact release candidate traceable: installer artifact, commit SHA,
Actions run URL, WDIO output, and any logs/screenshots. Use a dedicated test
RomM account and redact tokens, user paths, and personal library data before
giving artifacts to an LLM. Do not make a hosted
Windows job the only release gate: it cannot demonstrate a real controller,
permitted content, or the local RomM/emulator environment.

### 6. Reuse the existing Windows human certification work rather than adding test management

The repository already has the right high-value artifacts:

- [`Plan 006`](issues/06-certify-and-gate-the-windows-beta.md) specifies clean-install,
  update, controller, save-round-trip, and six-platform certification gates.
- The [emulator certification ledger](../.scratch/transparent-romm-launching/emulator-certification.md)
  separates source/mock evidence from real Windows runtime evidence.

On the Windows PC, use a 10–15 minute smoke for every release candidate:
clean install or update; setup/pair/sync; browse a real library; install/detect
one supported emulator; launch permitted content; controller/immersive
navigation; restart and persistence; attach the requested evidence. Re-run
the affected ledger row(s) after changes to launch, emulator, save, input, or
storage code. Keep the full six-platform pass for beta promotion as Plan 006
already requires.

## Practical sequence

1. Add the Linux required fast gate and document the LLM command/evidence rule.
2. Keep Windows build/smoke available on demand; make it scheduled once it is
   reliable, with failure artifacts.
3. Fill only demonstrated renderer gaps with `mockIPC` tests. Add Linux native
   E2E only after a small smoke selection is genuinely platform-neutral.
4. Before any beta/release, use the Windows PC and the existing ledger/Plan 006
   gates; no amount of Linux or LLM automation substitutes for that evidence.

## Deliberately not recommended now

- A new test-management SaaS, self-hosted Windows runner, or a second general
  E2E framework: the repository already has Vitest, Rust tests, and WDIO.
- Cross-compiling/install-testing the Windows app from Linux as a replacement
  for a Windows run. Tauri's Windows path uses WebView2 and requires the MSVC
  toolchain for full support
  ([Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).
- Testing commercial ROMs, personal credentials, emulator binaries, or user
  data in CI. Use permitted fixtures and a dedicated test RomM environment.
