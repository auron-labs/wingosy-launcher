# Eden integration: controllers, launch, saves, and Switch content

Status: ready-for-agent

**Scope:** Eden only, Windows first. This bounded implementation specification does not change the application. Existing Eden installation/discovery remains in place; this effort does not repair the installer or add emulator update management.

## Problem Statement

Wingosy already selects and launches emulators, prepares BIOS and ROM data, and contains most of the RomM save negotiation flow. Eden still needs Wingosy controller setup/profile injection, launch-time display handling, safer save lifecycle/title identification, and a repeatable path for owned Switch updates and DLC from RomM.

The result should be one practical Eden flow: configure once in Wingosy, launch from the existing library or immersive flow, preserve automatic preparation and saves, and optionally sync content without manual copying or unsafe NAND mutation.

## Solution

Deliver three ordered, independently checkable slices through existing flows:

1. **Controller and launch:** capture one standard controller, persist its mapping by normalized SDL hardware GUID, inject a Wingosy-owned Eden profile before launch, and apply conditional fullscreen behavior.
2. **Automatic saves:** repair Eden path/title resolution and the existing pre/post RomM negotiation lifecycle without changing nonblocking warnings, conflicts, or retry behavior.
3. **Switch content:** classify authorized RomM child files as `update` or `dlc`, download safely, and register Wingosy-owned external content when Eden's supported contract is confirmed.

Reuse Settings, game launch, download progress, BIOS preparation, and save-sync controls. Do not create a readiness dashboard, wizard, background scheduler, or generic emulator framework. The mapping is simple enough for later reuse, but only Eden translation is implemented now.

## User Stories

1. **Configure once:** As a Wingosy user, I want to discover a standard controller, capture buttons, sticks, triggers, and D-pad in Settings, and save them by hardware identity, so that reconnecting the same model restores its mapping.
2. **Launch naturally:** As a Wingosy user, I want saved Eden controls applied from the desktop library or immersive mode, so that game selection, navigation, deadzone behavior, BIOS preparation, and user data remain intact.
3. **Respect display intent:** As a Wingosy user, I want Eden fullscreen to follow Wingosy's current fullscreen or immersive state at launch, so that a normal windowed launch does not force fullscreen.
4. **Keep saves safe:** As a Wingosy user, I want save negotiation before and after Eden actually runs, so that remote/local changes remain safe without silent conflict loss or a blocked launch when sync is unavailable.
5. **Keep content current:** As a Wingosy user, I want to sync authorized RomM update/DLC files from the existing game flow, so that I can see progress/result or retry guidance and have Eden load owned content without manual copying.

## Acceptance Criteria

### Controller and launch slice

- Settings discovers and captures one player-one standard controller mapping and persists it by normalized SDL GUID. The GUID is a model identity: identical models share a mapping; the runtime port is not persisted as a physical-unit identity.
- Reconnecting the same model restores its mapping; a different GUID does not inherit it. Browser Gamepad `id` is not authoritative for Eden identity.
- The native discovery/capture boundary produces the normalized GUID and live controls. A maintained SDL binding is selected only after a minimal packaging compatibility check; no standalone probe project is required.
- On Play, Wingosy creates or updates only its own Eden input profile and passes it to Eden. Existing user profiles and unrelated settings remain unchanged. A missing controller warns and uses Eden defaults; it does not block launch.
- Both `launch_game` and `prepare_and_launch_game` use current launch context. Eden receives fullscreen only when Wingosy is currently fullscreen **or** immersive. Normal windowed launch does not force fullscreen or overwrite Eden's display preference; no force-windowed promise or new preference is introduced.
- Existing Wingosy hide/restore behavior and other emulator launch behavior remain unchanged.

### Save slice

- When save sync is enabled, negotiation runs before launch and restores a newer remote save only before Eden starts. Post-launch negotiation runs after Eden has started and exited, including a non-zero exit, but not when process creation fails.
- Conflicts never silently overwrite either side. Offline, authentication, path, and transfer failures remain nonblocking warnings with durable pending status and retry on a later launch; a corresponding failure is not cleared until negotiation succeeds.
- Title identity uses trustworthy metadata when available, not only a filename. If identity cannot be resolved safely, the operation is explicitly skipped with status and does not write the wrong save. No mandatory container parser is introduced.
- Existing Eden save ZIP safety, backup/restore, RomM authentication, device identity, and user-provided keys/firmware ownership are preserved.

### Switch content slice

