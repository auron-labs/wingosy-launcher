# 08 — Settings shell navigation and sync status

**What to build:** The settings shell stops stacking navigation chrome: with the app sidebar plus settings nav column, the redundant "← Back" button (a fourth back control) goes away or the sidebar/nav arrangement is rationalized so one back path exists. The unexplained green cloud icon in every settings header becomes a labeled, tooltipped sync-status indicator using one shared pattern — the same pattern the details page uses for "Downloaded, not synced" — so server/sync health is communicated consistently app-wide instead of via three scattered systems. On the RomM page, whether the server URL is editable while connected is made unambiguous.

**Blocked by:** 02 — Layout width and scrollbar system.

**Status:** resolved

- [x] Only one back-navigation path exists in settings (no redundant "← Back" beside sidebar + settings nav)
- [x] Settings-header cloud icon is labeled/tooltipped as a sync status
- [x] One shared sync/server-status pattern is used across settings header, details page, and RomM page
- [x] RomM server URL field clearly signals its editability state while connected

## Notes

- Removed the settings shell Back button and replaced the unlabeled cloud affordance with the shared `SyncStatusChip` used by settings and game details.
- Connected RomM server URLs are disabled with explicit "Disconnect before changing" guidance; the field becomes editable after disconnecting.
- RomM sync history and scheduling are not part of this ticket's UI state; ticket 10 surfaces the available sync metadata without adding backend commands.

## Smoke test (human)

1. Open Settings and confirm the app/sidebar navigation remains the only back path; inspect the labeled status chip and its tooltip.
2. Open Settings → RomM while connected and confirm the server URL is visibly disabled with the disconnect guidance.
3. Open a RomM game and confirm its sync badge uses the same labeled chip treatment as the settings status.
