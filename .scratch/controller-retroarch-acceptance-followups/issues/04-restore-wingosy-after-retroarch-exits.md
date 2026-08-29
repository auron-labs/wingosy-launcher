# 04 — Restore Wingosy after RetroArch exits

**What to build:** When RetroArch exits, return the player directly to an
interactive Wingosy window with the intended immersive fullscreen state restored,
without leaving the Windows taskbar above the app or requiring a mouse click.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Normal RetroArch exit brings Wingosy to the foreground and restores controller input without a mouse click.
- [ ] If Immersive fullscreen was active before launch, it is restored after return and the Windows taskbar does not remain above Wingosy.
- [ ] Wingosy does not steal focus or change fullscreen while RetroArch is still running.
- [ ] Failure and early-exit paths restore the same usable Wingosy state as a normal exit.
- [ ] Automated process-lifecycle coverage protects focus/fullscreen restoration, followed by one focused Windows smoke test.
