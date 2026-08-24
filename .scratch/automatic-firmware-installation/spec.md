# Automatic Launch-Time BIOS and Firmware Installation

## Scope

When the user presses Play, Wingosy prepares required launch artifacts before
starting the selected emulator.

- For a configured emulator with a real executable, download only relevant BIOS
  files hosted by the user's configured RomM, validate them, install them using
  supported destination mappings, and launch only after required preparation
  succeeds.
- The initial generic mappings are limited to RetroArch, DuckStation, PCSX2,
  melonDS, Flycast, and mGBA.
- Repeated launches reuse a valid existing cache rather than downloading again.
- Switch Play through the selected Eden instance prepares the user's RomM-hosted
  `prod.keys` and firmware archive, validates their compatibility, installs them
  safely into that Eden instance, and then launches.
- Preparation progress is visible in both the desktop and immersive launch UI.

## Defaults

- Preparation is scoped to the selected configured emulator and its real
  executable, not every emulator or every BIOS in the RomM library.
- Existing validation, cache, scoped download, integrity, and path checks remain
  the default safeguards.
- Unsupported, unconfigured, or stale targets receive no writes.
- Required preparation failures stop the launch and show an actionable error.
- Existing manual BIOS controls remain available as the repair and retry path.
- Automatic Switch preparation is only for the selected Eden instance and the
  user's configured RomM artifacts.

## Security and Legal Boundary

- Never bundle proprietary BIOS, keys, or firmware files in Wingosy.
- Never source proprietary artifacts from anywhere outside the user's configured
  RomM.
- Installation must not write to an unsupported, unconfigured, or stale target,
  and must not cross Eden instance boundaries.
- Missing, invalid, or incompatible user-hosted artifacts fail closed before
  process spawn.

## Non-goals

- Adding generic mappings for emulators outside the six approved mappings.
- Acquiring BIOS, keys, or firmware from vendor, third-party, or bundled sources.
- Replacing the existing manual BIOS controls.
- Background downloads, broad emulator provisioning, or automatic management of
  unrelated emulator files.

## Dependency Graph

| Number | Title | Blocked by |
|---|---|---|
| 01 | Prepare BIOS automatically before launch | None |
| 02 | Prepare Switch firmware automatically for Eden | 01 |

Ticket 01 establishes the launch-time preparation and fail-closed behavior that
ticket 02 extends to Eden's Switch artifacts.
