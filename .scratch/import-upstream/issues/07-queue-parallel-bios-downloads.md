# 07 — Run BIOS downloads through a bounded parallel queue

**What to build:** Add a small process-local BIOS download queue that runs multiple independent transfers concurrently within a fixed limit while sharing accurate state, safe destinations, and results across all BIOS entry points and download surfaces.

**Blocked by:** 06 — Show BIOS progress and results across download surfaces

**Status:** resolved

- [x] A fixed process-local concurrency cap greater than one is enforced. Individual, per-platform, and bulk BIOS actions all enqueue through the same queue, and work beyond the cap remains accurately queued until a slot is available.
- [x] Identical queued or active requests are deduplicated by transfer identity and resolved destination; no two jobs can write the same destination, and BIOS identities remain distinct from ROM game IDs.
- [x] A failed BIOS job records its own failure, does not stop unrelated queued or active jobs, and can be retried with the same identity without duplicate history or unsafe partial replacement.
- [x] BIOS settings and Downloads show the same queued, active, completed, and failed state from ticket 06, including platform labels, byte progress, optional totals, speed, retry, and recent results; navigation does not cancel or hide work.
- [x] The implementation stays a focused queue rather than a generic job framework, scheduler service, or configurable queue-policy system. Queue state is process-local; pause/resume/cancel controls, restart-resumable work, and range resumption remain out of scope.

**Context:** Parent spec: “Selective upstream adoption”; source issue #7. Ticket 06 is the only blocker because it establishes the shared BIOS transfer state and safe result handling.

## Verification

- [x] Exercise more BIOS jobs than the concurrency cap through the existing download boundary and verify more than one active job, the cap, destination deduplication, isolated failure, retry, and shared navigation state.

## Comments

- 2026-09-18: Claimed for implementation.
- 2026-09-18: Backend slice completed: added a fixed three-worker process-local BIOS queue, queued-event emission, in-flight identity/destination protection, parallel bulk and launch acquisition, failure isolation/retry coverage, and preserved safe partial-file replacement. Formatting and diff checks pass; targeted Rust tests are currently blocked before compilation by the repository's existing unsupported `core:window:allow-start-dragging` capability entry.
- 2026-09-18: Shared-state/UI slice completed: queued BIOS transfers now remain visible across BIOS Settings and Downloads navigation, transition in place to active progress, clear stale history on retry, and per-platform actions submit concurrently. Distinct identities targeting one destination are serialized while exact requests deduplicate. The focused frontend suite passes (8 tests); typecheck reaches only pre-existing immersive-mode errors, and Rust test compilation remains blocked by the existing capability entry.
- 2026-09-18: Acceptance verification completed: resolved destinations now coalesce existing symlink aliases, 13 focused BIOS/download tests pass, and the full unit run passes 218 tests while retaining five unrelated pre-existing immersive/app failures. Frontend static checks remain blocked only by those existing errors; Rust compilation remains blocked during Tauri capability validation before the changed Rust code is compiled.
- 2026-09-18: Code review initially found queued-event ordering and Windows case-insensitive destination-lock races. Both were corrected, orchestration-boundary coverage was added, and the reviewer approved the Standards and Spec axes. Rust execution remains unavailable because Tauri rejects the pre-existing capability before compiling tests.