- Content work proceeds only when authenticated RomM metadata identifies categorized child files as `update` or `dlc`. If unsupported, the affected work is clearly blocked rather than completed with guessed endpoints or fake classification.
- Authorized downloads reuse complete unchanged files, track minimum identity/change information, and may retry failed transfers from scratch. Existing atomic download and expected-size validation are reused; range resumption and an unconditional hash-verification claim are not required.
- Content is promoted into Wingosy-owned, title-scoped storage and registered through Eden's supported `external_content_dirs` path only after validation against a real supported build. Registration is idempotent, preserves unrelated configuration, and never writes while Eden runs. A known-compatible categorized update/DLC must actually load and appear in Eden's Add-Ons/version view on the next launch; registration alone is not success.
- Wingosy does not claim programmatic Eden inventory or compatibility without a supported read path. No NAND crypto or installer reimplementation is used.

### Streamlined flow

- A user configures a controller once in Settings, then the saved profile is applied by Play. Existing BIOS and save preparation remains automatic and is not duplicated in a new dashboard.
- Existing game launch/download controls initiate content synchronization and show stage progress, completion, failure, and retry guidance. Normal success requires no manual copying or Eden configuration.
- Remote content is not silently downloaded on every launch; the existing game action is the explicit, reversible choice.

## Implementation Decisions

- Reuse the two existing launch commands and shared launch pipeline; add Eden preparation at the prelaunch boundary and keep game/emulator selection intact.
- Store a backward-compatible, emulator-neutral physical-control mapping in existing config persistence: one player, standard buttons, sticks, triggers, D-pad, start, select, and guide. Exclude gyro, motion, Joy-Con pairing, and per-game mappings.
- Use a small native discovery/capture boundary and choose a maintained SDL binding after the packaging check. Do not derive Eden GUIDs from browser strings or create a generic trait/adapter framework.
- Generate a deterministic Wingosy-owned Eden profile in Eden's actual config root, write it safely, and inject it immediately before launch. Reconnection may change the transient port without changing the saved mapping.
- Resolve Eden config, NAND, save, and external-content roots through one focused Eden resolver; keep unrelated emulator path behavior unchanged.
- Derive the Eden fullscreen argument from current Wingosy fullscreen/immersive state at both entry points. Preserve existing window restoration/display state and do not persist a second Eden fullscreen setting.
- Reuse existing Switch RomM negotiation and safe ZIP save flow. Move post negotiation to the started-process exit path, including non-zero exits, while retaining warnings and pending retry behavior.
- Use trusted title metadata first and safe explicit status when unresolved; do not guess from an ambiguous filename or require a new container parser.
- Reuse the existing RomM client boundary and atomic downloader for categorized content. Use minimum identity/change tracking rather than prescribing a new database, manifest, or history architecture.
- Register only Wingosy-owned external content and preserve unrelated Eden settings. Content sync is an explicit game-flow action, not a launch-time scheduler. Implement in order: controller/fullscreen, saves, then content; keep contract checks independent.

## Testing Decisions

Test behavior at existing high integration seams rather than duplicating stable internals:

- **Controller:** mapping persistence across reconnect, GUID isolation, profile serialization that preserves user data, safe replacement, and Eden-compatible translation. Keep existing navigation/deadzone behavior covered.
- **Launch/display:** exercise actual context through both entry points for fullscreen, immersive, and normal windowed branches. Assert resulting launch behavior, not only a value or static constant.
- **Saves:** use launch/save negotiation seams with temp save trees and a mock RomM boundary for pre/post decisions, newer remote/local data, conflicts, offline pending retry, non-zero exit, unresolved identity, and spawn failure. Retain ZIP traversal coverage.
- **Content:** use focused RomM metadata/download seams for classification, safe completion, unchanged-file reuse, retry-from-scratch, idempotent registration, unrelated-config preservation, and refusal to write while Eden runs. Do not duplicate downloader coverage.
- A golden profile fixture validates serialization but cannot prove a real Eden build accepts it. Do not add a live Forgejo test or broad redesign-driven suite.

### Minimal human checks

1. **Controller/launch:** on Windows, connect one supported controller, configure it, disconnect/reconnect it, and launch one owned Switch game from desktop and immersive entry points. Confirm Eden accepts the mapping, fullscreen follows current Wingosy state, and a normal windowed launch does not force fullscreen.
2. **Saves:** change a save during normal play, exit, and confirm reported upload success; relaunch and confirm prelaunch negotiation completes. A local relaunch does not prove a remote restore; that decision is covered by automated tests.
3. **Content, when enabled:** use one known owned RomM update or DLC, confirm successful sync, and confirm Eden's Add-Ons/version view recognizes it on the next launch. Do not induce a retry failure manually.

