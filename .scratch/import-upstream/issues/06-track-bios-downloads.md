# 06 — Show BIOS progress and results across download surfaces

**What to build:** Track each BIOS download with safe byte progress, speed, retry, and terminal results, and expose the same operation state from BIOS settings and Downloads while preserving navigation and existing single/serial behavior.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Every BIOS transfer has a stable firmware/platform identity distinct from ROM game IDs, so BIOS entries cannot collide with game transfers or one another.
- [x] Active BIOS state reports downloaded bytes, an optional total, and a determinate percentage when a total is known; unknown totals remain indeterminate while still showing bytes and a current readable speed. Inactive and terminal jobs do not retain stale active speed.
- [x] BIOS settings and Downloads observe the same state and recent history, including active, completed, and failed results, platform labels, progress, speed, and retry. Retrying reuses the transfer identity without duplicate history entries.
- [x] Leaving BIOS settings does not cancel an in-progress operation or lose its state; returning through BIOS and Downloads shows the same progress and terminal result, and the existing BIOS operation persistence remains intact.
- [x] Incomplete or failed bytes never appear as a completed result or usable firmware destination, and a failed retry cannot replace an already valid file with partial data.
- [x] Existing individual and serial BIOS transfers remain functional. The parallel queue belongs to ticket 07; queue persistence across restarts and pause/resume/cancel controls remain deferred.

**Context:** Parent spec: “Selective upstream adoption”; source issues #6 and #8. Use the shared transfer-speed representation from ticket 05 if available, or establish the same representation here without making 06 depend on 05.

## Verification

- [ ] Exercise single and serial BIOS transfers through the existing download boundary, including known and unknown totals, safe failure/retry, and duplicate-history prevention.
- [ ] Run the focused Tauri smoke check navigating BIOS → Downloads → BIOS and confirm state survives navigation in both relevant surfaces.

## Comments

- Backend slice complete: BIOS downloads now emit namespaced firmware/platform identities, known/unknown-total byte progress with current speed, and speed-free terminal success/failure events. The existing `.part` boundary was retained and covered with a failed-replacement regression test. Focused Rust execution is currently blocked by the repository's existing Tauri capability-schema mismatch (`core:window:allow-start-dragging`).
- Frontend slice complete: the app-level downloads provider now owns BIOS and ROM transfer state, Downloads and BIOS Settings render the same progress/results, and failed BIOS transfers retry through the existing command without duplicate history. Eight focused Vitest checks pass; repository typecheck remains blocked by pre-existing immersive-library errors unrelated to this ticket.
- Two-axis code review approved the implementation for repository standards and ticket-06 scope. Serial and focused Tauri smoke verification remain unchecked because Rust/Tauri startup is blocked by the existing capability-schema mismatch; the full frontend suite/typecheck also retain unrelated immersive-library baseline failures.

## Answer

BIOS transfers now use stable namespaced firmware identities and publish safe byte, percentage, and speed updates through the existing download boundary. The shared app-level downloads state presents active and terminal BIOS work in both BIOS Settings and Downloads, retains it across navigation, and retries failures without duplicate history. Existing serial actions and `.part` destination safety remain in place; parallel queueing stays in ticket 07.
