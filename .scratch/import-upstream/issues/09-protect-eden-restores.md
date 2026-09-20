# 09 — Protect explicitly restored Eden save revisions

**What to build:** Persist and present an explicitly restored Eden revision as protected until meaningful local progress or an explicit replacement/resume action, while keeping restore safety, automatic synchronization, and current Saves behavior intact.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Protection is durable per game/save set and stores the selected server revision plus a stable baseline of restored local contents. Protection applies to that local save set's automatic autosave channel even when the selected server revision came from another slot; timestamp-only changes do not count as meaningful content changes.
- [x] A successful archive restore applies safely and persists local protection before any server acknowledgement, so acknowledgement failure leaves the restore protected. Invalid archives or failed application preserve the prior usable contents and restore state; database-persistence failure follows the existing rollback/failure path and never leaves an unprotected replacement.
- [x] Protection survives restart and sessions where Eden starts but produces no change. While contents remain unchanged, automatic synchronization neither downloads a newer revision nor uploads an unchanged copy merely because Eden exited.
- [x] Once contents meaningfully change, the derived state is uploaded as the next autosave revision. Protection clears only after that upload succeeds or an explicit superseding action succeeds; failed/offline uploads retain protection for the existing lifecycle/retry path.
- [x] A successful explicit replacement updates the selected revision and baseline. A successful explicit upload of the protected local save set or an explicit Resume normal sync action supersedes protection, and restoring the already-current revision is idempotent without creating a stuck suppression state.
- [x] Eden restore, manual save mutation, and automatic reconciliation use the existing per-game activity guard so manual restores cannot race a running Eden process or another save mutation. The existing Saves section in both modes shows the protected/current revision and offers explicit Resume normal sync without adding a dashboard or wizard.
- [x] Displayed Switch save-path information uses the same trusted resolver as actual transfers. Metadata-first identity, pre-launch preparation, post-launch synchronization only after a process actually started (including a non-zero Eden exit), nonblocking launch warnings, and phase-specific pending failures remain intact.
- [x] Reconnect-wide sweeping and archive-derived title/identity fallback remain deferred; this ticket adopts restore protection rather than the entire draft save-sync design.

**Context:** Parent spec: “Selective upstream adoption”; source issue #10. The generic upload correction is ticket 08, but this ticket is independently startable and keeps the protected-restore flow cohesive.

## Verification

- [x] Extend the existing safe save round-trip fixture through restore, restart/reopen, unchanged contents, changed-save upload, acknowledgement/upload failure, invalid archive, and database failure, asserting local contents and durable protection.
- [ ] Run the focused Tauri smoke check in the existing Saves section and confirm the persisted indicator, explicit resume action, and successful changed-save upload release protection.

## Implementation progress

- [x] Add durable per-game/save-set protection storage with selected revision metadata and a stable baseline fingerprint.
- [x] Apply protection transactionally during explicit restore before server acknowledgement.
- [x] Honor protection during automatic reconciliation and explicit superseding actions.
- [x] Serialize manual save mutations with the existing per-game activity guard and expose protection commands.
- [x] Present protection and Resume normal sync in both existing Saves sections.
- [x] Complete available focused backend/frontend verification; the Tauri smoke check remains blocked by the unavailable runnable app/tooling.

## Answer

Implemented durable protected Eden restores, content-based change detection, safe rollback and acknowledgement ordering, guarded explicit mutations, successful-upload/resume supersession, trusted save-path reporting, and persisted protection controls in both existing Saves presentations. Focused desktop tests pass and the review approved both standards and spec compliance. Rust execution and the Tauri smoke check remain blocked by the repository's unavailable generated Tauri permission artifact; immersive tests also retain the pre-existing missing `toSpinePlatformOptions` export.
