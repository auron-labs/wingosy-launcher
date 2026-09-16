# Wingosy Tauri UI Test Plan

Last reset: 2026-09-10  
Test target: current working tree based on commit `1097237` on `main`  
Tooling: mise

## Purpose

Run a fresh Tauri MCP smoke test of the recently added UI audit, immersive library discovery, Eden integration, and virtual gamepad features. Test observable user behaviour in the Windows desktop app; do not change source code while testing.

## Test environment and agreements

- Use the user's temporary RomM Docker instance and copied ROM library. It is disposable and contains no production data.
- RomM URL: `http://192.168.1.142:14400`
- RomM username: `testing`
- The password was supplied in a previous conversation but is intentionally not stored in this repository. Ask the user for it if pairing must be repeated.
- The expected synced library contains 141 games: 140 Super Nintendo games and Cuphead for Nintendo Switch.
- Cuphead has an update installed on RomM and is the Switch fixture for Eden content-sync testing.
- ViGEmBus is installed. There is no physical controller.
- The user approved changes made by Wingosy inside Wingosy AppData, its managed Eden profile, and disposable test saves.
- Do not modify anything else on the user's personal gaming PC without permission.
- Use Tauri MCP as the primary app-control path. Native Computer Use is a fallback only for checks Tauri MCP cannot exercise.
- Ask for action-time confirmation before deleting a download, clearing history, disconnecting RomM, installing/running newly downloaded software, or accepting any destructive confirmation dialog.
- Do not source or alter Switch keys/firmware. If they are missing, record the resulting limitation.

## Setup

- [x] Start the Wingosy development app if it is not already running (`bun run dev`). — PASS: app version `0.0.111` started from the current working tree.
- [x] Connect Tauri MCP directly to the running `Wingosy Launcher` development app. — PASS: bridge `0.13.0` connected on port 9223.
- [x] Confirm the app opens on the existing paired library with 141 games. — PASS: Library showed 141 results, split as 1 Nintendo Switch and 140 SNES games.
- [x] If pairing was lost, ask the user for the temporary password and repeat device pairing; hand any browser login step to the user. — NOT APPLICABLE: the saved RomM device pairing remained connected.
- [x] Record the current theme, UI-sound, update-policy, immersive, and fullscreen settings so they can be restored. — PASS: Dark, UI sounds Off, Check and notify, Stable channel, Immersive Off, Fullscreen disabled.

## Automated baseline

- [x] Run frontend unit tests. — PASS: 27 files, 208 tests.
- [x] Run the production frontend build. — PASS: Vite built 804 modules; one non-blocking chunk-size warning remains.
- [x] Run TypeScript checking. — FAIL (High quality gate): `bun run typecheck` reports widespread JS inference errors, including `never[]`, null-state, and unsafe prop types.
- [x] Run frontend/Rust lint. — FAIL (High quality gate): dependencies were restored with `bun install --frozen-lockfile`, then Ultracite reported formatting issues in 69 files and many lint/type-aware errors. A separate `bun run lint:rust` run also failed with 9 Clippy errors.
- [x] Run Rust tests. — FAIL (High quality gate): 321 passed, 8 failed, and 1 was ignored. Four failures reproduce independently; four launcher failures are collateral from a poisoned shared test lock.

## Test checklist

### Setup and desktop library

- [x] Complete or verify first-run setup against the temporary RomM instance. — PASS: existing paired setup opened directly to the library.
- [x] Verify the optional local ROM folder remains skipped unless the current state requires otherwise. — NOT APPLICABLE: the existing paired setup required no first-run folder choice; managed storage remained the active source.
- [x] Sync 141 games successfully. — PASS: manual RomM sync reported `Synced 141 games from RomM!`.
- [x] Verify the wide desktop grid uses the window width and shows titles, platform badges, cloud-only state, Play, and Favorite actions. — PASS at 2560×1440.
- [x] Verify `Ctrl+F` focuses search with a visible focus ring. — PASS: the search container showed a 3 px focus ring.
- [x] Verify mixed-case search (`cupHEAD`) finds Cuphead and Clear restores the full library. — PASS: one Cuphead result, then 141 results after Clear.
- [x] Verify the Nintendo Switch filter returns only Cuphead. — PASS: one result.
- [x] Add Cuphead to Favorites as a temporary fixture and verify it appears in Favorites. — PARTIAL: the toggle persisted, but the sidebar Favorites action is broken and shows all 141 games instead of filtering.

