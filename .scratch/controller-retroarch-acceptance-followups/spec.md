# Controller and RetroArch Acceptance Follow-ups

## Source

The one-controller Windows run recorded in
`../next-steps/evidence/20260828-225824-controller-acceptance.md` confirmed that
immersive game-details navigation and controller reconnect work, while exposing
four remaining beta blockers.

## Outcome

Wingosy should provide predictable one-action controller navigation, complete
controller operation of game-details menus, a managed RetroArch installation
that is ready to launch with its promised cores and native controller
autoconfiguration, and a clean return to a focused immersive window after the
emulator exits.

## Scope

- Correct the existing immersive controller repeat behavior.
- Complete the controller path through game-details menus.
- Reconcile managed RetroArch core status, launch resolution, and native
  standard/XInput autoconfiguration.
- Restore Wingosy foreground/fullscreen state after RetroArch exits.

The existing Windows beta certification ticket remains the final human gate.
Second-controller support, universal controller mappings, in-app rebinding, and
new emulator families remain outside these follow-ups.

## Dependency graph

| Number | Title | Blocked by |
|---|---|---|
| 01 | Honor the controller's initial repeat delay | None |
| 02 | Make game-details menus controller-operable | None |
| 03 | Make the managed RetroArch install ready to play | None |
| 04 | Restore Wingosy after RetroArch exits | None |

The four fixes are independent. The existing Windows beta certification gate
should be repeated only after all four are complete.
