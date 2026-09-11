# 04 — Restore Wingosy focus after Eden exits

**What to build:** Return focus and the prior display state to Wingosy after a started Eden process exits, including a non-zero exit.

**Blocked by:** None — can start immediately.

**Status:** ready-for-human

- [ ] Wingosy regains focus after a normal Eden exit.
- [ ] Wingosy also restores after a non-zero Eden exit.
- [ ] The pre-launch fullscreen or windowed state is restored.
- [ ] Tauri MCP verifies Wingosy's observable focus and window state around a controllable Eden process exit.

## Comments

- 2026-09-11: Claimed after resolving Favorites navigation. One Luna xhigh worker per acceptance item, followed by fresh Luna xhigh verification. The live smoke will use Tauri MCP and a disposable controllable process, without claiming real Windows/Eden certification.
- 2026-09-11: Item 2's existing lifecycle implementation assessed by `s04_nonzero_luna` and independently tested by `s04_nonzero_verify_luna`: `launch_lifecycle_completes_after_successful_and_failed_process_exit` passed (1 test, exit codes 0 and 7), proving completion/restoration actions occur after process exit and before success/failure branching. No code change was needed. The checkbox remains open pending observable native-window focus evidence; callback assertions alone do not prove OS focus.
- 2026-09-11: Item 1's existing code assessed by `s04_normal_luna`, independently verified by `s04_normal_verify_luna`: restoration is captured immediately before launch and runs after child exit, with an idempotent Drop fallback. No source change was justified. The normal worker's duplicate-app smoke targeted the wrong bridge and was discarded; native focus remains unproven.
- 2026-09-11: Item 3's state-capture contract assessed by `s04_display_luna`, independently verified by `s04_display_verify_luna`; the three focused `window_restoration` tests passed. Actual fullscreen transitions remain blocked because the available Xvfb session has no window manager. No speculative Windows-only change was made.
- 2026-09-11: `s04_tauri_luna` subsequently observed a valid windowed exit-0 run through the real launch command: Wingosy lost focus while the controllable Eden fixture ran, then returned focused/visible with a successful exit-0 result. Fresh `s04_tauri_verify_luna` verification is pending; unchecked native requirements are retained, and the code queue continues under the user's explicit instruction.
- 2026-09-11: Fresh `s04_tauri_verify_luna` replay confirmed a successful exit-0 result and a focused, visible 1280×720 window afterward, but its during-run polls were also focused, so it did not independently establish focus loss/regain. The bridge then refused the exit-7 replay. The disposable Eden script was restored to exit 0. All native acceptance checkboxes remain open; complete them on a persistent desktop session with observable focus transitions and a window manager. No real Windows/Eden certification is claimed.
