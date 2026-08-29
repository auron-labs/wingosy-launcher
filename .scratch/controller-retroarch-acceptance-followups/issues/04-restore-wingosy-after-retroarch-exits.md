# 04 — Restore Wingosy after RetroArch exits

**What to build:** When RetroArch exits, return the player directly to an
interactive Wingosy window with the intended immersive fullscreen state restored,
without leaving the Windows taskbar above the app or requiring a mouse click.

**Blocked by:** None — can start immediately

**Status:** ready-for-human

- [x] Normal RetroArch exit brings Wingosy to the foreground and restores controller input without a mouse click.
- [x] If Immersive fullscreen was active before launch, it is restored after return and the Windows taskbar does not remain above Wingosy.
- [x] Wingosy does not steal focus or change fullscreen while RetroArch is still running.
- [x] Failure and early-exit paths restore the same usable Wingosy state as a normal exit.
- [x] Automated process-lifecycle coverage protects focus/fullscreen restoration.
- [ ] One focused Windows smoke test confirms focus, fullscreen, taskbar, and controller behavior on real hardware.

## Comments

- 2026-08-29: Claimed for implementation via the `implement` workflow.
- 2026-08-29: Implementation completed in `commands.rs` and `emulators/launcher.rs`. Automated lifecycle, restoration-order, Rust, typecheck, and lint checks passed. The focused Windows smoke test remains pending because this workspace is Linux.
- 2026-08-29: Two-axis review: Standards approved; Spec requested stronger automated proof that restoration only occurs after process completion and removal of the potentially stale configured-fullscreen fallback.
- 2026-08-29: Review corrections completed. Unknown live fullscreen state now avoids fullscreen changes, and lifecycle tests prove restoration actions remain absent while the emulator runs and occur after normal/nonzero exits and preflight failure. All targeted/full Rust checks, clippy, typecheck, lint, and frontend unit tests passed.
- 2026-08-29: Final Standards and Spec re-reviews approved the code. Agent implementation is complete; moved to `ready-for-human` because the required Windows smoke test cannot run in this Linux workspace.
