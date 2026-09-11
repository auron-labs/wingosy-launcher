# 05 — Reach ViGEm target readiness

**What to build:** Make the existing virtual-gamepad adapter reach a ready Xbox 360 target on the prepared Windows test machine, or report the exact external prerequisite that prevents readiness.

**Blocked by:** None — can start immediately.

**Status:** ready-for-human

- [ ] The Windows adapter smoke test either reaches Ready or reports a specific actionable driver/device failure instead of an unexplained `TargetNotReady` result.
- [ ] A ready target completes the existing press, release, neutral, and disconnect smoke sequence.
- [x] No driver reinstall or Windows setting change is performed without action-time approval.

## Comments

- 2026-09-11: Claimed after retaining ticket 04's blocked live fullscreen requirements. One Luna xhigh worker per acceptance item, followed by fresh Luna xhigh verification. Code and diagnostics may proceed; no Windows driver or system setting change is authorized without action-time approval.
- 2026-09-11: Readiness worker `s05_readiness_luna` and fresh verifier `s05_readiness_verify_luna` confirmed the lock-pinned `vigem-rust 0.2.0` contract and existing plug/readiness/cleanup flow. The adapter preserves supplied native errors and retries only transient report `TargetNotReady` failures; no speculative retry or prerequisite change was justified. Available Linux checks passed: 5 adapter tests, formatting, all-target check, and Clippy. These do not certify Windows readiness.
- 2026-09-11: Sequence worker `s05_sequence_luna` and fresh verifier `s05_sequence_verify_luna` confirmed the existing Windows smoke performs connect, A press/release, D-pad press/release, neutral, and disconnect; cleanup sends neutral before unplugging. Native execution remains unchecked because no authorized prepared Windows host/device is available. The non-Windows smoke branch was not run or counted as a pass.
- 2026-09-11: Safety worker `s05_safety_luna` and fresh verifier `s05_safety_verify_luna` found no automated driver provisioning or Windows settings mutation path. No reinstall, setting change, or other Windows system action was performed in this work. Safety item closed; the two live items remain open under the user's instruction to retain blocked live checks and continue code fixes.
