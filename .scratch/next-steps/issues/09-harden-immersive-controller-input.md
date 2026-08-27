# Harden immersive controller input

Type: task
Mode: agent
Status: ready-for-human
Blocked by: 04

> Follow this plan step by step and update `../spec.md` when done.
>
> Drift check: `git diff --stat a96ce03..HEAD -- src/immersive DEV_README.md`

## Status

- **Priority:** P0
- **Effort:** M
- **Risk:** MED
- **Depends on:** 004
- **Category:** controller input / accessibility
- **Planned at:** commit `a96ce03`, 2026-08-23

## Why this matters

The immersive mapper treats raw button indexes as the W3C standard layout even
when the browser says no mapping is known, selects the first connected pad, and
shows Xbox-specific A/B labels. Unknown, disconnected, or multiple controllers
can therefore trigger the wrong action or leave confusing input state.

## Current state

- `src/immersive/useGamepadKeyboardMapper.js:107-147` reads fixed standard-layout
  indexes without checking `Gamepad.mapping` and uses `pads.find(Boolean)`.
- `src/immersive/useGamepadKeyboardMapper.js:39-56` translates controller actions
  into synthetic keyboard events.
- `src/immersive/ImmersiveHintBar.jsx:33-60` labels confirm/back as A/B.
- Existing tests exercise keyboard handlers but not Gamepad API polling, hot-plug,
  multiple pads, or unknown mappings.
- The W3C only guarantees canonical indexes when `mapping === "standard"`; see
  [the research note](research-emulator-controller-patterns.md#4-make-the-immersive-mapper-standard-layout-only-and-present-actions-by-physical-position).

## Scope

In scope: the existing immersive mapper, controller-neutral hints/status, a small
deadzone preference, and focused unit/runtime checks. Out of scope: Steam Input,
SDL databases in the WebView, device-ID heuristics, full rebinding, haptics,
radial menus, multiplayer assignment, and emulator gameplay mapping (RetroArch
owns that).

## Steps

1. Ignore pads whose `mapping` is not `standard`; if none is usable, emit no
   action and show one concise status directing the user to keyboard input or a
   standard/XInput controller. Do not infer layout from the unspecified device ID.
2. Track the last standard-mapped pad that produced input as the active pad. On
   disconnect, clear held/repeat state and allow the next standard pad to become
   active. A second pad must not duplicate an action from the active pad.
3. Name actions by intent in code and UI: **Confirm/Open**, **Back**, **Menu**, and
   directional navigation. Replace A/B text with controller-neutral labels;
   retain keyboard labels for recovery. Reuse the existing event route described
   in `DEV_README.md:30-34` for actions that are not literal keyboard operations;
   do not introduce an input framework.
4. Preserve the existing repeat behavior and dialog/menu suppression. Expose only
   the existing stick deadzone as a small persisted setting with a safe bounded
   range and reset default of `0.35`; hardware drift justifies this one knob.
5. Add one focused mapper test covering: standard input emits once, unknown input
   emits nothing, a standard second pad can be selected, disconnect clears held
   input, reconnect works, simultaneous pads do not duplicate, and sub-deadzone
   axis noise does not navigate.
6. Run plan 006's real XInput navigation/hot-plug case. Document unsupported pads
   as best-effort and send gameplay-binding failures to RetroArch's native
   **Set All Controls → Save Controller Profile** recovery path.

## Verification and done criteria

- [ ] No fixed button/axis index is interpreted for a non-standard mapping.
- [ ] Disconnect/reconnect and two connected pads cannot leave a held or duplicate
      launcher action.
- [ ] Hints describe actions without assuming Xbox, Nintendo, or PlayStation labels.
- [ ] Keyboard navigation remains available when no supported pad exists.
- [ ] The deadzone setting is bounded, persists, and resets to `0.35`.
- [ ] `bun run test:unit`, `bun run typecheck`, and `bun run lint:frontend` pass
      without new warnings.

## STOP conditions

- The target WebView does not expose a reliable standard mapping for the claimed
  XInput baseline; record the device/WebView evidence before adding heuristics.
- A proposed fix requires controller-specific IDs or a bundled mapping database;
  keep that controller best-effort until beta evidence justifies the maintenance.

## Maintenance notes

The launcher promises standard-mapped navigation, not universal controller
support. Add remapping only after repeated beta failures cannot be recovered in
RetroArch itself.

## Implementation note

The mapper, neutral recovery status, persisted bounded deadzone, and focused
polling/config/hint tests are implemented. Verification on 2026-08-24:

- `mise exec -- bun run test:unit` passed 55 tests.
- `mise exec -- bun run typecheck` passed.
- `mise exec -- bun run lint:frontend` passed with 7 pre-existing warnings and no
  errors or new warnings.
- `mise exec -- bun run test:rust` was attempted but blocked before tests by the
  missing system library `javascriptcoregtk-4.1`.

Real Windows/XInput navigation and hot-plug behavior remains for human
verification. Keep this issue `ready-for-human` and unresolved until that check
is completed.

### 2026-08-26 — Native Windows automated verification

Windows typecheck, 74 Vitest tests across 11 files, frontend build, and frontend
lint all passed; lint retained 7 pre-existing warnings and no errors. The full
native Rust suite also passed (270 unit tests with 1 ignored, plus 4 emulator and
4 RomM parsing integration tests). No controller was available to Computer Use,
and the fullscreen Tauri/WebView window rejected injected input after the
documented recovery, so the real XInput navigation, hot-plug, and second-pad case
remains required. Keep the ticket `ready-for-human`.

### 2026-08-27 — Acceptance failure claimed

Native Windows acceptance recorded that controller navigation stops working on
the ROM details view while the rest of the primary-controller case works. The
agent follow-up is claimed to reproduce that exact route, fix its root cause,
and add the narrowest regression check before the hardware case is repeated.

### 2026-08-27 — Regression and fix complete

The focused regression reproduced the failure through real Gamepad polling and
the synthetic keyboard route: directional events reached the details view, but
that view had no directional focus handler. The details view now moves focus
across enabled actions, activates the focused action on Confirm, and retains
dialog/menu suppression. The regression went from 1 failure to 9 passing tests;
the full 75-test frontend unit suite, typecheck, build, and frontend lint passed.
Lint retained 7 pre-existing warnings and no errors or new warnings.

### 2026-08-27 — Review findings

Independent standards and ticket reviews confirmed the mapper-to-details
regression route, but found two gaps before acceptance: Confirm retries a failed
launch even when another details action is focused, and the generic focus query
can include hidden or non-actionable tabindex elements. Focused checks for
selected-action Confirm and dialog/menu suppression are also required. The same
implementation agent is addressing these findings before final verification.

### 2026-08-27 — Review findings addressed

Details navigation now limits selection to visible enabled buttons, Confirm
prefers the selected details action before the launch fallback, and focused
regressions cover Confirm plus menu/dialog suppression. Verification passed with
12 focused tests, 78 full frontend unit tests, typecheck, build, frontend lint
with the same 7 pre-existing warnings, and `git diff --check`.

### 2026-08-27 — Agent follow-up ready for hardware retest

Final standards and ticket reviews passed after restoring strict modal
suppression and exercising the genuine mapper direction → selected details
action → Confirm route. The Windows acceptance blocker now has a deterministic
regression, and all automated checks above are green. Repeat the primary XInput
details-navigation/hot-plug case on Windows; keep this ticket `ready-for-human`
until that real-controller run passes.