### Cuphead details

- [x] Verify the hero, title scrim, Nintendo Switch/RomM/Cloud-only chips, Favorite, and More controls are readable. — PASS on Cuphead details.
- [x] Verify the More menu contains working actions and no “Coming soon” placeholders. — PASS: collection, refresh, delete, open-location, and hide actions were present.
- [x] Open the screenshot lightbox; verify dimming, close/navigation hints, Right Arrow navigation from image 1 to 2, and Escape closes the lightbox without exiting the app. — PASS: moved from 1/5 to 2/5; Escape returned to details and the MCP session remained connected.
- [x] Verify the RetroAchievements off-state links to Settings → Integrations. — PASS.
- [x] Verify the page has one Saves section and a single usable scroll region. — PASS: one Saves heading and one overflowing `overflow-y: auto` container.

### Settings

- [x] Verify the Settings shell has left navigation, no redundant Back action, a wide content panel, and a clear Connected RomM status. — PASS.
- [x] General: verify beta copy, selectable app version, disabled Fullscreen explanation, controller deadzone value/reset, and F11/Escape hints. — PASS; version `0.0.111`, deadzone 35%.
- [x] Appearance: switch to Light and verify the app changes, then restore the original theme. — PASS; Dark restored.
- [x] Sound: verify disabled controls while UI sounds are Off; enable them, use Tap Preview, then restore the original setting. — PASS; UI sounds restored Off.
- [x] Integrations: verify Preview labelling, explanatory banner, and disabled RetroAchievements toggle. — PASS.
- [x] RomM: verify the URL and authentication controls are disabled while connected with guidance to disconnect first. — PASS.
- [x] RomM: click **Sync Library** and verify the post-sync timestamp and count. — PASS: `10 Sept 2026, 2:26 pm`, 141 games.

### Virtual gamepad preparation

- [x] Build the project-local virtual gamepad adapter successfully. — PASS: the Windows smoke example compiled successfully.
- [x] Run its Windows smoke example normally. — BLOCKED: the normal run exited with `Bus(TargetNotReady { serial_no: 47 })`.
- [x] If the normal run cannot create the ViGEm target, stop and ask before trying an elevated run or changing drivers/system settings. — PASS: testing stopped at the prerequisite failure; no elevated adapter run, driver reinstall, or Windows setting change was attempted.

### 1. Finish Settings coverage

- [x] RomM: verify the manual sync result displays the latest sync time and a library count of 141. Record a defect if it says “Not reported”. — PASS.
- [x] RomM: open the Disconnect confirmation and verify its warning/cancel path, then cancel. Do not confirm disconnection without asking the user at action time. — PASS: warning described session removal while retaining the local library; Cancel preserved the connection.
- [x] Storage: verify free-space information, Default/Change controls, storage rows, and any migration guidance. — PASS: 1338.49 GB free, three tracked ROMs, six rows, and explicit no-silent-move guidance.
- [x] BIOS: verify platform-first status, Needed/installed totals explanation, and the direct missing-BIOS action. — PASS: Switch and SNES first; `2 downloaded · 17 missing`.
- [x] Emulators: verify installed/detected emulator cards, action labels, platform defaults, and download rows with version/size/status. — PASS: managed Eden detected; available rows label platform support, version, size, status, and Install.
- [x] Emulators: inspect the Eden controller card. If ViGEm is unavailable, verify the no-controller state and record the blocked capture test. — BLOCKED: the card reports no standard SDL controller and the adapter fails with `TargetNotReady` for serial 47.
- [x] Updates: record the current update policy, exercise Off / Check and notify / Automatic, revisit the page to verify persistence, then restore the original selection. — PASS: Automatic persisted after navigation; Check and notify restored.
- [x] Updates: verify version text is labelled and easy to copy. — PASS: read-only labelled textbox contains `0.0.111`.

### 2. Downloads and empty states

