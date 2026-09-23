---
name: testing-wingosy
description: How to run and end-to-end test the Wingosy Launcher Tauri app — immersive (big-picture) mode, gamepad-path keyboard synthesis via the tauri-mcp bridge, seeding games without RomM, and faking a RomM session offline.
---

# Testing Wingosy Launcher

Windows-only Tauri app (React frontend + Rust backend). `bun run dev` (tauri dev) runs vite on :5173 and launches the native window. Repo root: `C:\Users\Administrator\repos\wingosy-launcher`.

## Entering immersive mode

Config key `display.big_picture`. Easiest path: complete onboarding once (creates `%APPDATA%\wingosy\launcher\config\config.toml`, which also makes `is_first_run` return false), then in the desktop app: Settings → General → "Immersive mode" switch (also enables fullscreen). `display.fullscreen` is independent. Exit via immersive library Esc → "Exit immersive mode?" dialog → Exit, or the top-right Exit link.

## Seeding a game library without a RomM server

The onboarding scanner maps files→platforms by file extension only (`detect_platform_by_extension`), so zero-byte files work:
- `.nsp`→switch, `.smc`→snes, `.gba`→gba, `.gb`→gb (see `src-tauri/src/scanner` seeds).
Create e.g. `C:\WingosyTestRoms\` with named files, run wizard: Get Started → Skip RomM → Browse to the folder (type path into the native picker's Folder field) → Scan Local ROMs → Finish. Games land in `%APPDATA%\wingosy\launcher\data\wingosy.db` (`games` table).

## Faking a RomM session offline

`restore_romm_session` reads `config.romm.server_url`, then `migrate_legacy_romm_access_token` moves `config.romm.auth_token` into the OS keyring via the app's own store — the only reliable way to plant a credential (cmdkey-planted creds are not readable by keyring-rs):

1. Add to config.toml under `[romm]`: `server_url = "romm.local"` and `auth_token = "faketoken123"`.
2. Invoke `restore_romm_session` (IPC or restart) → returns `{access_token, server_url, refreshed:false}` with no username → no network call; auth_token is cleared from config.
3. For UI "configured" state you also need the in-app session — open Settings → RomM so the settings lifecycle restores the session (shows "Connected"), or click "Sync Library" (attempts a real fetch → fails offline with e.g. "Failed to fetch platforms" — expected, proves the path ran).
4. To make "Manage cached saves" appear on a game: `sqlite3 wingosy.db "UPDATE games SET romm_id=42 WHERE platform_id='switch'"` (needs romm_id + configured session).

Offline RomM calls fail with URL/network errors — that's the expected outcome; the pass criterion is "attempted + clean error", not "pair first" dead-end.

## Driving controller-path navigation without a gamepad

`use-gamepad-keyboard-mapper` maps gamepad→keyboard events dispatched on `window` (Arrows, Enter, Escape, PageUp/PageDown, "s", "h", F11). The app itself bundles `tauri-plugin-mcp-bridge` (debug builds) on `127.0.0.1:9223`, driven by the repo-local CLI:

```sh
cd C:/Users/Administrator/repos/wingosy-launcher
node node_modules/@hypothesi/tauri-mcp-cli/dist/index.js driver-session start --port 9223
node node_modules/@hypothesi/tauri-mcp-cli/dist/index.js webview-execute-js --script "window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})); 'ok'"
```

Which input path reaches which listener:
- Real keyboard (computer tool `key`) works for: `useImmersiveModeHotkeys` (Escape/F11/h), and library nav (React `onKeyDown` on the root div catches bubbled real keys).
- **Window-dispatched events required** for: settings spatial nav (`useImmersiveSettingsNavigation`), game-details keyboard (`useImmersiveGameDetailsKeyboard`), PageUp/PageDown section cycling — these listeners are window-targeted only, so real keypresses are ignored.
- Overlay/dialog spatial arrows run only inside the real gamepad `onControllerAction` route — not reachable by synthesis.

Gotcha: dispatching several synthesized keydowns inside one synchronous JS block races React — `.Mui-selected` etc. won't have flushed between dispatches. Dispatch one event per `webview-execute-js` call with a real delay between calls.

MUI Slider quirks: disabled sliders can't be focused; query them via `[role=slider]` or `input[aria-label="Controller deadzone"]` (`.value`, `aria-valuenow`). Onboarding ROM-folder picker is a native Windows dialog — click Browse, then type the path in the "Folder:" field.

## Devin Secrets Needed

None — all paths above run unauthenticated/offline.
