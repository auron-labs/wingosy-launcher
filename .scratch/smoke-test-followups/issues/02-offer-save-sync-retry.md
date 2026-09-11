# 02 — Offer Retry after save-sync failure

**What to build:** Let a user retry a failed save synchronization from the failure message instead of dismissing it and repeating the surrounding workflow.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] A retryable save-sync failure offers Retry and Close.
- [x] Retry repeats the failed save operation and reports its new result.
- [x] A non-retryable failure does not offer a misleading Retry action.
- [x] One focused UI check covers the retryable and non-retryable states.

## Comments

- 2026-09-11: Claimed after resolving save round-trips. One Luna xhigh worker per item, followed by fresh Luna xhigh verification before each checkbox is closed.
- 2026-09-11: Item 1 implemented by `s02_actions_luna`, independently verified by `s02_actions_verify_luna`: accessible Retry and Close actions, with busy protection; focused rendered suite passed.
- 2026-09-11: Item 2 implemented by `s02_repeat_luna`, independently verified by `s02_repeat_verify_luna`: the retry preserves the failed operation's slot/save ID/file, prevents overlapping dispatch, and shows the new result. Successful uploads still refresh the saves list; successful list retries clear the old failure. The focused Switch download test passed (14/14 component tests); upload and list paths were also inspected.
- 2026-09-11: Item 4 implemented by `s02_ui_check_luna`, independently verified by `s02_ui_verify_luna`: one persistent rendered regression uses a raw chained 503 IPC error, changes the slot after failure, proves exact argument replay and duplicate-click protection, observes the new success, and verifies Close-only dismissal for a permanent missing-save failure. `bun run test:unit -- src/components/GameDetails.test.jsx` passed 14/14.
- 2026-09-11: Item 3 implemented by `s02_classify_luna`, independently verified by `s02_classify_verify_luna`: save commands preserve anyhow error chains, and Retry is offered for recognized transport failures or HTTP 408/429/5xx. Missing saves, paths or slots containing network/timeout/DNS words, authentication failures, unsafe archives, conflicts, and identity errors remain Close-only. Root also verified Rust compilation with `RUSTC_WRAPPER= cargo check --manifest-path src-tauri/Cargo.toml --locked --offline` and the focused 14-test UI suite.

## Answer

Save-operation failures now expose Retry and Close when the error indicates a temporary transfer failure. Retry preserves the failed operation's arguments, prevents concurrent submissions, and displays the new outcome. Permanent failures stay Close-only. One rendered regression covers both states; each acceptance item received a separate Luna xhigh implementation pass and fresh Luna xhigh verification. No live Windows/Eden certification is claimed by this ticket.
