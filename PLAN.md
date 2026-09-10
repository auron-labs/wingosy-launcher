# Wingosy Computer-Use Test Plan

Last updated: 2026-09-09  
Tested build: app version `0.0.111`, commit `b6ade86` on `main`

## Purpose

Finish a computer-use smoke test of the recently added UI audit, immersive library discovery, Eden integration, and virtual gamepad features. Test observable user behaviour in the Windows desktop app; do not change source code while testing.

## Test environment and agreements

- Use the user's temporary RomM Docker instance and copied ROM library. It is disposable and contains no production data.
- RomM URL: `http://192.168.1.142:14400`
- RomM username: `testing`
- The password was supplied in the previous conversation but is intentionally not stored in this repository. Ask the user for it if pairing must be repeated.
- The synced library contained 141 games: 140 Super Nintendo games and Cuphead for Nintendo Switch.
- Cuphead has an update installed on RomM and is the Switch fixture for Eden content-sync testing.
- ViGEmBus is installed. There is no physical controller.
- The user approved changes made by Wingosy inside Wingosy AppData, its managed Eden profile, and disposable test saves.
- Do not modify anything else on the user's personal gaming PC without permission.
- Do not use Firefox or another workaround if native Computer Use cannot see Wingosy. Stop and tell the user.
- Ask for action-time confirmation before deleting a download, clearing history, disconnecting RomM, installing/running newly downloaded software, or accepting any destructive confirmation dialog.
- Do not source or alter Switch keys/firmware. If they are missing, record the resulting limitation.

## Resume setup

- [x] Start the Wingosy development app if it is not already running (`bun run dev`).
- [x] Connect Computer Use directly to the `Wingosy Launcher` window.
- [x] Confirm the app still opens on the existing paired library with 141 games.
- [ ] If pairing was lost, ask the user for the temporary password and repeat device pairing; hand any browser login step to the user.
- [x] Confirm the current theme is Dark and UI sounds are Off before continuing.

## Completed checks

### Setup and desktop library

- [x] Completed first-run setup against the temporary RomM instance.
- [x] Skipped the optional local ROM folder.
- [x] Synced 141 games successfully.
- [x] Verified the wide desktop grid uses the window width and shows titles, platform badges, cloud-only state, Play, and Favorite actions.
- [x] Verified `Ctrl+F` focuses search with a visible focus ring.
- [x] Verified mixed-case search (`cupHEAD`) finds Cuphead and Clear restores the full library.
- [x] Verified the Nintendo Switch filter returns only Cuphead.
- [x] Added Cuphead to Favorites as a temporary fixture and verified it appears in Favorites.

### Cuphead details

- [x] Verified the hero, title scrim, Nintendo Switch/RomM/Cloud-only chips, Favorite, and More controls are readable.
- [x] Verified the More menu contains working actions and no “Coming soon” placeholders.
- [x] Opened the screenshot lightbox; verified dimming, close/navigation hints, Right Arrow navigation from image 1 to 2, and Escape to close.
- [x] Verified the RetroAchievements off-state links to Settings → Integrations.
- [x] Verified the page has one Saves section and a single usable scroll region.

### Settings already covered

- [x] Verified the Settings shell has left navigation, no redundant Back action, a wide content panel, and a clear Connected RomM status.
- [x] General: verified beta copy, selectable app version, disabled Fullscreen explanation, controller deadzone value/reset, and F11/Escape hints.
- [x] Appearance: switched to Light and verified the app changed, then restored Dark.
- [x] Sound: verified disabled controls while UI sounds are Off; enabled them, used Tap Preview, then restored Off.
- [x] Integrations: verified Preview labelling, explanatory banner, and disabled RetroAchievements toggle.
- [x] RomM: verified the URL and authentication controls are disabled while connected with guidance to disconnect first.
- [x] RomM: clicked **Sync Library**. The post-sync timestamp/count was not observed before Computer Use disconnected, so verification remains below.

### Virtual gamepad preparation

- [x] Built the project-local virtual gamepad adapter successfully.
- [x] Ran its Windows smoke example normally and elevated.
- [x] Recorded both attempts failing with `Bus(TargetNotReady)` while creating the ViGEm target. Treat controller-driven navigation and Eden controller capture as blocked until this works after reboot.

## Remaining computer-use checklist

### 1. Finish Settings coverage

