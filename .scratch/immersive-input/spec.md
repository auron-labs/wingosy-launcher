# Deepen immersive input routing

Status: ready-for-agent

## Problem Statement

In Immersive mode, a controller action can depend on which screen, menu, or dialog is open. The current controller mapper chooses DOM targets and sends synthetic keyboard events, while the shell, library, and game details each interpret those events separately. This makes input changes easy to scatter and raises the chance that one action moves focus, activates a control, or navigates twice.

## Solution

Keep the same controller and keyboard behavior for players. Give immersive input one clear owner for controller action routing and active-view priority, using the existing app interaction flow as the seam. A press should reach the appropriate visible receiver once; menus and dialogs retain priority, and native keyboard use keeps working.

## User Stories

1. As a player, I want the D-pad or left stick to move through the Immersive Library, so that I can browse games without a keyboard.
2. As a player, I want A to open the focused game or activate the focused action once, so that a single press has one result.
3. As a player, I want B to close the active menu or dialog before leaving game details, so that Back follows what I see.
4. As a player, I want directional input in game details to move among visible enabled actions, so that I can choose an action reliably.
5. As a player, I want an open menu or dialog to receive controller input ahead of the screen behind it, so that background focus and actions do not change.
6. As a player, I want Library section and platform navigation to continue working with controller buttons, so that browsing remains consistent.
7. As a player, I want search text entry and native keyboard navigation to behave as before, so that typing does not trigger controller shortcuts.
8. As a player, I want held directions to respect the current initial delay and repeat rate, so that focus neither races nor stalls.
9. As a player, I want a disconnected or replaced controller to stop sending stale held input, so that focus stays under my control.
10. As a player, I want the existing unsupported-controller hint to remain accurate, so that I know when my controller cannot navigate Wingosy.
11. As a player, I want shell shortcuts such as hints, settings, and exit to act only in the appropriate view, so that a screen change does not trigger an unrelated action.
12. As a maintainer, I want a routing change to be made in one immersive input module, so that controller behavior is easier to verify across views.

## Implementation Decisions

- Keep the existing standard Gamepad decoding, deadzone, controller ownership, disconnect handling, and repeat timing. Deepen the current immersive input module instead of creating a second polling or input framework.
- Place the active-view routing and overlay priority in one module. The shell, library, and game details keep their own view-specific actions and focus behavior; they should not each need to know how a controller event reached them.
- Use one app-level interaction seam for controller actions. Reuse existing callbacks and view state where possible. Do not add a global event bus, a generic command registry, or a configurable routing graph.
- Remove controller routing that depends on querying a library or details test identifier, or dispatching the same action to both the window and the library root. Keep only DOM inspection needed to honor currently open native menus and dialogs.
- Preserve existing controller mappings, menu/dialog priority, one-action-per-press behavior, debug correlation, and native keyboard shortcuts. No visible redesign is required.
- Keep implementation internal to Immersive mode. No Rust command, database, settings schema, or new app route is needed.

## Testing Decisions

- Test observable results at the existing Immersive mode app seam: focus moves to the intended visible control, activation happens once, Back follows the active view, and an open menu or dialog blocks background actions. Avoid assertions on synthetic event targets, internal state, or helper call counts.
- Reuse existing app, library, and game-details behavior tests as prior art; update or replace brittle mapper routing tests when their implementation assumptions disappear. Retain the focused tests that cover real deadzone, repeat, ownership, and reconnect behavior.
- Add only the smallest missing regression check for any changed routing behavior that the existing tests do not cover. Do not require a new harness, broad test matrix, or hardware smoke test for this refactor.
- For app smoke testing, use the existing Tauri MCP path to check one controller-driven Library-to-details-to-Back flow if a running development app and controller source are available. Do not add a human smoke step solely to repeat automated checks.

## Out of Scope

- New controller mappings, remapping UI, support for nonstandard layouts, or multiple simultaneous players.
- Changes to emulator input, Eden controller profiles, RetroArch behavior, or the virtual-gamepad adapter.
- A general input framework for desktop Settings, downloads, or future views.
- Visual redesign, new routes, new screens, or new screenshot captures.

## Further Notes

The deletion test for the deepened module is whether removing it would force active-view and overlay priority rules back into multiple callers. If a proposed helper only forwards actions, omit it. Existing controller acceptance fixes and behavior tests are the compatibility baseline.