- [x] Open Downloads before starting new work; verify the empty state and navigation actions. — PASS.
- [x] Start a safe remote-only ROM download from its details page and verify queued/active progress and completion in Downloads. Prefer Cuphead when it is remote-only; otherwise use an equivalent fixture without deleting an existing download. — PASS using Aero Fighters; Active progress appeared and the transfer completed.
- [x] Verify completed-download actions and recent-history presentation. — PASS: Recent recorded `Aero Fighters.sfc`; details changed to Synced with Play and Re-download.
- [x] Do not test Delete Download or Clear History without asking the user immediately before the destructive click. — PASS: neither destructive action was clicked.

### 3. Immersive library discovery

- [x] Enable immersive mode from General settings. — PASS: immersive mode opened automatically and entered native fullscreen.
- [x] Verify the large tile layout, filter pills, help bar, and absence of unnecessary desktop chrome/HUD. — PASS at 2560×1440.
- [x] Verify keyboard focus is always visible using Tab and arrow-key navigation. — PASS: the focused tile retained a 3 px outline while moving right.
- [x] Verify F11, Escape, and Help hints/actions. — PASS: `H` hid/restored help, F11 toggled fullscreen, and Escape returned to desktop mode.
- [x] Filter by All, Nintendo Switch, Favorites, and Recent; verify result counts and focus recovery after each change. — PASS, including an empty Recent + Nintendo Switch combination.
- [x] Search using a mixed-case partial title and verify case-insensitive results. — PASS: `cUpHeAd` returned Cuphead.
- [x] Verify a no-results search state and its Clear action. — PASS: `zzzzzz-no-match` showed the dedicated empty state and Clear action.
- [x] Combine search with a platform filter and verify both constraints apply. — PASS: Cuphead + SNES was empty; switching to Nintendo Switch returned Cuphead.
- [x] Open a remote-only game’s details and verify **Download** is the sole contained primary action; Play must not appear as the primary action while the game is unavailable locally. — PASS in immersive mode: remote-only Aerobiz exposed Download and no Play action.
- [x] Trigger a safe missing-emulator/core launch path with a downloaded SNES title; verify a dimmed, plain-language dialog with Open Settings and no misleading Retry action. — PASS in immersive mode: Aero Fighters showed a dimmed Launch failed dialog with Back and Open Settings, and no Retry.
- [x] Restore the user's previous fullscreen/immersive setting after coverage is complete. — PASS: Immersive Off and fullscreen disabled were restored.

### 4. Eden integration

- [x] Determine whether Eden is already installed/detected. If installation is needed, stop for action-time user confirmation before installing or running the newly downloaded emulator. — PASS: managed Eden was already installed and detected; nothing was installed.
- [x] Verify Cuphead is fully downloaded before launch testing. — PASS: Cuphead showed Synced with its local NSP path.
- [x] Run **Sync Updates & DLC** for Cuphead and verify download, storage, and registration status in the UI. — PASS: `0 downloaded, 1 reused`; Wingosy reported Eden would scan it on next launch.
- [x] Verify content sync is prevented or safely handled while Eden is running. — PASS: Re-download and Sync Updates & DLC were disabled while the emulator process was active.
- [x] Launch Cuphead through Wingosy and verify Eden follows Wingosy fullscreen/windowed state. — PASS for the restored windowed state: the fresh launch command omitted `-f`.
- [x] Verify returning from Eden restores Wingosy focus and display state. — FAIL (Medium, constrained reproduction): after the exact Eden process was force-stopped because it exposed no controllable window handle, Wingosy remained `focused=false`; display state stayed windowed.
- [x] If keys/firmware are absent, record the launch limitation and do not alter them. — NOT OBSERVED: Eden created a process but exposed no testable window; no keys or firmware were altered.
- [x] Create or modify a disposable Cuphead save, exit Eden, and verify the save syncs back through Wingosy/RomM. — PARTIAL: native gameplay was inaccessible, so two existing disposable save files were used. The backend reported upload success for slot `autosave` with `romm_save_id: 1`, but the refreshed UI still said no saves were found.
- [x] Relaunch and verify the synced save is restored to the Eden profile. — FAIL (High): Restore from RomM failed before relaunch with `invalid Zip archive: Could not find EOCD`; both original local save hashes remained unchanged.
- [x] Exercise save-sync failure/retry messaging if a safe, reversible failure can be induced without changing the PC or server configuration. — FAIL (Medium): the restore failure appeared in an alert with only Close and no retry action.

