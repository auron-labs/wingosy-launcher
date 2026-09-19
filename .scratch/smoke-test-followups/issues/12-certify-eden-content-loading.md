# 12 — Certify Eden update and DLC loading

**What to build:** Complete the residual Windows certification that a known owned update or DLC synced by Wingosy is recognized by Eden on the next launch.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Sync the known Cuphead update from the disposable RomM fixture through Wingosy.
- [x] Launch Eden and confirm the update appears in Eden's Add-Ons or version view.
- [x] Record the observed result without changing keys, firmware, drivers, or unrelated system settings.

## Answer

On 2026-09-19, Tauri MCP connected to the Windows development app and opened the existing downloaded Cuphead fixture. **Sync Updates & DLC** completed successfully with `0 downloaded, 1 reused`, and Wingosy reported that the content was registered for Eden's next launch.

Launching Cuphead through Wingosy then opened the managed Eden v0.2.1 build with the window title `Eden | v0.2.1 | Clang 22.1.4 | Cuphead (64-bit) | 1.3.7 | Nvidia`. The reported Cuphead version `1.3.7` in Eden's version view certifies that the registered update was recognized on launch. No keys, firmware, drivers, or unrelated system settings were changed.
