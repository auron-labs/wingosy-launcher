# 02 — Make game-details menus controller-operable

**What to build:** Let a player complete the game-details three-dot menu flow
with the same controller intents used elsewhere: open the menu, move between its
enabled items, activate the selected item, and return to details without using a
keyboard or mouse.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Confirm/Open on the focused three-dot action opens its menu exactly once.
- [ ] Directional controller input moves only among visible enabled menu items, and Confirm/Open activates the selected item once.
- [ ] Back closes the menu and restores details focus without navigating away from the details page.
- [ ] While the menu is open, controller input cannot move or activate background details controls.
- [ ] Existing keyboard and mouse menu behavior remains unchanged.