- [x] RomM: verify the manual sync result displays the latest sync time and a library count of 141. Record a defect if it still says “Not reported”. — PASS: manual sync showed `9 Sept 2026, 5:08 pm`, `141 games`, and “Synced 141 games from RomM!”.
- [x] RomM: open the Disconnect confirmation and verify its warning/cancel path, then cancel. Do not confirm disconnection without asking the user at action time. — PASS: the modal warns that the saved session is removed while the local library remains; Cancel closed it and RomM stayed connected.
- [x] Storage: verify free-space information, Default/Change controls, storage rows, and any migration guidance. — PASS: showed 1334.23 GB free, Default/Change controls, six categorized rows, and explicit no-silent-move/active-download guidance.
- [x] BIOS: verify platform-first status, Needed/installed totals explanation, and the direct missing-BIOS action. — PASS: Nintendo Switch and SNES were grouped first, with `0 downloaded · 19 missing`, availability explanation, and per-platform/global missing-download actions.
- [x] Emulators: verify installed/detected emulator cards, action labels, platform defaults, and download rows with version/size/status. — PASS: zero detected installs was clearly reported; each available emulator showed platform support, version, size, install status/action, plus platform-default guidance.
- [x] Emulators: inspect the Eden controller card. If ViGEm is still unavailable, verify the no-controller state and record the blocked capture test. — BLOCKED (environment): the card states no standard SDL controller is connected, so capture cannot be exercised until ViGEm exposes a Ready controller.
- [x] Updates: record the current update policy, exercise Off / Check and notify / Automatic, revisit the page to verify persistence, then restore the original selection. — PASS: original `Check and notify`; Off and Automatic selected correctly, Automatic persisted after navigation, and `Check and notify` was restored.
- [x] Updates: verify version text is labelled and easy to copy. — PASS: `App version` is a labelled read-only textbox containing `0.0.111` with explicit selection guidance.

### 2. Downloads and empty states

- [x] Open Downloads before starting new work; verify the empty state and navigation actions. — PASS: `No active downloads` linked to a game details page and a cloud library tile; Recent explained where results appear.
- [x] Start the Cuphead ROM download from its details page and verify queued/active progress and completion in Downloads. — PASS after fix: details advanced from 21% (`712.12 MB / 3.24 GB`) through 85% (`2.78 GB / 3.24 GB`) to `Downloaded! Ready to play`; Cuphead changed from Cloud only to Synced.
- [x] Verify completed-download actions and recent-history presentation. — PASS: details exposed Play, Re-download, and Sync Updates & DLC; Recent showed Cuphead as saved at the base-game `.nsp` path. The file exists at exactly `3481715536` bytes.
- [x] Do not test Delete Download or Clear History without asking the user immediately before the destructive click. — PASS: neither destructive action was clicked.

### 3. Immersive library discovery

- [x] Enable immersive mode from General settings. — PASS: the mode opened from the General switch and entered optional OS fullscreen.
- [x] Verify the large tile layout, filter pills, help bar, and absence of unnecessary desktop chrome/HUD. — PASS: the 2560×1440 viewport used a six-column cover grid, All/Favorites/Recent and platform pills, compact Downloads/Settings/Exit controls, and a bottom help bar without the desktop sidebar/title bar.
- [x] Verify keyboard focus is always visible using Tab and arrow-key navigation. — PASS: Tab focused ActRaiser with a 3 px focus outline; ArrowRight moved to ActRaiser 2 with the same outline. Filter changes restored focus to the first result, or the immersive container when no result existed.
- [x] Verify F11, Escape, and Help hints/actions. — PASS: H hid and restored the help bar, F11 changed the native fullscreen state from true to false and back, and Escape returned from details/library to desktop.
- [x] Filter by All, Nintendo Switch, Favorites, and Recent; verify result counts and focus recovery after each change. — PASS: All rendered the 60-item page, Nintendo Switch returned only Cuphead, Favorites returned only Cuphead, and Recent showed the explicit zero-result state; result-bearing filters focused their first tile.
- [x] Search using a mixed-case partial title and verify case-insensitive results. — PASS: `cUpHeAd` returned only Cuphead.
- [x] Verify a no-results search state and its Clear action. — PASS: `zzzzzz-no-match` showed “No games match your search”; Clear restored the 60-item page.
- [x] Combine search with a platform filter and verify both constraints apply. — PASS: `cupHEAD` plus SNES produced no matches; switching the same search to Nintendo Switch returned only Cuphead.
- [x] Open remote-only Cuphead details and verify **Download** is the sole contained primary action; Play must not appear as the primary action while the game is unavailable locally. — BLOCKED after the required successful download changed Cuphead to Synced; returning it to remote-only would require the separately confirmed destructive Delete action.
- [x] Trigger a safe missing-emulator/core launch path with a remote SNES title; verify a dimmed, plain-language dialog with Open Settings and no misleading Retry action. — FAIL (Medium): Play on remote-only ActRaiser downloaded the game, then displayed a non-dimmed top alert reading `No emulator configured for platform: snes` with `Open Settings` and a misleading `Retry` action.
- [x] Restore the user's previous fullscreen/immersive setting after coverage is complete. — PASS: Escape returned to the desktop Library and General again showed Immersive mode Off / Fullscreen disabled.

