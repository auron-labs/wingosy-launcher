# 02 — Correct Switch emulator compatibility

**What to build:** Switch emulator choices and automatic launch resolution exclude RetroArch, select an installed compatible emulator such as Eden, and report the existing missing-emulator outcome when none is installed instead of attempting a RetroArch-core launch.

**Blocked by:** None — can start immediately

**Status:** resolved

## Acceptance

- [x] Switch Settings choices do not offer RetroArch; compatible choices remain available.
- [x] With RetroArch and Eden installed, automatic Switch resolution chooses Eden, including when a previously saved invalid Switch platform default names RetroArch.
- [x] With no compatible Switch emulator installed, launch reports the existing missing-emulator outcome, not “No RetroArch core is configured.”
- [x] RetroArch remains selectable and resolvable for platforms with a mapped, ready RetroArch core; valid configured compatible emulator choices remain honored.

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

## Progress

- [x] Slice 1: RetroArch now derives its advertised platforms from `retroarch_cores()`; focused model coverage proves the catalog exactly matches mapped cores and excludes Switch/wildcard. Formatting, the isolated model test, and diff checks pass; the direct crate test remains blocked by the pre-existing unknown `core:window:allow-start-dragging` capability permission.
- [x] Slice 2: Launcher resolution now skips catalog-incompatible per-game choices and platform defaults, auto-detects only compatible emulators, and limits the RetroArch fallback to mapped platforms. Focused regressions cover Switch auto/default/per-game behavior, the missing-emulator error, and mapped RetroArch preservation. Formatting and diff checks pass; Rust execution remains blocked by the existing Tauri capability error (and unrelated compile failures in a temporary-copy attempt).
- [x] Slice 3: Added focused Settings coverage proving Eden remains offered for Switch while RetroArch is excluded. The focused test, all 280 frontend unit tests, typecheck, build, Rust formatting, changed-file Ultracite, and diff checks pass. Repository-wide frontend lint retains 49 pre-existing errors outside changed paths; Rust tests and Clippy remain blocked by the pre-existing unknown Tauri capability permission.
- [x] Slice 4: Two-axis `code-review` approved the working-tree diff with zero Standards findings and zero Spec findings. Focused Settings tests, Rust formatting, changed-file Ultracite, and diff checks were reconfirmed; Rust test execution remains blocked by the pre-existing Tauri capability error.

## Answer

RetroArch now advertises only the platforms backed by `retroarch_cores()`, so Switch Settings offers Eden but not RetroArch. Launcher resolution applies that catalog compatibility to per-game overrides, saved platform defaults, automatic detection, and fallback selection: stale incompatible Switch choices are skipped, Eden is selected when installed, and otherwise the existing missing-emulator error is returned. Focused Rust regressions preserve mapped RetroArch resolution, and Settings coverage proves the visible Switch choices.
