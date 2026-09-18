# 02 — Route game-details and overlay controller actions by visible priority

**What to build:** Complete the centralized Immersive controller route so game details, menus, and dialogs receive actions according to what the player can currently see. Details navigation and activation happen once, while an open menu or dialog takes priority over the screen behind it and Back closes that overlay before leaving details.

**Blocked by:** 01 — Route Library and shell controller actions through the Immersive app seam.

**Status:** ready-for-agent

- [ ] Directional controller input in game details moves focus among visible enabled actions, and A activates the focused action once.
- [ ] B closes an active menu or dialog before navigating from game details back to the Library.
- [ ] An open menu or dialog prevents controller input from moving background focus or triggering background actions.
- [ ] Routing no longer depends on querying Library or game-details test identifiers or dispatching the same action to both the window and Library root.
- [ ] Existing controller mappings, native keyboard shortcuts, debug correlation, and focused deadzone, repeat, ownership, and reconnect behavior remain unchanged.
- [ ] Observable app-seam tests cover details focus movement, single activation, Back priority, and overlay suppression; mapper tests tied only to removed routing internals are updated or removed.
