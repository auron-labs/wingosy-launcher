# Manage a reproducible RetroArch profile

Type: task
Mode: agent
Status: resolved
Blocked by: 01, 02

> Follow this plan step by step and update `../spec.md` when done.
>
> Drift check: `git diff --stat a96ce03..HEAD -- src-tauri/src/models/emulator.rs src-tauri/src/emulators src-tauri/src/config src-tauri/src/commands.rs src/components/Settings.jsx`

## Status

- **Priority:** P0
- **Effort:** M
- **Risk:** MED
- **Depends on:** 001, 002
- **Category:** emulator configuration / supply chain
- **Planned at:** commit `a96ce03`, 2026-08-23

## Why this matters

Wingosy currently combines a fixed RetroArch 1.19.1 archive with cores fetched
from an unversioned nightly `latest` endpoint. It also records only an executable
path after installation and launches without a managed configuration. The beta
cannot reproduce or safely repair the emulator/core combination it certifies.

## Current state

- `src-tauri/src/models/emulator.rs:55-70` hardcodes the RetroArch 1.19.1 archive.
- `src-tauri/src/emulators/cores.rs:5-34` downloads cores from
  `nightly/windows/x86_64/latest`.
- `src-tauri/src/commands.rs:2462-2482` saves the executable path after install;
  it does not persist whether Wingosy owns that installation.
- `src-tauri/src/emulators/launcher.rs:78-100` launches the resolved executable,
  core, and ROM without `--appendconfig`.
