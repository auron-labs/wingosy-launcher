# Emulator Certification Ledger

This ledger records the evidence available for the first private-beta contract.
Source code, command-construction tests, mocked flows, and download checks are
not Windows runtime certification. Every runtime result in this restored Phase 1
matrix remains explicitly `NOT VERIFIED`.

## Classification

- **Private-beta promise, pending Windows certification:** RetroArch on NES, SNES,
  GB, GBC, GBA, and Genesis.
- **Experimental/not supported:** standalone mGBA for GB, GBC, and GBA.
- Every unlisted emulator/platform combination is experimental/not supported and
  absent because no certification evidence is recorded for it.

## Automated Evidence

| Evidence | Result | Limitation |
| --- | --- | --- |
| `build_retroarch_nes_command_uses_external_install_absolute_core_fullscreen_and_safe_rom_arg` | Source test | Does not run RetroArch or Windows content |
| `build_retroarch_mapped_platforms_use_external_layout_and_platform_defaults` | Source test | Does not run RetroArch or Windows content |
| `build_mgba_game_boy_family_commands_use_selected_install_and_fullscreen` | Source test | Does not run mGBA or Windows content |
| `test_retroarch_direct_download`, `test_retroarch_core_download` | Ignored download tests | Download/extraction is not emulator runtime certification |
| `test_github_release_download` | Ignored download test | Download/extraction is not mGBA runtime certification |
| `all_mapped_retroarch_core_buildbot_zips_are_valid` | Ignored buildbot check | Core ZIP validity is not emulator runtime certification |

## Phase 1 Runtime Matrix

| Emulator | Platform | Source evidence | Windows runtime |
| --- | --- | --- | --- |
| RetroArch (`fceumm_libretro.dll`) | NES | `build_retroarch_nes_command_uses_external_install_absolute_core_fullscreen_and_safe_rom_arg` | NOT VERIFIED |
| RetroArch (`snes9x_libretro.dll`) | SNES | `build_retroarch_mapped_platforms_use_external_layout_and_platform_defaults` | NOT VERIFIED |
| RetroArch (`gambatte_libretro.dll`) | GB | `build_retroarch_mapped_platforms_use_external_layout_and_platform_defaults` | NOT VERIFIED |
| RetroArch (`gambatte_libretro.dll`) | GBC | `build_retroarch_mapped_platforms_use_external_layout_and_platform_defaults` | NOT VERIFIED |
| RetroArch (`mgba_libretro.dll`) | GBA | `build_retroarch_mapped_platforms_use_external_layout_and_platform_defaults` | NOT VERIFIED |
| RetroArch (`genesis_plus_gx_libretro.dll`) | Genesis | `build_retroarch_mapped_platforms_use_external_layout_and_platform_defaults` | NOT VERIFIED |
| mGBA | GB | `build_mgba_game_boy_family_commands_use_selected_install_and_fullscreen` | NOT VERIFIED |
| mGBA | GBC | `build_mgba_game_boy_family_commands_use_selected_install_and_fullscreen` | NOT VERIFIED |
| mGBA | GBA | `build_mgba_game_boy_family_commands_use_selected_install_and_fullscreen` | NOT VERIFIED |

## Evidence Rules

Do not mark a row certified from a mocked executable, command construction,
source inspection, skipped WebDriver case, or download-only result. A row can
leave `NOT VERIFIED` only after a real Windows 11 run records the permitted
content, emulator/core version, launch and return result, and relevant save or
controller evidence.
