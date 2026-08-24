# Manage a reproducible RetroArch profile

Type: task
Mode: agent
Status: needs-info
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

- [ ] Managed setup contains exactly the recorded RetroArch/core manifest and
      rejects a modified download before extraction.
- [ ] No managed core download uses an unversioned `latest` URL.
- [ ] The managed launch appends the Wingosy delta; an existing external launch
      is byte-for-byte unchanged unless explicitly opted in.
- [ ] Repair restores the generated delta and preserves all sentinel user files.
- [ ] `bun run test:unit`, `bun run typecheck`, and the relevant Rust tests pass.
- [ ] No dependency is added solely to parse or generate the two-setting delta.

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
