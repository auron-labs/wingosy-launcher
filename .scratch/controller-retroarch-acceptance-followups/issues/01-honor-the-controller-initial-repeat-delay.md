# 01 — Honor the controller's initial repeat delay

**What to build:** Make immersive directional input distinguish a quick tap from
a held direction, so an ordinary D-pad or stick press moves exactly once while a
deliberate hold starts predictable repeated navigation.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] A quick D-pad or stick press produces exactly one launcher movement in both the library and game details.
- [x] A held direction waits for the existing 240 ms initial delay before repeating at the existing 110 ms interval.
- [x] Releasing or disconnecting the active controller stops repeat immediately, and reconnecting does not replay stale input.
- [x] A focused timing regression proves the initial delay and repeat interval independently.

## Answer

Directional input now emits once on the initial press, waits 240 ms before the
first repeat, and then repeats every 110 ms. Release and disconnect clear repeat
state, while a reconnecting controller is ignored until stale held input is
released.

Focused D-pad, stick, release, reconnect, and timing regressions pass. The full
frontend unit suite (82 tests), typecheck, and frontend lint also pass; lint
reports seven pre-existing warnings and no errors.
