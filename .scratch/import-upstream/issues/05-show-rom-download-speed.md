# 05 — Show live ROM download speed

**What to build:** Show a readable, current transfer-speed estimate for each active ROM download without changing existing ROM identity, deduplication, or transfer behavior.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Active ROM download state exposes a per-ROM speed estimate in the existing download presentation, with each transfer keeping its own identity and rate.
- [x] Speed is updated from recent transfer activity in readable units and is removed or reset when a transfer becomes inactive or terminal, so completed and failed entries never retain a stale active speed.
- [x] The transfer representation remains suitable for BIOS progress surfaces without adding a dependency on the BIOS queue work; existing ROM download safeguards and deduplication remain intact.

**Context:** Parent spec: “Selective upstream adoption”; source issue #5. The shared transfer-speed representation may be reused by ticket 06 whichever lands first; there is intentionally no blocker edge.

## Verification

- [x] Exercise an active ROM transfer through the existing download boundary and confirm its live speed and terminal clearing; use representative units rather than adding an exhaustive speed-format matrix.

## Comments

- 2026-09-18: Claimed for implementation. Plan: (1) add a recent-rate estimate to the existing backend transfer progress and ROM event, (2) carry and render that per-ROM rate in the current download state/view with focused regression coverage, and (3) run targeted/full repository checks and address only ticket-related failures. Preserve ROM identity, deduplication, transfer behavior, and terminal-history shape; do not add BIOS queue behavior.
- 2026-09-18: Slice 1 complete. The shared Rust download progress now derives a per-transfer recent byte rate and the ROM progress event exposes its readable speed. Rust formatting and diff checks pass; the focused Rust test command is currently blocked during Tauri capability validation because `core:window:allow-start-dragging` is unavailable in the installed permission set.
- 2026-09-18: Slice 2 complete. The provider keeps speeds isolated by game ID, resets them on restart, removes active state on completion/failure, and the Downloads view shows the readable rate. Focused provider/view tests pass (4 tests), and focused frontend lint/format checks pass. The repository typecheck remains blocked by pre-existing errors in untouched immersive-library/detail files.
- 2026-09-18: Slice 3 complete. Final implementation inspection confirmed the shared `DownloadProgress` rate remains reusable, while ROM atomic-download and deduplication paths are unchanged. Focused frontend tests (4), Rust formatting, frontend lint/format, and diff checks pass. The full frontend run reached 212 passing tests before 42 unrelated existing failures; full typecheck/lint remain blocked by existing immersive errors, and Rust test/clippy startup remains blocked by the unavailable Tauri `core:window:allow-start-dragging` permission.
- 2026-09-18: Two-axis code review approved the implementation against repository standards and the ticket/spec. A review follow-up corrected the estimator so the first chunk establishes a baseline rather than displaying an inflated startup rate. Clippy and ignored Rust download integration execution remain blocked by the same pre-existing Tauri capability validation error.

## Answer

Active ROM downloads now carry an independent recent byte-rate estimate from the shared Rust download boundary through the existing game-keyed frontend state and display it in readable units on Downloads. Starting or restarting a transfer clears its prior speed, and completion/failure removes the active entry without copying speed into recent history. Existing atomic-download, identity, and deduplication behavior is unchanged.
