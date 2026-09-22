# 02 — Correct Switch emulator compatibility

**What to build:** Switch emulator choices and automatic launch resolution exclude RetroArch, select an installed compatible emulator such as Eden, and report the existing missing-emulator outcome when none is installed instead of attempting a RetroArch-core launch.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance

- [ ] Switch Settings choices do not offer RetroArch; compatible choices remain available.
- [ ] With RetroArch and Eden installed, automatic Switch resolution chooses Eden, including when a previously saved invalid Switch platform default names RetroArch.
- [ ] With no compatible Switch emulator installed, launch reports the existing missing-emulator outcome, not “No RetroArch core is configured.”
- [ ] RetroArch remains selectable and resolvable for platforms with a mapped, ready RetroArch core; valid configured compatible emulator choices remain honored.

## Evidence and context

Original NOTES bullet attribution: “clicking play on cuphead caused ‘No RetroArch core is configured’” and “switch is showing that retroarch is a valid emulator, when it’s not” (`NOTES.md:3-4,13`). The later Eden-install symptom is also reported at `NOTES.md:11-12`. Static inspection finds `default_emulators` advertises RetroArch with `supported_platforms: ["*"]`, while `retroarch_cores` has no Switch mapping. `EmulatorLauncher::resolve_emulator` accepts the wildcard during auto-detection and has an unconditional RetroArch fallback; platform defaults likewise do not validate compatibility. `get_emulators_for_platform` already filters RetroArch when no ready mapped core, so this ticket must not claim every candidate endpoint currently lists RetroArch for Switch. This is code-inspection evidence, not a runtime reproduction.

## Minimal implementation plan

1. Correct the RetroArch catalog entry in `default_emulators` to list only platforms mapped by `retroarch_cores`, so existing compatibility filtering excludes Switch; change helper rules only if the corrected catalog cannot be reused as-is.
2. Apply the same compatibility decision in `EmulatorLauncher::resolve_emulator` for configured game/platform choices, automatic selection, and the fallback path; retain valid mapped-platform RetroArch behavior.
3. Reuse the corrected catalog in existing Settings PlatformDefaults choices only if those choices do not already consume it; retain mapping-compatible per-game and default choices.

## Scope and preservation

Prefer catalog and selection corrections over a compatibility service or duplicate map. Do not add configuration migration, a core installer, an emulator-priority redesign, controller fixes, or filtering changes.

## Targeted verification

Add focused existing Rust launcher regressions for RetroArch plus Eden installed on Switch, including a prior invalid platform default, and for mapped RetroArch preservation. Extend existing Settings-choice coverage only as needed to prove Switch excludes RetroArch; do not add a broad suite.
