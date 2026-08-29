# 03 — Make the managed RetroArch install ready to play

**What to build:** After Wingosy installs or repairs its managed RetroArch
profile, show an accurate core inventory, resolve the promised core for launch,
and let RetroArch recognize a standard/XInput controller through native
autoconfiguration without asking the player to create global bindings first.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Settings shows each promised beta core as required, installed, missing, or invalid using the current managed installation rather than stale state.
- [ ] A managed game launch resolves and validates the installed promised core that the status UI reports.
- [ ] A standard/XInput controller is recognized by the managed RetroArch installation through native autodetection without a controller-not-configured warning.
- [ ] No device ID heuristic or global player binding is hardcoded, and external installations plus user-owned autoconfig/remap files remain untouched.
- [ ] Repair restores missing managed core/autoconfiguration assets while preserving user configuration, saves, states, BIOS, remaps, and external installations.
- [ ] Focused automated checks cover inventory refresh, core resolution, managed repair boundaries, and controller-autoconfiguration assets before the Windows hardware retest.
