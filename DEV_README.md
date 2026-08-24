# Development readme

Informal backlog and QA checklist — not shipped in the installer; for contributors tracking what to verify next.

## Private Beta Contract

The first beta is Windows 11 only: **RetroArch for NES, SNES, GB, GBC, GBA,
and Genesis**, with RomM pair, library sync, ROM download, and one-Play. Save
behavior must be documented as **manual save** upload/download; automatic save
sync is experimental until a real round trip passes. The six rows below are the
beta-critical core rows and remain pending real Windows certification. Standalone
mGBA and all other emulator/platform combinations are experimental.

## Todo list

1. **Emulators:** Test all platform/emulator rows surfaced in Settings and docs, including **RetroArch** (detection, install, cores, launches, and per-platform defaults). Only the six beta-critical rows block the first beta; all other rows remain experimental/not supported.

   **RetroArch mapped-core checklist (each core verified separately):** Wingosy maps each platform id to exactly one libretro core DLL via `retroarch_cores()` — check each line off only after you’ve verified **install + launch** for that platform.
   - [ ] **nes** → `fceumm_libretro.dll` (beta-critical)
   - [ ] **snes** → `snes9x_libretro.dll` (beta-critical)
   - [ ] **n64** → `mupen64plus_next_libretro.dll` (experimental)
   - [ ] **gb** → `gambatte_libretro.dll` (beta-critical)
   - [ ] **gbc** → `gambatte_libretro.dll` (beta-critical)
   - [ ] **gba** → `mgba_libretro.dll` (beta-critical)
   - [ ] **nds** → `melonds_libretro.dll` (experimental)
   - [ ] **genesis** → `genesis_plus_gx_libretro.dll` (beta-critical)
   - [ ] **psx** → `pcsx_rearmed_libretro.dll` (experimental)
   - [ ] **dreamcast** → `flycast_libretro.dll` (experimental)
   - [ ] **psp** → `ppsspp_libretro.dll` (experimental)
   - [ ] **arcade** → `mame_libretro.dll` (experimental)

   **Buildbot validation (network; can be large downloads):** validates every distinct `*_libretro.dll` above against Libretro buildbot (sanity check, separate from the per-core launch checklist):

   `bun run test:rust:cores`

   See `TESTING.md` for details/troubleshooting.
2. **Save sync:** Test **save sync** against RomM (listing saves, upload, download, and local integration with launches).

3. **Immersive fullscreen (Big Picture), controller‑native UX:** `useGamepadKeyboardMapper` accepts standard-mapped/XInput layouts only and routes controller-neutral intents through the existing keyboard event path. Unsupported pads are best-effort: use the keyboard or a standard/XInput controller for Immersive navigation. Target behavior when implemented:
   - **Library:** face **X** → Downloads; emulate **`d`**/`D` on the library root for keyboards; **`S`/Menu** still opens Settings (ensure non‑library views route Start to Settings the same way).
   - **Game details:** **Y** → toggle favorite; **X** → download / re‑download when RomM allows; **`S`** opens Settings.
    - **Global in immersive:** **L3** (left‑stick click) toggles OS fullscreen (same intent as **F11**); respect open dialogs/menus before favoriting or downloading.
    - Prefer a small **`CustomEvent`** (e.g. `wingosy-immersive-gamepad` with `{ action }`) for actions that are not literal key spoofing; keep `ImmersiveHintBar` in sync.
    - **Gameplay controller recovery:** use RetroArch **Input → RetroPad Binds → Port 1 → Set All Controls → Save Controller Profile** when a game needs a controller binding repair. Wingosy does not provide a mapping database or in-app rebinding UI.
    - **Stick drift:** Settings exposes the existing Immersive deadzone only, bounded to `0.1`–`0.8` and reset to `0.35`.

_Add sub-bullets, dates, or PR links below as items are completed._

- **Done (2026-05):** **Tauri v2** migration — tightened `capabilities/default.json` + `assetProtocol` scopes; **signed updater** (`plugins.updater`, `install_signed_app_update`, `latest.json` upload in release/beta/nightly workflows). Configure **`TAURI_SIGNING_PRIVATE_KEY`** (+ optional **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`**) in GitHub Actions and for local `tauri build` — see [CONTRIBUTING.md](CONTRIBUTING.md#signed-in-app-updates-tauri-v2-updater).
