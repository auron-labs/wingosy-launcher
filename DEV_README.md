# Development readme

Informal backlog and QA checklist — not shipped in the installer; for contributors tracking what to verify next.

## Todo list

1. **Emulators:** Test and support **all available platform emulators** and **RetroArch** (detection, install, cores, launches, per-platform defaults). Cover the platforms and emulators surfaced in Settings and docs.

   **RetroArch mapped-core checklist (each core verified separately):** Wingosy maps each platform id to exactly one libretro core DLL via `retroarch_cores()` — check each line off only after you’ve verified **install + launch** for that platform.
   - [ ] **nes** → `fceumm_libretro.dll`
   - [ ] **snes** → `snes9x_libretro.dll`
   - [ ] **n64** → `mupen64plus_next_libretro.dll`
   - [ ] **gb** → `gambatte_libretro.dll`
   - [ ] **gbc** → `gambatte_libretro.dll`
   - [ ] **gba** → `mgba_libretro.dll`
   - [ ] **nds** → `melonds_libretro.dll`
   - [ ] **genesis** → `genesis_plus_gx_libretro.dll`
   - [ ] **psx** → `pcsx_rearmed_libretro.dll`
   - [ ] **dreamcast** → `flycast_libretro.dll`
   - [ ] **psp** → `ppsspp_libretro.dll`
   - [ ] **arcade** → `mame_libretro.dll`

   **Buildbot validation (network; can be large downloads):** validates every distinct `*_libretro.dll` above against Libretro buildbot (sanity check, separate from the per-core launch checklist):

   `bun run test:rust:cores`

   See `TESTING.md` for details/troubleshooting.
2. **Save sync:** Test **save sync** against RomM (listing saves, upload, download, and local integration with launches).

3. **Immersive fullscreen (Big Picture), controller‑native UX:** Extend `useGamepadKeyboardMapper` with view‑aware shortcuts (beyond D‑pad → arrows / A→Enter / B→Escape / LB‑RB→sections / Start→settings / Back→hints). Target behavior when implemented:
   - **Library:** face **X** → Downloads; emulate **`d`**/`D` on the library root for keyboards; **`S`/Menu** still opens Settings (ensure non‑library views route Start to Settings the same way).
   - **Game details:** **Y** → toggle favorite; **X** → download / re‑download when RomM allows; **`S`** opens Settings.
   - **Global in immersive:** **L3** (left‑stick click) toggles OS fullscreen (same intent as **F11**); respect open dialogs/menus before favoriting or downloading.
   - Prefer a small **`CustomEvent`** (e.g. `wingosy-immersive-gamepad` with `{ action }`) for actions that are not literal key spoofing; keep `ImmersiveHintBar` in sync.

_Add sub-bullets, dates, or PR links below as items are completed._

- **Done (2026-05):** **Tauri v2** migration — tightened `capabilities/default.json` + `assetProtocol` scopes; **signed updater** (`plugins.updater`, `install_signed_app_update`, `latest.json` upload in release/beta/nightly workflows). Configure **`TAURI_SIGNING_PRIVATE_KEY`** (+ optional **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`**) in GitHub Actions and for local `tauri build` — see [CONTRIBUTING.md](CONTRIBUTING.md#signed-in-app-updates-tauri-v2-updater).
