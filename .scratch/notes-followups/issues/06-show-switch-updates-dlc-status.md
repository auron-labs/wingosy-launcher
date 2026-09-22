# 06 — Show Switch updates and DLC status

**What to build:** Eligible RomM Switch game details show a read-only status beside “Sync Updates & DLC” stating whether Wingosy-managed update/DLC files are current versus missing or changed from RomM. The status loads on open/reopen and refreshes after a successful explicit sync; unavailable/failed checks never claim current.

**Blocked by:** None — can start immediately

**Status:** resolved

## Acceptance

- [x] On open or reopen of an eligible RomM Switch title, the existing detail surface reports current, missing, or changed update/DLC content relative to RomM.
- [x] “Current” means Wingosy-managed files match RomM metadata/files; it does not certify Eden-installed content.
- [x] A successful existing Sync Updates & DLC action refreshes the displayed status.
- [x] Failed or unavailable status lookup does not display current; existing sync error handling and retry guidance remain intact.
- [x] Non-Switch/ineligible titles and the existing explicit sync flow retain their current behavior.

## Evidence and context

Original NOTES bullet: “sync updates & dlc is there, but no way to know if everything is already installed, or if it’s up to date” (`NOTES.md:9-10`). Static inspection shows `sync_switch_content` already retrieves RomM metadata, calls `select_eligible_files`, reads `ContentManifest`, and uses `manifest_has_current_file` to compare server change markers, expected sizes, paths, and local files before reusing content. Detail actions retain only the in-memory sync result, so reopen has no read-only status lookup. Earlier Eden integration and smoke follow-ups are resolved; this ticket does not redo sync or certify Eden. This is code-inspection evidence, not a runtime reproduction.

## Minimal implementation plan

1. Extract/reuse the existing `select_eligible_files`, `read_manifest`, and `manifest_has_current_file` comparison path in a small read-only Switch content status query using the same RomM metadata and content location.
2. Expose that query through a thin Tauri command and `gameDetailsIpc`, with a simple result/uncertain error path rather than a new taxonomy or manifest schema.
3. Load and render the status beside the existing Sync Updates & DLC control in the current Details surfaces, then refresh it after `syncSwitchContentAction` succeeds.

## Scope and preservation

No automatic downloads, scheduler, manifest/schema change, timestamp/history dashboard, Eden inventory/scanner, hashes/security work, or content-pipeline rewrite.

## Targeted verification

Add focused Rust helper tests for current versus missing/changed manifest files. Add existing UI coverage for open/reopen lookup and refresh after explicit sync; mock RomM/IPC rather than using network-heavy tests.

## Progress

- [x] Slice 1: Add the read-only Rust comparison and Tauri/IPC seam. (`get_switch_content_status` reuses `select_eligible_files`/`read_manifest`/`content_file_status`; `manifest_has_current_file` now delegates to the shared per-file classifier. Focused Rust tests cover current, missing, changed, stale-manifest, and missing-over-changed precedence.)
- [x] Slice 2: Load and render the status in both Details surfaces and refresh after explicit sync. (`useSwitchContentStatus` loads on open/reopen and is refreshed by `syncSwitchContentAction`; desktop and immersive render a shared caption component beside “Sync Updates & DLC”, hiding it when the lookup is unavailable.)
- [x] Slice 3: Focused frontend coverage. (`game-details.test.jsx` covers open/reopen, post-sync refresh, and unavailable lookups; `immersive-game-details-actions.test.jsx` covers the immersive surface.)
- [x] Review: Two-axis code review completed; see Notes.

## Notes

- Baseline repair required: `HEAD` did not compile. The `feat/import-upstream` merge (`6857b74`) resolved `src/sync/switch_romm.rs` to a version missing `get_switch_saves_for_device`, `sync_current_switch_save`, and the `SwitchSaveSyncResult.backup_save_id`/`backup_slot` fields that `src/commands.rs` still referenced. Restored the two functions (the sync wrapper now takes `&Database`, matching `negotiated_launch_sync`), dropped the stale test field initializers, and removed an unused `resolve_local_title_save_path` re-export. This was necessary for the ticket’s Rust verification to build at all.
- Rust verification ran with `RUSTC_WRAPPER= /home/aaron/.cargo/bin/cargo ...` because the local `mbx` shim drops colon-containing Tauri dependency env names. `switch_content` tests pass 15/15; full Rust suite 369 passed / 6 pre-existing failures (below).
- Known pre-existing failures unrelated to this ticket (present at `HEAD` after the merge): 6 Rust tests (`emulators::launcher` needs a configured emulator; `eden_save_sync_round_trips…` fails its multipart fixture), and 4 Clippy errors (`api/download.rs` `div_ceil`, `database/connection.rs` needless borrow, two `switch_romm.rs` `too_many_arguments`).
- Review follow-ups applied: (a) `evaluate_content_status` now reports `changed` when the manifest holds a file RomM no longer lists, so stale managed content cannot read as `current`; (b) the `changed` label is neutral (“Update & DLC files need re-syncing”) because it can mean a corrupt/truncated local file, not only a newer server file; (c) the two surface labels share `SwitchContentStatusLabel`; (d) the hook’s lookup logic is factored into one `fetchSwitchContentStatus` callback; (e) the IPC result carries only `status` (dropped unused `title_id`/`total_files`).
- Frontend verification: full Vitest suite 301/301, typecheck passes. Scoped `ultracite` reports only pre-existing `game-details.test.jsx` (`max-lines`, `sort-keys`, `require-await`, two `curly`) and `game-details-utils.js` (`no-duplicate-type-constituents`) findings; no new lint findings were introduced.

## Answer

Eligible RomM Switch details now show a read-only “Wingosy update & DLC files are current / missing / Update & DLC files need re-syncing” caption beside **Sync Updates & DLC** on both the desktop and immersive Details surfaces. The status is computed by a new read-only `get_switch_content_status` command that compares RomM child-file metadata against the same manifest identity used by the explicit sync, loads on open/reopen, refreshes after a successful explicit sync, and renders nothing when the lookup is unavailable — so it never claims “current” without evidence. Non-Switch and ineligible titles are unchanged, and the explicit sync flow is untouched.
