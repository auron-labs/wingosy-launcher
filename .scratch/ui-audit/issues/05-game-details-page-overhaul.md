# 05 — Game details page overhaul

**What to build:** The game details page stops wasting the window and stops burying actions: stronger hero art with title scrim/contrast treatment; one unified badge/chip style for platform, source ("RomM"), and sync state — with "Downloaded, not synced" explained via tooltip/help; kebab and heart targets enlarged; overflow menu trimmed to working items only (disabled "Coming soon" entries hidden or collapsed); "Delete Download" moved off the misclick-prone bottom position and behind a confirmation; save management exists in exactly one place (not kebab menu AND an off-screen Saves section); the achievements section respects RetroAchievements being disabled — no fake padlock grid, helper copy becomes a real link to Settings → Integrations, and the "View all" dead end disappears; screenshots row balances and offers some way to view them larger; play stats typography aligned and legible; the page no longer has competing nested scroll regions.

**Blocked by:** 01 — Design-system pass; 02 — Layout width and scrollbar system.

**Status:** resolved

- [x] Hero art is prominent with readable title treatment (scrim/contrast)
- [x] All status badges share one chip style; "not synced" has an explanation affordance
- [x] Kebab/heart targets are comfortably sized
- [x] Overflow menu shows only functional items; unshipped items hidden/collapsed
- [x] Delete Download cannot be trivially misclicked and requires confirmation
- [x] Save actions live in one consistent location on the page
- [x] With RetroAchievements disabled: no padlock placeholder grid, helper text links to Integrations settings, no "View all" button
- [x] Screenshots row is balanced and offers a larger-view affordance
- [x] Play stats values and labels align on a shared baseline
- [x] Page has a single scroll region

## Notes

- The desktop details page now uses a taller, darker hero scrim with a readable title, explicit 48px favorite/menu targets, unified `StatusChip` badges, and aligned responsive play stats.
- The overflow menu contains only working actions. Cached-save navigation was removed from the menu so save management remains in the single Saves section; deletion is separated from navigation and continues to use `ConfirmDestructiveDialog`.
- Disabled RetroAchievements uses an explanatory linked state instead of placeholder locks. Screenshots use balanced cards that open the existing lightbox, and the details layout does not add a secondary scroll region.
- `src/components/game/StatusChip.jsx` is intentionally neutral so the later sync-status consolidation can reuse it.

## Smoke test (human)

1. Open a game with cover art and inspect the hero title, status chips, favorite, and More options controls.
2. Open More options and verify only working actions appear; choose Delete Download and confirm the dialog.
3. Check screenshots, stats, the disabled RetroAchievements message/link, and the single Saves section while scrolling the page.
