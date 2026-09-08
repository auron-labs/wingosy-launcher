# 02 — Configure Controller for Eden

**What to build:** Add a Settings flow that natively discovers and captures one standard controller for Eden, persists its mapping by normalized SDL hardware GUID, and applies a Wingosy-owned Eden input profile when the user presses Play. Reconnecting the same model should restore the mapping while the transient runtime port may change; missing hardware should warn and fall back to Eden defaults without blocking play or disturbing user configuration and navigation.

**Blocked by:** None — can start immediately
**Status:** resolved

## Acceptance criteria

- [x] Native discovery and capture records one player’s standard buttons, sticks, triggers, D-pad, start, select, and guide controls.
- [x] Persistence uses a normalized SDL GUID as model identity; the runtime controller port is not persisted as physical-unit identity.
- [x] The persisted physical-control mapping remains emulator-neutral and backward-compatible with existing config; only its Eden translation is implemented here.
- [x] A reconnecting controller with the same normalized GUID restores its mapping, while a different GUID does not inherit it.
- [x] Browser Gamepad identification is not authoritative for Eden controller identity.
- [x] On Play, Wingosy creates or updates only its own Eden profile and safely replaces its prior generated profile when needed.
- [x] Existing Eden profiles, unrelated settings, Wingosy user configuration, and navigation/deadzone behavior remain unchanged.
- [x] A missing controller reports a warning and uses Eden defaults; it does not block launch.
- [ ] The selected maintained SDL binding passes a minimal compatibility check in the real packaged application as part of this ticket, not as a standalone probe or prerequisite.

## Verification

- [x] Automated seam coverage proves persistence across reconnect, GUID isolation, safe profile replacement, user-data preservation, and Eden-compatible translation.
- [ ] Human check: configure one real controller, reconnect it, and confirm mapped buttons and sticks work in Eden.

## Scope boundaries

- One player and standard controls only; no gyro, motion, paired Joy-Con, rumble tuning, macros, turbo, or per-game mappings.
- A failure to normalize native controller identity or pass source packaging compatibility blocks only the affected controller implementation; do not guess from browser strings or claim a fake fallback.
- No generic emulator controller framework or controller work for other emulators.

## Comments

- 2026-09-07: Claimed for implementation. Repository-flow inspection and bounded implementation planning are in progress.
- 2026-09-07: Confirmed the shared launch pipeline, existing portable Eden data-root resolver, Settings emulator card seam, and the sdl3 0.20 gamepad/GUID APIs. Implementation will add one focused native controller/profile module, config persistence, two discovery commands, and Eden-only prelaunch injection.
- 2026-09-07: Added the native SDL controller module, GUID-keyed emulator-neutral persistence, Settings capture flow, Eden profile generation/injection, and seam tests. Focused frontend and controller tests pass; Windows packaged compatibility and the repository's existing Tauri capability-schema blocker remain unresolved.
- 2026-09-07: Corrected Eden's Nintendo face-button translation (A/B and X/Y now follow the pinned SDL EAST/SOUTH/NORTH/WEST bindings), surfaced missing or malformed controller preparation through `LaunchGameResult.save_sync_warnings`, and retained those warnings on success and non-zero-exit results. Added staged profile replacement with rollback, artifact-cleanup coverage, pure reconnect/GUID-selection coverage, and config coverage for legacy controller data. The pinned Eden field contract and exact `-input-profile Wingosy` behavior were rechecked. Failure injection for rollback is not deterministic without test-only production hooks, so successful replacement and artifact cleanup are covered; the existing Tauri ACL build blocker and Windows packaged/hardware check remain open.
- 2026-09-07: Corrected the pinned Eden profile contract by emitting `<key>\\default=false` before every generated button/analog value and quoting comma-containing ParamPackages. Extended SDL axis parsing to retain positive/negative half-axis direction, translating trigger half-axes while rejecting them for sticks; full-axis `~` inversion remains supported. Added focused parser and profile assertions. Rust execution remains blocked before compilation by the unchanged Tauri ACL schema error; no packaged or hardware criteria were marked complete.
- 2026-09-07: Standards correction complete: restored the auto-generated `.scratch/STATE.md` artifact to its HEAD contents without changing the claimed ticket or implementation files.
- 2026-09-07: Independent code review approved the Spec axis. Standards review requested one correction: remove the working-tree change to auto-generated `.scratch/STATE.md` (or regenerate it through the tracker workflow) before re-review.
- 2026-09-07: Final Rust verification ran with a temporary empty `permissions` array in `src-tauri/capabilities/default.json`; focused `controller::tests` passed 8/8. The full `mise exec -- cargo test --manifest-path src-tauri/Cargo.toml` run compiled successfully and reported 288 passed, 6 failed, and 1 ignored; the six failures are existing RetroArch integrity-message expectations plus cascading test-lock `PoisonError`s, with no controller-test failure. The capability file was restored byte-for-byte, and `git diff --exit-code -- src-tauri/capabilities/default.json` passed. `git diff --check` passed; no implementation fix was needed.
- 2026-09-07: Final independent review approved both Standards and Spec axes. The implementation is ready for the required Windows packaged-app/controller checks; the ticket remains open as `ready-for-human` because those checks cannot run in this Linux worktree.
- 2026-09-07: Reclaimed as the next active ticket. Per the explicit instruction to ignore waiting for human, the remaining Windows packaged-controller checks are treated as waived, not passed; their checkboxes will remain unchecked and the existing implementation will be re-verified before administrative resolution.
- 2026-09-07: Inspected the controller implementation and its Settings, command, config, and launch seams; the implementation from `baeb728` and its recorded follow-up corrections are present, with no unfinished agent-actionable implementation item and no application-code change needed. Verification: `mise exec -- bun run test:unit -- src/components/Settings.test.jsx` passed (1 file, 28 tests); `mise exec -- cargo test --manifest-path src-tauri/Cargo.toml controller::tests -- --nocapture` was blocked before tests ran by the unchanged Tauri ACL schema error, `Permission core:window:allow-start-dragging not found`; `git diff --check` passed. The explicit user waiver closes this ticket administratively while acceptance criterion 18 and Human check 23 remain unchecked, waived, and unverified—not passed.
- 2026-09-07: Post-completion `code-review` approved both Standards and Spec with no findings. The review confirmed that the generated state is consistent, the closure is narrowly scoped, and the two Windows/hardware checks remain honestly recorded as waived and unverified.

## Answer

Wingosy now discovers SDL3 standard controllers natively on Windows, captures one-player physical bindings into backward-compatible GUID-keyed config, and restores the mapping for the same normalized controller model without persisting its transient runtime port. Eden launches generate and select only the staged `Wingosy.ini` input profile, using Eden-compatible default flags, quoting, Nintendo face-button semantics, triggers, D-pad, and stick parameters; missing or invalid controller setup warns and falls back without blocking play.

Focused Settings coverage passes, and all eight controller Rust tests pass after temporarily bypassing the repository's pre-existing Tauri ACL-schema mismatch and restoring that file byte-for-byte. The full Rust suite compiles but has six unrelated existing RetroArch assertion/lock failures; the full frontend suite has one unrelated existing duplicate-import parse failure. A Windows release package with a real controller is still required to validate the statically linked SDL3 binding and complete the human reconnect/control check.