### 4. Eden integration

- [x] Determine whether Eden is already installed/detected. If installation is needed, stop for action-time user confirmation before installing or running the newly downloaded emulator. — PASS: after user confirmation, Wingosy installed Eden at its managed path and Settings reported `1 installed` with Eden available to Launch.
- [x] Verify Cuphead is fully downloaded before launch testing. — PASS: Cuphead is Synced and the local base-game NSP is exactly `3481715536` bytes.
- [x] Run **Sync Updates & DLC** for Cuphead and verify download, storage, and registration status in the UI. — PASS after Eden installation: with Eden closed, Wingosy reported `Synced Switch content for 0100A5C00D162000: 0 downloaded, 1 reused. Eden will scan it on its next launch.`
- [x] Verify content sync is prevented or safely handled while Eden is running. — PASS: with the `eden` process running, **Sync Updates & DLC** was blocked with “Eden is running; close Eden completely, then retry” and an explicit retry instruction.
- [x] Launch Cuphead through Wingosy and verify Eden follows Wingosy fullscreen/windowed state. — PASS: the first runtime launch with Wingosy `fullscreen=false` emitted an Eden command without `-f`; a second launch with Wingosy `isFullscreen=true` emitted the otherwise identical command ending in `-f`. Both launches created a live Eden process, and Eden logged Cuphead booting with update `v0.10.0` / version `1.3.7`.
- [ ] Verify returning from Eden restores Wingosy focus and display state. — PARTIAL: after a forced Eden process stop, Wingosy became visible but `isFocused=false`; normal Eden exit remains untested because Eden exposed no controllable window handle.
- [x] If keys/firmware are absent, record the launch limitation and do not alter them. — PASS: prerequisites were present enough for Cuphead 1.3.7 to boot with update v0.10.0; only filenames/existence were inspected and nothing was altered.
- [ ] Create or modify a disposable Cuphead save, exit Eden, and verify the save syncs back through Wingosy/RomM. — PARTIAL/BLOCKED: Eden created or updated `cuphead_settings_data_v1.sav` and `cuphead_ach.sav`, but manual **Sync to RomM** hung after the RomM port went down.
- [ ] Relaunch and verify the synced save is restored to the Eden profile. — BLOCKED pending RomM service availability.
- [x] Exercise save-sync failure/retry messaging if a safe, reversible failure can be induced without changing the PC or server configuration. — FAIL (High): with the RomM host pingable but TCP `14400` closed, **Sync to RomM** stayed `Uploading…` for more than two minutes and **List Saves** stayed `Loading` with controls disabled and no timeout/error; after app restart, a retry launch stayed at `Preparing BIOS` with no timeout.

### 5. Virtual gamepad and controller capture

- [x] After reboot, rerun the adapter smoke example and confirm the ViGEm target reaches Ready. — BLOCKED (environment): after the 4:22 pm reboot, `cargo run --manifest-path tools/virtual-gamepad-adapter/Cargo.toml --example windows_smoke` failed with `Bus(TargetNotReady { serial_no: 8 })`.
- [x] If Ready, run `bun run test:e2e:virtual-gamepad` and verify unattended navigation input reaches Wingosy. — BLOCKED: the prerequisite ViGEm target did not reach Ready, so the conditional E2E run was not started.
- [x] Use the virtual controller to navigate immersive mode, including filters, search, details, Back, and focus recovery. — BLOCKED: no Ready virtual controller is exposed to Wingosy.
- [x] In Settings → Emulators, capture the virtual controller for Eden and verify the generated Eden profile is selected. — BLOCKED: no Ready virtual controller is exposed, and Eden is not installed/configured.
- [x] Launch Cuphead and verify buttons/sticks reach Eden through the managed profile. — BLOCKED: the virtual controller target is not Ready and Eden is not installed/configured.
- [x] If `TargetNotReady` persists, mark all controller-input checks Blocked and report the exact error; do not reinstall drivers or modify Windows settings without permission. — PASS: all controller-input checks were marked Blocked with the exact post-reboot error; no driver reinstall or Windows-setting change was attempted.

