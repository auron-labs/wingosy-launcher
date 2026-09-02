# 01 — Design-system pass: typography, buttons, and interaction states

**What to build:** A shared design foundation so every screen becomes readable and scannable: body and secondary text sized up from ~11–12px with proper contrast on dark backgrounds; a clear button hierarchy where only one filled-primary action exists per screen (no more filled indigo for Play, "Scan ROM Directory", "Check for updates", "Retry", and "Download 129 missing" simultaneously); a single consistent visual treatment for disabled controls; and a single destructive-action pattern (consistent styling + confirmation) replacing today's mix of bare red text links and red menu items.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Body/secondary text meets comfortable desktop readability (size and contrast) across all screens
- [x] Button hierarchy defined and applied: at most one primary per screen, secondary/destructive clearly differentiated
- [x] Disabled controls are visually distinct from secondary copy and non-interactive in appearance
- [x] One shared destructive-action pattern exists and replaces ad-hoc red text links / red menu items
- [x] Destructive pattern includes a confirmation step

## Notes

- Theme floors in `src/ThemeContext.jsx`: `body2` 14px, `caption` 13px, brighter `text.secondary` per mode; disabled buttons kept at MUI's low alpha so they read clearly dimmer than secondary copy.
- Library-tile labels/badges (`GameCard.jsx`, `ImmersiveGameTile.jsx`) still use 9.6–11px text by design of the tile layout — those exact findings ("illegible tile badge", immersive "large-type claim") are owned by tickets 03 and 04, which redress the tiles wholesale.
- Shared destructive pattern: `src/components/ConfirmDestructiveDialog.jsx` (error-contained confirm + Cancel + confirmation copy), adopted by both game-details views (Delete Download) and Settings → RomM (Disconnect). Red error styling outside the pattern removed (immersive "Exit to desktop" is navigation, now neutral).
- One primary per screen: Play stays contained; Download (download-when-not-played), Sync to RomM, and emulator Install rows are outlined. Settings pages keep exactly one contained button each.