- RetroArch supports a small higher-priority delta via `--appendconfig`; see
  [the research note](research-emulator-controller-patterns.md#1-add-a-wingosy-owned-retroarch-delta-rather-than-editing-an-external-configuration).

## Scope

In scope: the managed RetroArch installer, its six beta cores, install metadata,
launch arguments, a generated delta file, Settings repair/opt-in controls, and
focused tests. Out of scope: background updates, external RetroArch mutation,
shaders, renderer/latency tuning, save-state automation, per-core options, and a
general configuration editor.

## Steps

1. Add one in-repo beta artifact manifest containing the RetroArch version,
   archive URL and SHA-256, plus the archive URL and SHA-256 for each of the six
   promised core artifacts. Download to a temporary file, verify before extraction,
   and fail closed on a digest mismatch. Remove the moving nightly URL from the
   managed install path.
2. Persist the installed manifest version and installation ownership (`managed`
   or `external`) beside the existing executable path. Existing detected paths
   migrate to `external`; only an install completed by Wingosy becomes `managed`.
3. Generate a versioned `wingosy-retroarch.cfg` under Wingosy-owned app data for
   managed installs. Keep the first delta deliberately small:
   `config_save_on_exit = false` and `input_autodetect_enable = true`. Do not set
   global player binds, controller indices, save/state directories, renderer,
   shader, rewind, or automatic save/load state behavior.
4. Launch a managed installation with `--appendconfig=<absolute delta path>`.
   Leave external installations unchanged unless the user explicitly enables
   **Use Wingosy beta profile**; opting out restores the original launch path and
   never edits `retroarch.cfg`.
5. Add **Repair Wingosy RetroArch profile** in Settings. Repair backs up and
   regenerates only the generated delta and revalidates manifest-owned artifacts;
   it preserves RetroArch's main config, user autoconfigs/remaps, saves, states,
   BIOS, and external installations.
6. Add one focused test for manifest hash rejection and launcher tests proving
   managed/opted-in external installs append the delta while ordinary external
   installs do not. Test repair against sentinel user files that must survive.

## Verification and done criteria

- [x] Managed setup contains exactly the recorded RetroArch/core manifest and
      rejects a modified download before extraction.
- [x] No managed core download uses an unversioned `latest` URL.
- [x] The managed launch appends the Wingosy delta; an existing external launch
      is byte-for-byte unchanged unless explicitly opted in.
- [x] Repair restores the generated delta and preserves all sentinel user files.
- [x] `bun run test:unit`, `bun run typecheck`, and the relevant Rust tests pass.
- [x] No dependency is added solely to parse or generate the two-setting delta.

## STOP conditions

- Official distribution does not provide stable immutable core artifacts or a
  trustworthy digest source; vendor neither binaries nor guessed checksums.
- Implementing the delta would redirect active save/state paths without a proven
  migration. Leave those paths untouched and report the conflict.

## Maintenance notes

Update the manifest only with a new plan 006 Windows certification run. Add a
delta setting only to fix a reproduced beta problem; the small overlay is the
feature.

## Comments

### 2026-08-24 — Blocked by missing official digest provenance

On 2026-08-24, the official versioned Windows x86_64 directory index at
<https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/> was checked. It
listed `RetroArch-Win64-setup.exe`, `RetroArch.7z`, and `RetroArch_cores.7z`:

- Setup artifact: <https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch-Win64-setup.exe>
- RetroArch artifact: <https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch.7z>
- RetroArch cores artifact: <https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch_cores.7z>

Requests to the conventional sibling `.sha256` URLs returned HTTP 404:

- <https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch.7z.sha256>
- <https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch_cores.7z.sha256>

The directory linked no checksum manifest or signature, and a search of
official RetroArch/libretro download sources found no digest source. This
triggers the STOP condition above. Existing hard-coded hashes are not
certified. Work can resume when a maintainer provides a trustworthy digest or
certification source.

### 2026-08-24 — Trust model approved

The user approved treating SHA-256 values computed from official versioned HTTPS
artifacts during a Wingosy certification run as Wingosy-certified manifest
values. Manifest updates require a reviewed PR and certification. Managed
installs must not follow `latest`.

### 2026-08-24 — Completed

Implementation is complete: the managed profile uses a pinned Wingosy-certified
RetroArch 1.19.1/core bundle, records installed executable and core hashes, and
rejects modified managed artifacts. Ownership is persisted as `managed` or
`external`; managed and explicitly opted-in external launches use the generated
delta, while ordinary external launches remain unchanged. The delta contains
exactly `config_save_on_exit = false` and `input_autodetect_enable = true`, and
the appendconfig policy leaves user configuration untouched. Settings and the
command both support repairing the managed profile; repair regenerates only the
delta and the tests verify preservation of sentinel user files.

Certification evidence from official versioned HTTPS downloads on 2026-08-24:

- `RetroArch.7z` SHA-256: `49b13c10a8962c82b8dbffb6524f49d824a264c58e6d6ec4f27934d110168600`
- `RetroArch_cores.7z` SHA-256: `4384854038d3e2a85cae6563e3a78ba7a8c0696fc6e1f9f4a0e6b8044cef8d92`
- `retroarch.exe` SHA-256: `738ca659d2360cedbc62bab7b53c6e9bb20c7d92dfe3de743fa4f3b1fa218e7b`
- All five unique core DLL hashes in source were independently extracted and matched.

Verification:

- `mise exec -- bunx vitest run src/components/Settings.test.jsx` passed 4/4.
- `mise exec -- bun run test:unit` passed 46/46 across 9 files.
- `mise exec -- bun run typecheck` passed.
- `git diff --check` passed.
- Rust tests could not compile on Linux because `javascriptcoregtk-4.1` and
  `libsoup-3.0` system packages are missing; Windows cargo check is blocked
  because `x86_64-w64-mingw32-gcc` is absent.
- `/code-review` was run and confirmed the findings were fixed.

### 2026-08-24 — Reopened after completed-task audit

Per-core manifest shape and launch-time hash validation/data-preserving install
concerns remain open, and Rust/Windows verification is pending.

### 2026-08-25 — Follow-up implementation claimed

- [x] Re-read the ticket, roadmap, tracker rules, and relevant implementation surface.
- [x] Resolve the per-core manifest and managed-artifact validation concerns.
- [x] Preserve user-owned install data and the managed/external launch policy in code and focused tests.
- [x] Run focused and full available verification.
- [x] Complete an independent code review and resolve the ticket.

## Answer

Resolved the completed-task audit concerns. Each promised core now records the
pinned bundle URL and bundle SHA-256 separately from its installed DLL SHA-256.
Managed installs stage and validate the frontend and cores before replacing
Wingosy-owned files, remove stale managed files, and preserve RetroArch user
configuration, autoconfigs, remaps, saves, states, and BIOS/system data.

Managed launch paths validate artifacts before profile generation, BIOS work,
save sync, or process start. Managed and opted-in external standalone/game
launches append the Wingosy delta; ordinary external launches remain unchanged.
Profile repair writes the generated delta atomically and keeps its backup.

Verification on 2026-08-25:

- `mise exec -- cargo test --manifest-path src-tauri/Cargo.toml --bin wingosy-launcher retroarch` passed 34 tests with 1 ignored.
- `mise exec -- cargo check --manifest-path src-tauri/Cargo.toml --bin wingosy-launcher` passed.
- `mise exec -- cargo test --manifest-path src-tauri/Cargo.toml --bin wingosy-launcher` passed 266 tests with 1 ignored.
- `mise exec -- bun run typecheck` passed.
- `mise exec -- bun run test:unit` passed 74 tests across 11 files.
- `git diff --check` passed.
- Independent standards/spec reviews were completed; their blocking findings were fixed and the final confirmation review passed.

Native Windows certification remains part of plan 06 rather than this code task.