No second machine, save deletion, manual fault injection, or certification matrix is required.
Windows-first validation stays bounded and must not change other platform paths.

## Out of Scope

- Emulator version/update management, managed installer replacement, updater repair, or unattended installation. “Update” means Switch game update content, not Eden updates.
- Supporting other emulators now, a generic adapter/trait framework, or a future extraction milestone. The saved mapping may be reusable later, but only Eden translation ships here.
- Multiple controller slots, unique physical-unit aliases, gyro/motion, paired Joy-Con, rumble tuning, macros, turbo, and per-game mappings.
- Background save/content services, automatic remote content download on launch, or a new readiness dashboard/wizard.
- Automatic profile import, mandatory local-folder fallback, or manual file-copy deliverables.
- Download range resumption, speculative hash verification, or broad content uninstall/version UI.
- New sources for Switch keys/firmware, changes to existing configured-RomM keys/firmware preparation, or acquiring/distributing keys or firmware outside that existing boundary; also direct NAND mutation, NAND crypto, or Eden installer internals.
- Programmatic Eden inventory/compatibility claims without a supported read path.
- Broad UI redesign, unrelated platform changes, or a new general test suite.

## Further Notes

- Existing behavior to preserve includes selected per-game/platform emulator, navigation and
  deadzone settings, Wingosy hide/restore, user Eden profiles and settings, BIOS preparation,
  RomM auth/keys/firmware sources, save conflict safety, and pending retry state.
- The normalized SDL GUID is a reasonable first-pass hardware ID for model-level identity, not a
  unique physical-controller identifier. Identical models intentionally share mappings.
- Eden profile and external-content formats are implementation-facing contracts. Preserve user
  configuration and report errors Wingosy can observe; a future incompatible build requires an
  adapter update, with no promise of automatic rejection detection.
- Prior research was performed on 2026-09-07 against Eden `master` commit
  `11de2645411ba83e6fcf47bf30ae48a7ee6ae090`; the links below are citations of that research, not
  fresh validation for this specification.
- The [initial request and conversation history](./convo.md) is context only; this specification
  is the implementation boundary.

Prior research:

- [Eden command-line handbook][eden-cli]
- [Eden controller handbook][eden-controllers]
- [Eden input profile implementation][eden-profiles]
- [Eden SDL controller implementation][eden-sdl]
- [Eden generic config implementation][eden-config]
- [Eden Qt config implementation][eden-qt-config]
- [Eden save/storage handbook][eden-storage]
- [Eden update/DLC handbook][eden-content]
- [Eden stable releases][eden-releases]
- [Eden downloads][eden-downloads]
- [RomM 4.8.1 folder structure][romm-folders]

[eden-cli]: https://git.eden-emu.dev/eden-emu/eden/src/commit/11de2645411ba83e6fcf47bf30ae48a7ee6ae090/docs/user/CommandLine.md
[eden-controllers]: https://git.eden-emu.dev/eden-emu/eden/src/commit/11de2645411ba83e6fcf47bf30ae48a7ee6ae090/docs/user/Controllers.md
[eden-profiles]: https://git.eden-emu.dev/eden-emu/eden/src/commit/11de2645411ba83e6fcf47bf30ae48a7ee6ae090/src/yuzu/configuration/input_profiles.cpp
[eden-sdl]: https://git.eden-emu.dev/eden-emu/eden/src/commit/11de2645411ba83e6fcf47bf30ae48a7ee6ae090/src/input_common/drivers/sdl_driver.cpp
[eden-config]: https://git.eden-emu.dev/eden-emu/eden/src/commit/11de2645411ba83e6fcf47bf30ae48a7ee6ae090/src/frontend_common/config.cpp
[eden-qt-config]: https://git.eden-emu.dev/eden-emu/eden/src/commit/11de2645411ba83e6fcf47bf30ae48a7ee6ae090/src/qt_common/config/qt_config.cpp
[eden-storage]: https://git.eden-emu.dev/eden-emu/eden/src/commit/11de2645411ba83e6fcf47bf30ae48a7ee6ae090/docs/user/Storage.md
[eden-content]: https://git.eden-emu.dev/eden-emu/eden/src/commit/11de2645411ba83e6fcf47bf30ae48a7ee6ae090/docs/user/InstallingUpdatesDLC.md
[eden-releases]: https://git.eden-emu.dev/eden-emu/eden/releases
[eden-downloads]: https://eden-emu.dev/downloads/
[romm-folders]: https://docs.romm.app/4.8.1/Getting-Started/Folder-Structure/
