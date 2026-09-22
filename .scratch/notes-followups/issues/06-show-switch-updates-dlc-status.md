# 06 — Show Switch updates and DLC status

**What to build:** Eligible RomM Switch game details show a read-only status beside “Sync Updates & DLC” stating whether Wingosy-managed update/DLC files are current versus missing or changed from RomM. The status loads on open/reopen and refreshes after a successful explicit sync; unavailable/failed checks never claim current.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance

- [ ] On open or reopen of an eligible RomM Switch title, the existing detail surface reports current, missing, or changed update/DLC content relative to RomM.
- [ ] “Current” means Wingosy-managed files match RomM metadata/files; it does not certify Eden-installed content.
- [ ] A successful existing Sync Updates & DLC action refreshes the displayed status.
- [ ] Failed or unavailable status lookup does not display current; existing sync error handling and retry guidance remain intact.
- [ ] Non-Switch/ineligible titles and the existing explicit sync flow retain their current behavior.

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
