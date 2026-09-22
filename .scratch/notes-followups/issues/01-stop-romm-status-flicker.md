# 01 — Stop RomM status flicker

**What to build:** Settings performs one immediate RomM connection check per mount or genuine RomM session change, then continues its existing 30-second polling without the connected-status chip flashing during unrelated Settings or sync rerenders.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance

- [ ] Rerendering Settings for unrelated state or sync activity does not invoke another immediate RomM check or move the status through `checking`.
- [ ] Initial mount, a changed RomM URL/token session, and the scheduled 30-second check still invoke the existing connection check.
- [ ] Existing authenticated/session, disconnect, and online/offline behavior remains unchanged.

## Evidence and context

Original NOTES bullet: “when syncing or adding romm, the ‘connected’ icon in the settings menu switches back and forth super fast” (`NOTES.md:1-2`). Static inspection shows `useSettingsController` builds `runtime` with `{ ...defaultSettingsRuntime, ...dependencies }` on every render; its default `dependencies = {}` is also a new object for omitted dependencies. `useSettingsRommLifecycle` depends on `runtime`, checks immediately, and installs the existing 30-second interval. `checkRommConnection` sets `checking` before resolving online/offline, so each render can restart that sequence. This is code-inspection evidence, not a runtime reproduction.

## Minimal implementation plan

1. Give the merged `defaultSettingsRuntime`/`dependencies` value in `useSettingsController` a stable lifetime when its supplied dependencies have not changed, including callers that omit `dependencies`.
2. Keep `useSettingsRommLifecycle` and `checkRommConnection` as the lifecycle/check implementation; ensure their existing effect still reacts to actual runtime or RomM session changes rather than render identity churn.

## Scope and preservation

Do not replace the polling architecture, add remote-sync requirements, or alter RomM authentication/session/disconnect rules. Reuse the existing Settings fixture/dependency seam rather than introducing a runtime abstraction.

## Targeted verification

Extend the focused existing Vitest Settings lifecycle coverage with a rerender regression: assert no extra immediate check/status flicker, then advance fake timers to prove scheduled polling remains. Cover a real session change through the same seam. No live RomM service is required.