### 5. Virtual gamepad and controller capture

- [x] Run the adapter smoke example and confirm the ViGEm target reaches Ready. — BLOCKED: `Bus(TargetNotReady { serial_no: 47 })`.
- [x] If Ready, run `bun run test:e2e:virtual-gamepad` and verify unattended navigation input reaches Wingosy. — BLOCKED: the Ready prerequisite failed, so the E2E test was not run.
- [x] Use the virtual controller to navigate immersive mode, including filters, search, details, Back, and focus recovery. — BLOCKED: no Ready virtual controller target.
- [x] In Settings → Emulators, capture the virtual controller for Eden and verify the generated Eden profile is selected. — BLOCKED: no Ready virtual controller target.
- [x] Launch Cuphead and verify buttons/sticks reach Eden through the managed profile. — BLOCKED: no Ready virtual controller target.
- [x] If `TargetNotReady` persists, mark all controller-input checks Blocked and report the exact error; do not reinstall drivers or modify Windows settings without permission. — PASS: all dependent checks are Blocked; no system changes were made.

### 6. Final regression and cleanup

- [x] Recheck desktop Library search/filter/details after leaving immersive mode. — PASS: Cuphead search returned one result, Clear restored 141, Nintendo Switch returned one result, and details remained accessible.
- [x] Remove Cuphead from Favorites if it was added as a temporary fixture. — PASS: the control returned to Add Cuphead to favorites.
- [x] Restore the original theme, UI-sound, update-policy, immersive, and fullscreen settings. — PASS: Dark, UI sounds Off, Check and notify, Stable, Immersive Off, fullscreen disabled.
- [x] Leave downloaded Cuphead/update/save data in place unless the user explicitly confirms deletion. — PASS: no downloaded game, content, or save data was deleted; the additional Aero Fighters test download remains.
- [x] Record each case as Pass, Fail, or Blocked with observable evidence and concise reproduction steps for failures. — PASS: recorded above and summarized below.
- [x] Report severity for defects: Critical (data loss/crash/security), High (major path broken), Medium (partial feature/workaround), Low (cosmetic/edge case). — PASS: no Critical defect observed.

## Findings and blockers for this run

1. **High — automated quality gates fail**: TypeScript checking and frontend lint fail broadly. Rust Clippy also fails with 9 errors. Rust tests finish with 321 passed, 8 failed, and 1 ignored; four failures reproduce independently.
2. **Medium — Favorites navigation does not filter**: after Cuphead was favorited, clicking the sidebar Favorites action returned to Library with `All games` and all 141 results.
3. **High — Switch save restore is broken**: upload returns success and `romm_save_id: 1`, but Refresh Saves reports none; Restore from RomM then fails with `invalid Zip archive: Could not find EOCD`. The two local save hashes were unchanged.
4. **Medium — save-sync failure has no retry action**: the restore error alert offers only Close.
5. **Medium — Wingosy focus did not return after Eden exited**: after Eden was force-stopped by exact process ID, Wingosy remained `focused=false`. This needs confirmation with a normal Eden exit when its window can be controlled.
6. **Blocked — virtual controller target never becomes Ready**: the normal adapter smoke run exits with `Bus(TargetNotReady { serial_no: 47 })`; all controller-input and capture cases are blocked. No elevated run or driver/system change was attempted.
7. **Low — invalid DOM nesting warning in Settings → Emulators**: React reports a `<div>` nested inside `<p>` while rendering the page.
8. **Resolved in this run — screenshot lightbox Escape**: screenshot navigation reached 2/5, Escape closed the lightbox, and Wingosy stayed running.

## Exit criteria

- Every checkbox above is completed or explicitly marked Blocked with a concrete reason.
- Core P0 paths pass: RomM library sync, local download, immersive search/filter, and game launch where emulator prerequisites are available.
- No Critical defects remain unexplained.
- Temporary reversible settings are restored, and no data or software is deleted/installed without the required confirmation.