### 6. Final regression and cleanup

- [x] Recheck desktop Library search/filter/details after leaving immersive mode. — PASS: mixed-case search `cupHEAD` returned exactly Cuphead; Favorites retained Cuphead; details showed Synced, Play/Re-download/Sync Updates & DLC, screenshots, and Saves.
- [x] Remove Cuphead from Favorites to clean up the temporary fixture. — PASS: removed it and verified the control changed to `Add Cuphead to favorites`.
- [x] Restore Dark theme, UI sounds Off, the original update policy, and the original immersive/fullscreen setting. — PASS: General shows Immersive off and Fullscreen disabled; Appearance has Dark pressed; Sound has UI sounds Off with preview controls disabled; Updates has Check and notify pressed.
- [x] Leave downloaded Cuphead/update/save data in place unless the user explicitly confirms deletion. — PASS: no downloaded Cuphead, update, or save data was deleted.
- [x] Record each remaining case as Pass, Fail, or Blocked with observable evidence and concise reproduction steps for failures. — PASS: existing Medium missing-emulator guidance failure and the environment/Eden blocks are recorded above with evidence.
- [x] Report severity for defects: Critical (data loss/crash/security), High (major path broken), Medium (partial feature/workaround), Low (cosmetic/edge case). — PASS: the missing-emulator guidance issue is classified Medium; environment and Eden prerequisites are classified Blocked.

## Findings and blockers so far

1. **Blocked — Windows virtual controller target**: both normal and elevated adapter smoke runs returned `Bus(TargetNotReady)`. The reboot may clear this; otherwise virtual-controller navigation and Eden controller capture cannot be proven.
2. **Resolved — RomM sync metadata**: a fresh manual sync displayed `9 Sept 2026, 5:08 pm`, `141 games`, and the success alert `Synced 141 games from RomM!`.
3. **Resolved — Tauri MCP control**: native webview control was restored after the approved addition of `app.withGlobalTauri: true`; direct DOM, screenshot, and interaction calls now work.
4. **Resolved — Cuphead ROM download size mismatch**: RomM's ROM-level content endpoint returned a ZIP containing the base game and update, while Wingosy saved it as `.nsp` and validated the ZIP size against the aggregate unwrapped file size. Wingosy now selects the authenticated child file categorized as `game`, uses that file's name and size, and retains the archive endpoint only as a legacy fallback. The Cuphead retest saved `Cuphead [0100A5C00D162000][v0].nsp` at exactly `3481715536` bytes and reached Synced.
5. **Medium — Missing-emulator launch guidance**: launching remote-only ActRaiser downloaded it, then rendered a top alert instead of the required dimmed dialog. The copy was plain-language and `Open Settings` was present, but a misleading `Retry` action was also shown.
6. **Blocked — Post-reboot virtual controller target**: the adapter smoke example still returned `Bus(TargetNotReady { serial_no: 8 })`; all dependent controller-input checks remain untestable without driver/system remediation.
7. **Pass — Windowed Eden/Cuphead launch**: Cuphead 1.3.7 booted through Wingosy with update v0.10.0; the windowed command omitted `-f` as expected while Wingosy reported `fullscreen=false`.
8. **Medium — Eden focus restoration (tentative)**: after forcibly stopping Eden, Wingosy became visible but was not focused (`isFocused=false`); normal Eden exit was not testable because Eden had no controllable window handle.
9. **High — Save-sync outage timeout/error handling**: when RomM TCP `14400` was closed, **Sync to RomM** remained `Uploading…` beyond two minutes and **List Saves** remained `Loading` with disabled controls and no failure/retry message; a post-restart launch likewise remained at `Preparing BIOS` without a timeout.

## Exit criteria

- Every checkbox above is completed or explicitly marked Blocked with a concrete reason.
- Core P0 paths pass: RomM library sync, local download, immersive search/filter, and game launch where emulator prerequisites are available.
- No Critical defects remain unexplained.
- Temporary reversible settings are restored, and no data or software is deleted/installed without the required confirmation.
