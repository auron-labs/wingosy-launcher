# Emulator configuration and controller patterns for the private beta

Research date: 2026-08-23. Scope: Windows 11 Wingosy (Tauri v2/React/Rust),
the six promised RetroArch platforms (NES, SNES, GB, GBC, GBA, Genesis), and
the immersive launcher UI. This is a recommendation note, not a support
expansion beyond that contract.

## Recommendation order

| Order | Recommendation | Effort | Why it belongs in beta |
| --- | --- | --- | --- |
| 1 | Launch a small, Wingosy-owned RetroArch delta configuration | M | Makes the certified path reproducible without overwriting an external install. |
| 2 | Keep controller profiles writable and provide one safe reset path | M | Gives an unsupported pad a recovery route without inventing a mapper. |
| 3 | Pin and certify one RetroArch/core artifact set | M | Prevents a moving core download from silently changing the tested emulator. |
| 4 | Only interpret W3C standard-mapped pads in immersive mode | S | Stops wrong button actions on an unknown controller and fixes brand-specific hints. |
| 5 | Add a small controller certification/recovery check | S | Turns “controller support” into an observable beta promise. |

## 1. Add a Wingosy-owned RetroArch delta, rather than editing an external configuration

**Local evidence.** The launch model supplies only `--fullscreen`, then adds
the selected core and ROM (`src-tauri/src/models/emulator.rs:55-70`,
`src-tauri/src/models/emulator.rs:23-42`). The launcher resolves cores beside
whichever executable was detected (`src-tauri/src/emulators/launcher.rs:78-100`),
and detection gives Steam and system installations priority over the managed
directory (`src-tauri/src/emulators/detection.rs:74-88`,
`src-tauri/src/emulators/detection.rs:17-19`). There is no persisted
installation ownership or RetroArch profile path in `EmulatorPaths`
(`src-tauri/src/config/mod.rs:281-304`).

