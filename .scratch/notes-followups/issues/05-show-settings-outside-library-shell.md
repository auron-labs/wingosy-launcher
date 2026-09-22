# 05 — Show Settings outside library shell

**What to build:** Windowed desktop Settings displays without the normal library/platform sidebar and supplies one keyboard-accessible “Back to Library” header action that navigates through the existing library route. Settings navigation and status remain available; other desktop routes retain their sidebar.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance

- [ ] In windowed desktop Settings, library and platform sidebar navigation are absent.
- [ ] One keyboard-accessible Back to Library action returns to the Library through the existing navigation behavior.
- [ ] `SettingsNavigation` sections and the Settings sync-status chip remain visible and usable.
- [ ] Library, Downloads, Details, and RomM Sync keep their existing shell/sidebar behavior.

## Evidence and context

Original NOTES bullet: “opening settings in windowed mode places the settings inside the home shell, causing the normal sidebar to still show” (`NOTES.md:7-8`). Static inspection shows `AppDesktop` always renders `Sidebar`, including `view === "settings"`; `Settings` already renders internal `SettingsNavigation` and `SyncStatusChip`. There is no alternative desktop top bar or current Settings Back action. A prior resolved UI-audit item removed Back because the sidebar was the exit; this requirement supersedes that assumption. This is code-inspection evidence, not a runtime reproduction.

## Minimal implementation plan

1. In `AppDesktop`, conditionally omit only the normal `Sidebar` when `view === "settings"`; preserve `MainView` and all other route shells.
2. Thread the existing `onNavigate` callback through `SettingsPanel` to `Settings` and add a single semantic header Back to Library control that calls `onNavigate("library")`.
3. Place the action with the existing Settings header without replacing `SettingsNavigation` or the status chip.

## Scope and preservation

Do not add a route, history mechanism, shell framework, styling redesign, controller/filter changes, or screenshot-script entry. This changes only desktop Settings navigation.

## Targeted verification

Run relevant existing app/navigation checks. Perform the minimum Tauri MCP smoke check: open windowed Settings, verify no library/sidebar navigation, activate Back to Library, and confirm Library returns. Existing checks and visual inspection are sufficient; do not create CSS-value tests.
