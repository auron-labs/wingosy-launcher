# 03 — Make the managed RetroArch install ready to play

**What to build:** After Wingosy installs or repairs its managed RetroArch
profile, show an accurate core inventory, resolve the promised core for launch,
and let RetroArch recognize a standard/XInput controller through native
autoconfiguration without asking the player to create global bindings first.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Settings shows each promised beta core as required, installed, missing, or invalid using the current managed installation rather than stale state.
- [x] A managed game launch resolves and validates the installed promised core that the status UI reports.
- [x] A standard/XInput controller is recognized by the managed RetroArch installation through native autodetection without a controller-not-configured warning.
- [x] No device ID heuristic or global player binding is hardcoded, and external installations plus user-owned autoconfig/remap files remain untouched.
- [x] Repair restores missing managed core/autoconfiguration assets while preserving user configuration, saves, states, BIOS, remaps, and external installations.
- [x] Focused automated checks cover inventory refresh, core resolution, managed repair boundaries, and controller-autoconfiguration assets before the Windows hardware retest.

## Comments

- 2026-08-29: Implementation agent completed the source and focused test changes. Automated review is pending.
- 2026-08-29: Standards/spec review completed. Follow-up requested for duplicate Settings inventory loading and missing managed core-resolution/repair-restoration coverage.
- 2026-08-29: Correction agent completed the requested state-flow cleanup and focused coverage. Final review is pending.
- 2026-08-29: Final review found successful managed-core resolution and end-to-end repair coverage still partial, plus duplicate managed-install validation. A second focused correction was requested.
- 2026-08-29: Second correction agent completed single-pass launch validation and production repair/core-resolution seam coverage. Final re-review is pending.
- 2026-08-29: Final standards and spec re-reviews passed; focused Rust and Settings checks passed. Ticket resolved.
