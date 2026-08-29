# 01 — Honor the controller's initial repeat delay

**What to build:** Make immersive directional input distinguish a quick tap from
a held direction, so an ordinary D-pad or stick press moves exactly once while a
deliberate hold starts predictable repeated navigation.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] A quick D-pad or stick press produces exactly one launcher movement in both the library and game details.
- [ ] A held direction waits for the existing 240 ms initial delay before repeating at the existing 110 ms interval.
- [ ] Releasing or disconnecting the active controller stops repeat immediately, and reconnecting does not replay stale input.
- [ ] A focused timing regression proves the initial delay and repeat interval independently.
