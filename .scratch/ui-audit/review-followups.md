# Review follow-ups

Implementation commit: `09f4b6c` (`fix(ui): wire review follow-up actions`)

## Finding 1 — Downloads empty-state links

**Fixed.** Desktop and Immersive Downloads now pass callbacks that return to the active library view for both the game-details and cloud-library links. The links remain usable in standalone component contexts through their existing fallback hrefs.

## Finding 2 — Settings → Integrations CTA

**Fixed.** The Integrations callback is now passed from both desktop and Immersive game details through `GameAchievementsSection` and `AchievementListOverlay`. Desktop navigation opens the Integrations section directly; Immersive navigation does the same through its settings initial-section state.

## Finding 3 — Desktop library launch failure CTA

**Fixed.** App-level launch failures now retain their game id and shared launch-error presentation. The Library alert displays the guidance, offers Open Settings, and only offers Retry for retryable failures; deterministic missing-emulator failures do not expose Retry.

## Finding 4 — UI sound previews

**Fixed.** Settings now lists every bundled Argosy UI sound (Tap, Click, Success, Error, Back, Open, and Close), with an individual Preview action reusing `previewArgosySound` from `UiSoundsContext`.

## Finding 5 — Free disk space

**Fixed for the Windows target.** `get_storage_overview` now reports `free_disk_bytes` using the native `GetDiskFreeSpaceExW` capability for the configured ROMs volume, and the existing frontend formatter displays the value. Non-Windows builds keep the honest `Not reported` fallback because no portable disk-space dependency is present.

## Finding 6 — Downloaded-state and sync-state logic

**Fixed.** `isGameDownloaded` is now the shared predicate used by game filters and desktop GameDetails, including the transient just-downloaded state. `normalizeSyncState` centralizes casing, whitespace, and PascalCase-to-snake-case normalization for sync-state checks.

## Finding 7 — Dead Settings `onBack` prop

**Fixed.** Removed the ignored `onBack` destructuring and removed the unused prop from desktop and Immersive Settings callers and the Settings test harness.

## Accepted / note-only findings

- Sync metadata remains session-only because the current backend does not persist a sync history or schedule; the UI labels unavailable values as `Not reported`.
- Emulator version and download size remain `Not reported` until the backend resolves release metadata; no invented values were added.
- `getBiosGroupTotals` alias, `StatusChip.showHelpIcon`, and filter-parameter signature differences remain accepted judgement calls and were not changed.
