# 10 — Settings: RomM and Integrations

**What to build:** RomM settings communicate one clear state: the overlapping "Connected" disabled-button and "Session saved" badge collapse into a single status indicator; "Disconnect" adopts the shared destructive pattern with confirmation from ticket 01 instead of a bare red text link; the DEVICE PAIRING / ACCESS TOKEN segmented control switches to sentence case, explains each auth method, and shows a token input when Access Token is selected; and sync metadata (last synced time, library counts, next scheduled sync if any) is surfaced. The Integrations page stops driving tombstone UI: while RetroAchievements integration is off/unshipped, the page is clearly marked as preview (or hidden), and it no longer produces placeholder grids and dead-end links elsewhere in the app.

**Blocked by:** 01 — Design-system pass: typography, buttons, and interaction states.

**Status:** resolved

- [x] RomM connection shows exactly one status indicator
- [x] Disconnect uses the shared destructive pattern with confirmation
- [x] Auth method control is sentence case with per-method explanation; Access Token selection reveals a token input
- [x] Sync metadata (last sync, counts, schedule) is visible
- [x] Integrations page is marked as preview or hidden, and its disabled state no longer spawns placeholder UI elsewhere

## Notes

- RomM now uses one shared `SyncStatusChip` for the connection state; the separate `Connected` button and `Session saved` badge are gone. Disconnect remains behind `ConfirmDestructiveDialog`.
- Authentication choices use sentence case, explain pairing versus access-token authentication, and reveal the secure token field only for Access token.
- Sync metadata records the timestamp/total returned by a successful manual sync in the current session and reflects the existing `auto_sync` setting. The existing backend command does not persist last-sync timestamps, detailed add/update counts, or a scheduled-run timestamp, so unavailable values are labeled rather than fabricated.
- RetroAchievements is currently a disabled, explicitly labeled preview. Game details already retain the ticket 05 disabled treatment without placeholder achievement tiles or a View all dead end.

## Smoke test (human)

1. Open Settings → RomM and confirm there is one connection status chip, then choose Disconnect and verify Cancel leaves the session intact while confirmation disconnects it.
2. With no session saved, switch between Device pairing and Access token and confirm each explanation and the token field are shown in the matching state.
3. Run Sync Library and confirm the metadata cards show the latest sync time and RomM game count; inspect Settings → Integrations for the Preview banner and disabled toggle.
