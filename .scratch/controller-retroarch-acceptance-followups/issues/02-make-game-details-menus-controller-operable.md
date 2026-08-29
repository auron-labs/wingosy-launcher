# 02 — Make game-details menus controller-operable

**What to build:** Let a player complete the game-details three-dot menu flow
with the same controller intents used elsewhere: open the menu, move between its
enabled items, activate the selected item, and return to details without using a
keyboard or mouse.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Confirm/Open on the focused three-dot action opens its menu exactly once.
- [x] Directional controller input moves only among visible enabled menu items, and Confirm/Open activates the selected item once.
- [x] Back closes the menu and restores details focus without navigating away from the details page.
- [x] While the menu is open, controller input cannot move or activate background details controls.
- [x] Existing keyboard and mouse menu behavior remains unchanged.

## Comments

- Implementation complete: controller key events now route to the open MUI menu; focused tests and the full 84-test unit suite pass. Awaiting code review.
- Code review complete: standards and specification axes passed with no findings.

## Answer

Controller-generated keys are routed to an open MUI menu before any background immersive handlers. MUI therefore owns enabled-item navigation, activation, and Escape-to-close behavior while preserving its existing keyboard and mouse paths. Focused controller tests cover single-open/single-activation, disabled-item skipping, background isolation, and Back focus restoration.