**Primary-source pattern.** RetroArch officially supports
`--appendconfig=FILE`: it loads a delta after the selected/default config and
the delta takes priority; it can contain save and state directory settings
([RetroArch command-line source](https://github.com/libretro/RetroArch/blob/master/retroarch.c#L6754-L6785),
[save/state guidance in the same source](https://github.com/libretro/RetroArch/blob/master/retroarch.c#L6940-L6945)).
RetroDECK likewise separates component configuration from user data
([RetroDECK folder documentation](https://retrodeck.readthedocs.io/en/latest/wiki_development/general/folders-filepaths/)).

**User impact.** Every Wingosy-managed beta installation launches with the
same known settings, while an existing Steam/portable RetroArch configuration
is neither replaced nor “reset” by the launcher.

**Minimal fix sketch.** At managed RetroArch install, create one versioned
`wingosy-retroarch.cfg` below Wingosy data. At launch, append it with
`--appendconfig=<absolute path>`. Initially include only beta-owned directory
and input settings; do not force a controller index, renderer, shader,
latency, or per-core option. Store `retroarch_install_kind` (`managed` or
`external`) with the executable path. For external installs, either use no
delta or show an explicit opt-in “use Wingosy beta profile”; never write their
main config. Test the exact argv for both paths.

**Risk:** A delta can unexpectedly override a user preference if it grows.
Keep it small, visible, versioned, and resettable. **Confidence:** high.

## 2. Own a writable controller-profile/remap directory, preserve it on reset, and use RetroArch’s fallback instead of a custom remapper

**Local evidence.** Wingosy only checks whether the chosen core DLL exists
(`src-tauri/src/commands.rs:53-70` and `src-tauri/src/commands.rs:2593-2610`).
It does not configure an autoconfig or input-remapping directory. Its present
save resolver expects RetroArch’s normal/external locations
(`README.md:120-160`), so changing every RetroArch directory at once would
also disturb save-sync work.

**Primary-source pattern.** RetroArch’s controller-profile database
autoconfigures many known pads; on Windows, XInput controllers are documented
to work out of the box and unrecognised pads have a supported “Bind All” and
“Save Autoconfig” recovery path
([Windows input guide](https://docs.libretro.com/guides/install-windows/#gamepad-controls),
[input guide](https://docs.libretro.com/guides/input-and-controls/#controller-autoconfiguration)).
The upstream configuration documents that `joypad_autoconfig_dir` requires
autodetection and that explicit global binds outrank autoconfigs
([RetroArch default config](https://github.com/libretro/RetroArch/blob/master/retroarch.cfg#L373-L375),
[profile directory semantics](https://github.com/libretro/RetroArch/blob/master/retroarch.cfg#L812-L818)).
It also has native core/directory/game `.rmp` remaps with a clear precedence
order ([RetroArch overrides and remaps](https://docs.libretro.com/guides/overrides/#overrides-cfg--remaps-rmp)).

**User impact.** Xbox/XInput works with no setup; a Bluetooth or unusual pad
has a documented, durable self-service path. A controller fix does not
silently become a global binding that breaks another pad or core.

**Minimal fix sketch.** In the managed beta delta, set
`input_autodetect_enable = true`, `joypad_autoconfig_dir` to a writable
Wingosy data subdirectory, and `input_remapping_directory` to a separate
Wingosy data subdirectory. Never set `input_playerN_*` button/axis binds or a
hardcoded Player 1 index. Add two Settings actions only: **Open RetroArch
input setup** and **Reset Wingosy controller additions**. The reset deletes
only Wingosy’s generated delta and shipped profile additions after a backup;
it must leave user-created profiles/remaps intact. Leave per-game remaps to
RetroArch’s Quick Menu instead of building a Wingosy editor.

**Risk:** Moving the profile directory means existing external custom profiles
are not automatically found. Apply this only to the managed profile and make
the external-install choice explicit. **Confidence:** high.

## 3. Freeze the RetroArch/core pair that is certified, and verify it before enabling the six-platform beta promise

**Local evidence.** Wingosy downloads a fixed RetroArch archive while core
downloads use the unversioned `nightly/.../latest` endpoint
(`src-tauri/src/models/emulator.rs:55-70`,
`src-tauri/src/emulators/cores.rs:5-34`, `src-tauri/src/emulators/cores.rs:73-165`).
Readiness is currently only “mapped DLL is present,” not a version or artifact
identity check (`src-tauri/src/commands.rs:53-70`). The existing network test
also checks reachability of those moving URLs, rather than a beta release
artifact (`src-tauri/src/emulators/cores.rs:325-431`).

**Primary-source pattern.** RetroArch treats a core as the implementation
loaded through `-L` ([RetroArch command-line source](https://github.com/libretro/RetroArch/blob/master/retroarch.c#L6799-L6814)); therefore the tested
pair is the executable plus that core artifact, not merely a filename. EmuDeck
lists the exact RetroArch core configuration it owns and warns against using
global “save configuration on exit” as an easy way to accidentally change a
managed setup ([EmuDeck RetroArch documentation](https://github.com/EmuDeck/emudeck.github.io/blob/main/docs/emulators/steamos/retroarch.md#how-to-change-retroarch-global-settings)).

**User impact.** A user cannot pass setup one day and get a materially
different nightly core the next. Support can reproduce a reported beta
launch.

**Minimal fix sketch.** Replace the independent fixed-RetroArch/latest-core
URLs with one in-repo beta manifest: RetroArch version/archive digest plus the
six mapped core archive digests. Download to a temporary file, validate its
digest before extraction, and record the manifest version next to the managed
installation. Let external RetroArch remain supported only after the six
launch/controller checks pass; label it unverified until then. Keep the
existing DLL-presence test, but add a manifest identity assertion.

**Risk:** Someone must intentionally update the manifest. That is desirable at
beta scale; do it only with a new Windows certification run. **Confidence:**
high.

## 4. Make the immersive mapper standard-layout only and present actions by physical position

**Local evidence.** The mapper assumes Xbox/standard indices `0`, `1`, `4`,
`5`, `8`, `9`, and `12`–`15` for the first connected gamepad without looking
at `Gamepad.mapping` (`src/immersive/useGamepadKeyboardMapper.js:107-147`).
It then emits synthetic keyboard events globally and to the library
(`src/immersive/useGamepadKeyboardMapper.js:39-56`). The hint bar labels the
buttons “A” and “B” (`src/immersive/ImmersiveHintBar.jsx:33-60`) even though
those letter labels vary by controller family. The application enables this
mapper unconditionally for immersive mode (`src/immersive/ImmersiveModeApp.jsx:66`),
and its shell already defers hotkeys while dialogs and menus own input
(`src/immersive/ImmersiveModeApp.jsx:150-191`).

**Primary-source pattern.** The W3C Gamepad specification states that the
browser sets `mapping` to `"standard"` only when a device corresponds to the
canonical layout, with fixed button/axis positions
([mapping selection](https://www.w3.org/TR/gamepad/#dom-gamepad-mapping),
[standard layout table](https://www.w3.org/TR/gamepad/#remapping)).
It also recommends animation-frame polling, which the current hook already
uses ([W3C polling guidance](https://www.w3.org/TR/gamepad/#best-practice-1-coordination-with-requestanimationframe)).

**User impact.** A wheel, fight stick, or unrecognised controller does not
accidentally press Play/Exit. Xbox, PlayStation, and Nintendo users see
controller-neutral intent rather than misleading letters.

**Minimal fix sketch.** Select the first connected pad whose
`mapping === "standard"`; do nothing for unrecognised mappings and expose a
short “use a standard/XInput controller or keyboard” status in immersive
settings. Rename hints to physical intent such as **South / Enter — Open** and
**East / Esc — Back**, or choose a glyph only after an explicit supported
family detector. Preserve the existing dialog/menu suppression. Add one
focused unit test that drives fake `navigator.getGamepads()` values: a standard
pad emits one intent; a non-standard first pad is skipped in favour of a
standard second pad; no pad emits nothing.

**Risk:** Some usable but non-standard pads will no longer control the
launcher; that is safer than sending wrong actions. Their games can still use
RetroArch’s native input setup. **Confidence:** high.

## 5. Certify one controller path and expose a recovery route; do not copy the Steam Deck stack

**Local evidence.** The immersive tests exercise handlers after manually
dispatching keyboard events (`src/immersive/ImmersiveGameDetails.test.jsx:40-50`,
`src/immersive/ImmersiveGameDetails.test.jsx:119-150`), while the app-level
test replaces the mapper with a no-op (`src/immersive/ImmersiveModeApp.test.jsx:32-34`).
There is no proof that a real Gamepad API frame results in the intended UI
action or that a controller works after RetroArch starts. The existing dev
checklist already identifies controller-native navigation as future scope
(`DEV_README.md:30-34`).

**Primary-source pattern.** RetroArch documents the correct Windows baseline:
XInput works out of the box, many common pads autoconfigure, and saving an
autoconfig after binding allows later hot-plug use
([Libretro Windows guide](https://docs.libretro.com/guides/install-windows/#gamepad-controls)).
RetroDECK’s larger Steam Input template system is platform-specific and
requires adding the app to Steam and applying templates
([RetroDECK controller hotkeys](https://retrodeck.readthedocs.io/en/latest/wiki_rd_controls/hotkeys-retrodeck/)); it is not a suitable dependency for this
native Windows beta.

**User impact.** Testers get a clear answer: the supported path is a standard
or XInput controller, immersive navigation, RetroArch play, and safe return;
otherwise they get a single documented recovery route rather than improvised
configuration files.

**Minimal fix sketch.** Add a beta release-gate case using a wired or Bluetooth
XInput controller: navigate library → details → Play → RetroArch menu → exit →
return to the same selected game. Record the Windows build, controller family,
transport, RetroArch manifest, and the six core results. Include one second
pad only for a hot-plug/autoconfig smoke check. In Settings/help, point failures
to RetroArch **Input → RetroPad Binds → Port 1 → Set All Controls → Save
Controller Profile** and the Wingosy-only reset described above. Do not add
Steam Input dependency, cloud profiles, a radial menu, haptics, multiplayer UI,
or controller-specific in-app rebinding before beta evidence requires it.

**Risk:** This deliberately does not promise every controller. **Confidence:**
high.

## Explicitly rejected for the private beta

- **Per-emulator tuning and controller profile packs:** the beta certifies one
  emulator family. RetroArch already supports small core/content deltas, so
  create them only for a reproduced compatibility problem, not pre-emptively.
- **Steam Input as a required layer:** RetroDECK’s templates solve SteamOS
  needs, but require Steam setup and can be changed outside Wingosy. Keep
  Wingosy native; Steam users may opt in themselves.
- **Global “hotkey button” combinations for save/load/quit:** they are easy to
  trigger during gameplay. Retain RetroArch’s own menu/hotkey configuration
  until actual tester evidence identifies a safe, necessary chord.
- **Cloud-synchronised controller profiles, radial menus, haptics, and a
  controller editor:** none improves the initial single-player six-core loop
  enough to justify their failure modes.

## Source quality

All external sources above are primary: official Libretro/RetroArch
documentation or source, the W3C Gamepad specification, and official
RetroDECK and EmuDeck documentation/source. No secondary articles were used.
