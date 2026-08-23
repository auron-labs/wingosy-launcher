# Wingosy Launcher

[![Build](https://img.shields.io/github/actions/workflow/status/yash-1o1/wingosy-launcher/nightly.yml?branch=main&label=build&logo=github)](https://github.com/yash-1o1/wingosy-launcher/actions/workflows/nightly.yml?query=branch%3Amain)
[![Release](https://img.shields.io/github/v/release/yash-1o1/wingosy-launcher?label=release)](https://github.com/yash-1o1/wingosy-launcher/releases/latest)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-0078D6?logo=windows&logoColor=white)](README.md#requirements)

A Windows game launcher with RomM integration. Inspired by [Argosy Launcher](https://github.com/rommapp/argosy-launcher), with the goal of closely following Argosy's feature implementations.

## Features

- **RomM Integration** — Sync library, covers, saves from [RomM](https://github.com/rommapp/romm)
- **20+ Platforms** — NES, SNES, N64, GameCube, Wii, PlayStation 1-3, PSP, and more
- **Emulator Management** — Auto-detect, download, and configure emulators
- **ROM Downloads** — Download ROMs directly from RomM
- **Game Launching** — Launch with preferred emulator, per-game overrides

## Quick Start

1. Download from [Releases](https://github.com/yash-1o1/wingosy-launcher/releases).
2. Run the setup wizard.
3. Connect to RomM or scan local ROMs.
4. Start playing!

## Requirements

- Windows 10/11
- [RomM](https://github.com/rommapp/romm) v4.x (for sync features)

## Run from source

Development requires Bun 1.3.14+, a current Rust toolchain, and the Visual
Studio C++ Build Tools. Make sure `bun` and `cargo` are both
available in the same PowerShell window:

```powershell
bun --version
cargo -v
```

Clone, install, and launch the native desktop app:

```powershell
git clone https://github.com/yash-1o1/wingosy-launcher.git
cd wingosy-launcher
bun install
bun run dev
```

The first Rust debug build can take a few minutes. Leave the command running
until the **Wingosy Launcher** window opens. `bun run dev:web` starts only the
browser frontend; use `bun run dev` (or `bun run tauri dev`) for the Windows
desktop application.

If PowerShell reports that `bun` or `cargo` is not recognized, install the
missing tool or reopen the terminal after updating `Path`. See
[CONTRIBUTING.md](CONTRIBUTING.md#setup) for detailed setup and troubleshooting.

## Storage Locations

Wingosy stores its managed files in the current Windows user's application-data
folders. `%APPDATA%` normally expands to
`C:\Users\<username>\AppData\Roaming`, while `%LOCALAPPDATA%` normally expands
to `C:\Users\<username>\AppData\Local`.

### Wingosy-managed folders

| Content | Default location |
| --- | --- |
| Configuration | `%APPDATA%\wingosy\launcher\config\config.toml` |
| Data root | `%APPDATA%\wingosy\launcher\data\` |
| Database | `%APPDATA%\wingosy\launcher\data\wingosy.db` |
| Emulators | `%APPDATA%\wingosy\launcher\data\emulators\<emulator-id>\` |
| ROMs | `%APPDATA%\wingosy\launcher\data\roms\<platform-id>\` |
| BIOS staging library | `%APPDATA%\wingosy\launcher\data\bios\<RomM-platform-slug>\` |
| Manually downloaded saves | `%APPDATA%\wingosy\launcher\data\saves\` |
| Save-sync cache and backups | `%APPDATA%\wingosy\launcher\data\save_sync_cache\` |
| Logs | `%APPDATA%\wingosy\launcher\data\logs\` |
| Covers | `%LOCALAPPDATA%\wingosy\launcher\cache\covers\` |
| General downloads | `%APPDATA%\wingosy\launcher\data\downloads\` |

The general downloads folder is reserved by Wingosy but is not currently used
for emulator installation archives. Those archives are downloaded temporarily
beside the managed emulator folders, extracted, and removed after installation.

The ROM and BIOS roots can be changed in **Settings > Storage** and
**Settings > BIOS**, respectively. Downloaded ROMs are organized beneath the
selected ROM root by Wingosy platform ID, such as `nes`, `snes`, `gba`, `gc`,
`switch`, `psx`, or `ps2`.

When the ROM root changes, Wingosy asks whether to migrate tracked ROMs or use
the new folder only for future downloads. Migration preserves the platform
subfolders, updates each library path, and removes an old copy only after the
new copy and database update succeed. Existing destination files are never
overwritten. Folder changes are blocked while a ROM download is active, so a
download cannot be split between the old and new roots.

### Emulators and RetroArch cores

An emulator downloaded by Wingosy is extracted to:

```text
%APPDATA%\wingosy\launcher\data\emulators\<emulator-id>\
```

Examples of emulator IDs include `retroarch`, `dolphin`, `pcsx2`, `rpcs3`,
`ppsspp`, `duckstation`, `cemu`, `eden`, `citra`, `melonds`, `mgba`,
`flycast`, `xemu`, `xenia`, and `mame`.

RetroArch cores are installed in the `cores` folder of the detected RetroArch
installation. For a Wingosy-managed RetroArch installation, that is normally:

```text
%APPDATA%\wingosy\launcher\data\emulators\retroarch\cores\
```

If Wingosy detects an emulator installed somewhere else, it records and uses
that existing executable instead of moving it into the Wingosy data folder.

### Game saves

Most save files remain in the location selected by the emulator. Wingosy does
not currently impose one common save directory on every emulator.

For RetroArch, Wingosy's save-sync resolver checks these locations for `.srm`
and `.sav` files:

```text
<RetroArch directory>\saves\<core-name>\<ROM-name>.srm
<RetroArch directory>\saves\<ROM-name>.srm
%APPDATA%\RetroArch\saves\<core-name>\<ROM-name>.srm
%LOCALAPPDATA%\RetroArch\saves\<core-name>\<ROM-name>.srm
```

The same locations are checked with the `.sav` extension. RetroArch save states
such as `.state` files are not currently included in automatic save sync.

For Switch games, Wingosy checks Eden's portable save folders first and then
its standard Windows location:

```text
<Eden directory>\user\nand\user\save\
<Eden directory>\nand\user\save\
%APPDATA%\Eden\nand\user\save\
```

The exact per-game directory below Eden's save root is resolved from the
Switch title ID. A custom Eden save root can also be recorded in Wingosy's
configuration.

The **Download save** action for a generic/manual RomM save writes the file to:

```text
%APPDATA%\wingosy\launcher\data\saves\save_<romm-id>_<save-id>.sav
```

This manual download location is separate from an emulator's active save
folder. Automatic path-aware RomM save sync currently has explicit local-path
handling for RetroArch and Eden; other emulators continue to manage their own
save locations.

### BIOS and firmware

Firmware downloaded from the connected RomM server is first stored in the BIOS
staging library:

```text
<BIOS root>\<RomM-platform-slug>\<firmware-file>
```

With the default BIOS root, this becomes
`%APPDATA%\wingosy\launcher\data\bios\<RomM-platform-slug>\<firmware-file>`.
The **Distribute BIOS** action copies compatible files from that library to
known folders for configured emulators:

| Emulator | Distribution location |
| --- | --- |
| RetroArch | `<RetroArch directory>\system\` |
| DuckStation | `<DuckStation directory>\bios\` |
| PCSX2 | `<PCSX2 directory>\bios\` |
| melonDS | Directory containing `melonDS.exe` |
| Flycast | `<Flycast directory>\data\` |
| mGBA | Directory containing `mGBA.exe` |
| Eden | `prod.keys` in Eden's `keys\` directory and firmware `.nca` files in `nand\system\Contents\registered\` |

Automatic BIOS distribution is not currently defined for the other supported
emulators. Their firmware must be configured through the emulator when needed.
For Eden, upload user-dumped `prod.keys` and `firmware.zip` to RomM under the
`switch` platform. Wingosy validates the key file and archive structure before
checking that the keys can decrypt the firmware, then installs them into Eden's
portable data directory or `%APPDATA%\Eden`.

### Shaders

Wingosy does not currently download, select, distribute, or synchronize
shaders. A managed RetroArch package normally keeps its shader libraries under
the RetroArch installation, for example:

```text
<RetroArch directory>\shaders\
<RetroArch directory>\shaders_glsl\
<RetroArch directory>\shaders_slang\
```

Shader selection and shader preset storage remain controlled by RetroArch or
the individual emulator.

## Supported Emulators

| Emulator | Platform(s) | Download | Launch Intent | Save Sync (Wingosy) | Save Sync ([Argosy](https://github.com/rommapp/argosy-launcher)) |
| --- | --- | :---: | :---: | :---: | :---: |
| RetroArch (FCEUmm core) | NES | ⬜ | ⬜ | ⬜ | ✅ |
| RetroArch (Snes9x core) | SNES | ⬜ | ⬜ | ⬜ | ✅ |
| RetroArch (Mupen64Plus-Next core) | Nintendo 64 | ⬜ | ⬜ | ⬜ | ✅ |
| RetroArch (Gambatte core) | Game Boy | ⬜ | ⬜ | ⬜ | ✅ |
| RetroArch (Gambatte core) | Game Boy Color | ⬜ | ⬜ | ⬜ | ✅ |
| RetroArch (mGBA core) | Game Boy Advance | ⬜ | ⬜ | ⬜ | ✅ |
| RetroArch (melonDS core) | Nintendo DS | ⬜ | ⬜ | ⬜ | ✅ |
| RetroArch (Genesis Plus GX core) | Genesis / Mega Drive | ⬜ | ⬜ | ⬜ | ✅ |
| RetroArch (PCSX-ReARMed core) | PlayStation 1 | ⬜ | ⬜ | ⬜ | ✅ |
| RetroArch (Flycast core) | Dreamcast | ⬜ | ⬜ | ⬜ | ✅ |
| RetroArch (PPSSPP core) | PSP | ⬜ | ⬜ | ⬜ | ✅ |
| RetroArch (MAME core) | Arcade | ⬜ | ⬜ | ⬜ | ✅ |
| mGBA | Game Boy / GBC / GBA | ✅ | ✅ | ⬜ | ✅ |
| Dolphin | GameCube / Wii | ⬜ | ⬜ | ⬜ | ✅ |
| PCSX2 | PlayStation 2 | ⬜ | ⬜ | ⬜ | ✅ |
| RPCS3 | PlayStation 3 | ⬜ | ⬜ | ⬜ | ⬜ |
| PPSSPP | PSP | ⬜ | ⬜ | ⬜ | ✅ |
| DuckStation | PlayStation 1 | ⬜ | ⬜ | ⬜ | ⬜ |
| Cemu | Wii U | ⬜ | ⬜ | ⬜ | ✅ |
| Eden | Switch | ⬜ | ⬜ | ⬜ | ✅ |
| melonDS | Nintendo DS | ⬜ | ⬜ | ⬜ | ✅ |
| Lime3DS | Nintendo 3DS | ⬜ | ⬜ | ⬜ | ✅ |
| Flycast | Dreamcast | ⬜ | ⬜ | ⬜ | ⬜ |
| xemu | Xbox | ⬜ | ⬜ | ⬜ | ⬜ |
| Xenia | Xbox 360 | ⬜ | ⬜ | ⬜ | ⬜ |
| MAME | Arcade | ⬜ | ⬜ | ⬜ | ⬜ |

✅ = implemented · ⬜ = planned

**Save Sync (Argosy):** automatic bidirectional RomM save sync (negotiator API, pre/post-launch). Marked ✅ when [Argosy](https://github.com/rommapp/argosy-launcher) has save-path support for that emulator or RetroArch core on Android. **Save Sync (Wingosy):** manual list/upload/download in game details only (no automatic sync yet).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.
