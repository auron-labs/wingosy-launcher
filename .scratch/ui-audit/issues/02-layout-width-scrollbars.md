# 02 — Layout width and scrollbar system

**What to build:** Layout stops wasting wide screens: the game details page, all settings panels, and the Downloads page expand beyond the current ~640–665px column and use the available window width at desktop resolutions. Scrolling is sane everywhere: one scroll region per screen — no more window scrollbar plus independent sidebar/panel scrollbars competing, thin low-contrast custom scrollbars fixed, and the detached floating scrollbars on Emulators/BIOS panels reattached to the region they scroll.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Details page content uses the window width sensibly at ~2000px (no giant dead gutters)
- [x] Settings panels and Downloads page widen beyond the narrow centered strip
- [x] Only one scroll region is active per screen (no nested window + sidebar + panel scrollbars)
- [x] Panel scrollbars on Emulators and BIOS pages are attached to the content they scroll
- [x] Custom scrollbars have adequate width/contrast

## Notes

- Widths: `GameDetails.jsx` content column 900 → 1400, `RomDownloadsView.jsx` 900 → 1400, `Settings.jsx` shell 1120 → 1760 (panel column grows from ~640 to ~1300+ at a ~2000px window; Emulators' two-column split benefits too). 1400 is a deliberate reading-measure cap — details-page restructure (hero, multi-column) is ticket 05's call.
- One scroll region per screen: the window can never scroll (`AppShell` is 100vh + `overflow: hidden`) and no nested panel scrollbars exist — library/details/downloads each scroll in their single `App.jsx` wrapper, Settings in its single content column, settings nav column is `overflow: hidden`. The app-sidebar platform list keeps its own scroll region *by design*: ~20 platforms overflow a 1080p viewport, and clipping platform navigation is worse than a standard sidebar scroller. Its scrollbar no longer has a bespoke 4px/10%-alpha override — it inherits the theme scrollbar.
- Attachment: Settings' scroll column uses `mr: { xs: -2, sm: -3 }` to reclaim the shell padding, so the scrollbar hugs the panel column's right edge instead of floating 24px away (Emulators/BIOS "detached scrollbar" finding). The margin values must mirror the shell's `p: { xs: 2, sm: 3 }` — coupling documented in a comment on the column.
- Scrollbar styling (`src/ThemeContext.jsx`): 12px track / 8px visible thumb (was ~4px), thumb at 24% white on dark / 24% black on light (was #252525-on-#121212, near-invisible), hover uses the accent color, Firefox `scrollbarColor` updated to match. `Sidebar.jsx`'s hardcoded override removed. `src/theme.js` contains an orphaned duplicate of the old scrollbar rules but is not imported anywhere — left untouched.
- Verification: `bun run typecheck`, `bun run lint:frontend` (7 pre-existing warnings, 0 errors), all 107 unit tests, and `vite build` all pass. In-app visual pass not run — browser automation was blocked in the agent session.

## Smoke test (human)

At a wide window (~2000px):
1. Open a game's details page — content fills the window far beyond the old narrow strip.
2. Open Settings → Emulators and Settings → BIOS — panels are wide, and their scrollbar sits flush against the panel column's right edge.
3. Open Downloads — page is wide, not a centered strip.
4. Any long screen: scrollbar is an easily visible track (not a thin grey hairline).
