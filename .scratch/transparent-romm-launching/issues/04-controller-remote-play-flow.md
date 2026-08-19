# 04 — Enable the controller-only remote Play flow

**What to build:** Complete the same one-Play remote workflow in immersive mode with a couch-readable preparation overlay, controller-safe recovery, protection from buffered input, and restoration of the user's prior library context after the emulator exits.

**Blocked by:** 03 — Enable one-click remote Play on desktop.

**Status:** resolved

- [x] A or Enter starts local, cached, or remote preparation from immersive game details.
- [x] The preparation overlay shows the game name, readable stage, percentage when known, transferred and total size when known, and an indeterminate indicator otherwise.
- [x] Successful preparation continues automatically into emulator launch without another action.
- [x] Failure shows a useful message plus Retry and Back actions.
- [x] Retry receives focus when failure appears; A or Enter retries and B or Escape returns.
- [x] Global immersive hotkeys defer while the preparation or error UI owns focus.
- [x] Repeated and buffered controller input cannot start another preparation or game while one is active or the emulator is running.
- [x] Returning from the emulator restores the prior game or library selection and a sensible focus position.
- [x] The explicit pre-cache Download action remains available.
- [x] Automated tests cover controller activation, progress, failure recovery, input suppression, and restored context.
