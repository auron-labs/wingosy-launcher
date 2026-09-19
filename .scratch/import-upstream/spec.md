# Selective upstream adoption

Status: ready-for-agent

Reviewed: 2026-09-17

Scope and verification approach approved by the user before this spec was written.

## Problem Statement

Wingosy's fork has diverged substantially from upstream. Upstream now has useful library controls, platform-specific RomM synchronization, and working RetroAchievements data. Its issues and draft save-sync PR also identify gaps that remain locally: transfer speed, BIOS progress/concurrency, and protection for intentionally restored save revisions.

A wholesale merge would duplicate features already implemented here and conflict with the fork's paginated library, redesigned immersive shelf, credential handling, and newer Eden integration. Users need the useful missing behavior fitted into the current application, with verification proportional to the changes.

## Solution

Deliver six bounded workstreams through the existing library, game details, settings, downloads, and synchronization flows:

1. **RomM address correction:** recognize mixed-case local hostnames when choosing an omitted URL scheme.
2. **Library controls:** complete sort/filter/search shortcuts and repair the existing desktop pagination bug.
3. **Platform sync monitor:** show per-platform library metadata counts and progress, with Sync, Retry, and Sync all.
4. **RetroAchievements:** enable the existing setting and display real achievement definitions and progress supplied by RomM.
5. **Downloads:** show transfer speed and BIOS byte progress, run a small bounded BIOS queue, and show BIOS transfers on Downloads.
6. **Protected restores:** preserve an intentionally selected Eden save revision until meaningful local change or explicit replacement, and correct generic/manual save uploads.

This is the suggested implementation order, starting with the smallest changes. The workstreams are independently deliverable; achievements do not depend on the sync monitor. Within protected restores, fix the generic upload contract first, then implement durable restore protection and its existing Saves-section presentation.

Keep the current desktop and immersive designs. Add one shared sync-monitor view reachable from both modes. Record upstream work that is already satisfied or deliberately deferred rather than creating duplicate implementation work.

## User Stories

1. As a Wingosy user, I want a local RomM address to work regardless of hostname capitalization, so that setup does not accidentally choose HTTPS for a local HTTP server.
2. As a library user, I want to sort by play count and release year as well as the existing choices, so that I can find games using the information already stored in my library.
3. As a library user, I want to reverse the selected sort while keeping missing values last, so that the order remains useful in either direction.
4. As a library user, I want availability to combine with Favorites, platform, and search, so that I can find downloaded favorites without losing my other selections.
5. As a library user, I want sorting, result counts, and paging to agree across the entire matching library, so that page two and later pages contain the expected games.
6. As a keyboard user, I want `/` to focus search outside editable controls and Escape to clear the focused search, so that searching is quick without disrupting typing.
7. As a library user, I want Back from game details to retain my platform and query context, so that inspecting a game does not lose my place.
8. As an immersive user, I want the selected cover to remain visible and focused as I navigate the shelf, so that controller selection remains understandable.
9. As a RomM user, I want to see server, indexed, and downloaded counts for each platform, so that I can understand what has reached my local library.
10. As a RomM user, I want to sync or retry one platform and see its progress, so that updating one system does not require starting a full-library sync.
11. As a RomM user, I want Sync all to retain full-library reconciliation, so that games from platforms removed from the server do not remain indefinitely indexed.
12. As a RomM user, I want failed or overlapping sync requests to preserve unrelated games and personal state, so that library maintenance does not lose my local information.
13. As a RetroAchievements user, I want to enable the existing integration and see my game's real achievements in either game-details mode, so that Wingosy shows the progress recorded by RomM.
14. As a RetroAchievements user, I want accurate unlock counts, earned points, completion progress, and refresh feedback, so that unavailable or failed requests are not mistaken for zero progress.
15. As a download user, I want readable live transfer speeds, so that I can judge whether active transfers are progressing.
16. As a BIOS user, I want downloaded bytes and total/percentage when available, so that a long firmware transfer is distinguishable from a stalled operation.
17. As a BIOS user, I want several files to download concurrently within a small limit, so that bulk downloads finish efficiently without competing writes to the same destination.
18. As a download user, I want BIOS jobs and their results on Downloads, so that I can leave BIOS settings without losing visibility of queued, active, completed, or failed work.
19. As an Eden user, I want an older revision I explicitly restore to survive restart and automatic synchronization, so that my intentional restore is not immediately undone.
20. As an Eden user, I want an unchanged restored save to remain protected and a genuinely changed save to become the next autosave revision, so that normal progress can resume naturally.
21. As an Eden user, I want acknowledgement or upload failures to retain my restore choice, so that a network error does not expose my local save to replacement.
22. As an Eden user, I want to see the active restored revision and explicitly resume normal synchronization in the existing Saves section, so that the protection is understandable and reversible.
23. As a user of generic/manual save uploads, I want Wingosy to use RomM's supported upload contract and report HTTP failures, so that an unsuccessful upload is never presented as success.

## Implementation Decisions

### Shared approach

- Adapt selected behavior into current modules rather than merging upstream wholesale. Preserve the fork's release ownership, dependency/tooling choices, redesigned immersive UI, existing credential storage, shared launch pipeline, and metadata-first Eden identity resolution.
- Reuse current IPC, RomM client, database, download events/state, and view patterns. Add no generic job framework, new router, new testing framework, or dependency unless a concrete implementation need appears.
- Use the source ledger below as the reviewed baseline. Later upstream changes require their own review; they are not implicitly part of this scope.

### 1. RomM address correction

- Make only the host comparison for scheme inference case-insensitive. Explicit schemes, user-entered path casing, trimming, and the existing public/private address rules retain their current behavior.
- Scheme-less `LOCALHOST:3000`, `RomM.LOCAL:8080`, and mixed-case `.lan` addresses receive HTTP just like their lowercase equivalents.

### 2. Library controls and paging

- Add Most played (`play_count`) and Release year to the current desktop sort controls, plus an accessible ascending/descending toggle. Default Name to ascending and numeric/recent sorts to descending; changing the sort selects that sort's default direction.
- Keep missing sort values last in both directions and use deterministic tie-breaking so paging does not duplicate or skip equal-valued entries.
- Make availability independent of the Favorites/Recent selection so it composes with the existing platform and search constraints. Retain the fork's Downloaded/Not downloaded terminology and current known-local-state semantics; this work does not introduce filesystem rescanning.
- Extend the existing paged command and database filter/count query to support the required sort direction and composed filters before pagination. Reuse the existing sort model, which already supports play count, release year, and direction. Default new IPC arguments so immersive and other current callers keep their existing behavior.
- Return one authoritative page and its matching total. Assign that page directly in the desktop library loader and render it without applying another global slice or conflicting client-side sort/filter. Keep existing stale-request protection, page clamping, and page-one reset when query controls change.
- This fixes a confirmed local defect: the backend already applies the page offset, but the desktop loader slices the returned page again using the global offset, emptying valid pages after page one.
- Use the same availability predicate for membership and counts. Existing path validation must not leave a rendered item contradicting the active filter or silently produce an inconsistent count; account for any state correction made during the request. Availability remains based on Wingosy's known state, not a promise that every file has just been checked on disk.
- Preserve Ctrl/Cmd+F. Add unmodified `/` outside inputs, textareas, selects, and contenteditable regions. Escape clears search only while that search field is focused. Search-related empty results should offer a way to clear the active search/availability constraints.
- Back already preserves desktop platform/query state; verify that behavior rather than adding a history stack.
- The fork's immersive library is now a horizontal shelf. Verify off-screen navigation and focus retention as games are appended and details are closed. Adapt the upstream scrolling fix only if the current behavior fails: target the actual scroll container and preserve search focus and selected-game identity. Do not transplant the old vertical-grid geometry helper.

### 3. Per-platform library sync monitor

- Add a platform overview and scoped-sync command using the existing RomM platform API, paginated ROM fetcher, upsert behavior, and platform-scoped database operations.
- Present platform name, server ROM count, locally indexed RomM count, downloaded count based on known local state, and current progress/result. Clearly distinguish metadata synchronization from ROM downloading and save synchronization.
- Provide individual Sync/Retry and the existing full-library Sync all behavior. Refresh overview counts and affected library data after completion. Session-local status is sufficient; no persistent sync-history database is needed.
- Use one shared monitor view from desktop navigation and immersive utilities, styled for the existing application. Keep active status available across navigation so reopening the view does not imply that an active run has stopped.
- Serialize full and scoped library sync in the backend because they share dirty/deletion tracking. A single activity guard is sufficient. An overlapping request receives a clear busy result instead of starting another pruning pass.
- Preserve retry behavior and personal game state during upsert, including local paths, favorites, hidden status, and play history. Restrict a scoped run's cleanup to the selected platform's RomM entries; unrelated platforms and local-source games survive.
- Prune unseen records only after all relevant pages have been fetched and applied successfully. Clear the run's dirty markers on unsuccessful exit, including database errors, without treating a failed or partial fetch as an empty remote library.
- Keep Sync all's current full-library reconciliation semantics, including removal of indexed games from platforms no longer returned by RomM. Do not substitute upstream's loop over only currently advertised platforms, which misses that case.
- Preserve the full-sync command's existing games-array response used by setup and settings. Factor only the genuinely shared paging/upsert/cleanup behavior needed by scoped sync; avoid unrelated sync refactoring.
- Use remote numeric platform identity for requests. If multiple remote platforms map to one local platform ID, refuse destructive single-platform reconciliation for that ambiguous group and direct the user to Sync all. A new platform-identity schema is outside this change.

### 4. RetroAchievements from RomM

- Enable the existing `display.retroachievements_enabled` preference through the current settings persistence flow. Reuse the connected RomM session; achievement credentials remain managed by RomM.
- Add the RomM API/IPC behavior and load it through one shared game-details integration used by desktop and immersive views. Reuse and extend the current achievement section, overlay, and types.
- Read achievement definitions and the RA game ID from the ROM detail response (`merged_ra_metadata.achievements` and `ra_id`). Read the connected user's progression from `/api/users/me`, matching the game and earned achievement records by present, valid identifiers.
- Explicit Refresh requests incremental progression refresh through `/api/users/{user_id}/ra/refresh`, then reloads the user progression. Ordinary rendering does not force repeated remote progression refreshes.
- Show earned/total achievement counts, earned/total points, completion progress, and each achievement's actual locked/unlocked and hardcore information when supplied. Keep the existing disabled, unsupported, and empty states; do not show invented locked placeholders.
- Correct upstream's optional-ID matching bug: two missing IDs must never count as a match. A missing game RA ID must not select unrelated progression.
- Check HTTP status and propagate user-fetch/refresh failures meaningfully. Do not silently replace an authentication failure with an all-locked result or claim Refresh succeeded when it failed.
- Clear old data when game/session identity changes and ignore late responses from previous requests. For a same-game refresh failure, any retained data must be identified as the previous result rather than newly refreshed progress.
- This is display of RomM-provided progress, not emulator achievement activation or award tracking. Do not add a direct RetroAchievements client, credential store, or persistent achievement cache. Unsupported RomM responses must be explicit rather than presented as valid empty progress.

### 5. Download speed and BIOS transfers

- Extend existing transfer events, app-level state, and the Downloads view with transfer kind/identity and per-transfer progress. ROM entries remain associated with their games; BIOS entries have stable firmware/platform identities that cannot collide with game IDs.
- Report downloaded bytes, optional total, determinate percentage when available, and a recent transfer-speed estimate in readable units. Unknown totals use indeterminate progress while still showing downloaded bytes. Inactive or terminal jobs do not retain a stale active speed.
- Add a small process-local BIOS queue with a fixed concurrency limit greater than one. Individual, per-platform, and bulk BIOS actions all enqueue into that same backend queue. Do not introduce a scheduler service or configurable queue-policy system.
- Deduplicate identical queued/active requests and prevent two jobs from writing to the same resolved destination. A failed job does not stop unrelated queued work, and retry uses the same transfer identity without duplicate history entries.
- Keep incomplete downloads out of completed results and usable firmware destinations. Reuse existing safe-download/validation behavior where applicable; a failed retry must not replace an already valid file with partial bytes.
- BIOS settings and Downloads observe the same queued, active, completed, and failed state, including platform labels, progress, speed, retry, and recent results. Navigating away does not cancel the backend work or lose its visible state.
- Preserve the BIOS operation persistence already implemented locally. That work is a prerequisite to reuse, not proof that byte progress or parallel downloading already exists.
- No operational generic queue or pause/resume engine currently exists behind ROM transfers. Build only the small BIOS queue needed here. Pause/resume, cancellation controls, and restart-resumable transfers are deferred; do not render controls that are not implemented or claim full completion of upstream criteria requiring them.
- BIOS distribution policy and emulator firmware installation remain owned by their existing flows and local follow-up work; this workstream concerns obtaining and tracking downloads.

### 6. Protected Eden restores and manual upload correction

- Adopt the restore-point requirement from issue #10, not the draft PR's entire save-sync implementation. Retain current canonical list/download handling, archive safety, backups, shared Eden data-root resolution, authenticated metadata-first title identity, and started-process-only pre/post-launch lifecycle.
- Correct generic/manual save uploads to use the canonical `/api/saves` endpoint with the ROM identity and multipart `saveFile` contract. Validate HTTP status before reporting success. Device-aware Eden upload already uses the canonical path and should retain its current behavior.
- Persist the explicitly selected revision for the affected game/save set together with a stable baseline of the restored local contents. Use the existing database and hashing/file utilities; ignore timestamp-only changes when deciding whether the save meaningfully changed.
- Associate protection with the local save set whose automatic autosave would otherwise replace the restore, even when the selected server revision came from another slot. Persist enough revision information to show the choice after restart.
- A successful local restore must become durably protected before another automatic reconciliation can replace it. A later RomM download-confirmation failure leaves that protection intact and reports retryable failure. Failed application of an archive must preserve the prior usable save and restore state. If protection cannot be persisted, use the existing restore failure/rollback path rather than leaving an unprotected replacement.
- For unchanged restored contents, automatic synchronization must not download a newer server revision or upload an unchanged copy merely because Eden exited. This rule survives app restart and sessions where the emulator starts but does not change a save.
- Once the local contents meaningfully change, upload that derived state as the next autosave revision. Clear protection only after successful upload or an explicit superseding action; failed/offline uploads retain it for the next eligible attempt through the existing save lifecycle/retry behavior.
- A successful explicit replacement updates the selected revision/baseline. A successful explicit upload of the protected local save set or an explicit Resume normal sync action can supersede protection. Restoring an already-current revision is idempotent and must not create a stuck suppression state.
- Expose persisted revision/protection state in the existing Saves section in both modes, with an explicit way to resume normal synchronization. Reuse current notices and retry presentation rather than adding a dashboard or restore wizard.
- Serialize manual save mutations and automatic reconciliation for the same game through the current per-game activity mechanism so the baseline cannot be measured while Eden or another restore is changing it. Keep the existing nonblocking launch warnings and phase-specific pending failures.
- Make displayed Switch save-path information use the same trusted resolver as actual transfers. Do not reintroduce the draft's filename-first/archive-derived title guessing.

## Testing Decisions

The user approved existing high-level behavior seams and short Tauri smoke checks. Test externally meaningful outcomes, not helper structure, copied implementation logic, every UI label, or all permutations of emulator/platform state.

### Focused automated verification

- **Library:** extend the existing real-App/injected-IPC test seam to show page two from a 61-game result and exercise a composed filter/sort change. Extend existing in-memory database paging coverage for the added sort modes/directions, missing values, stable ties, and filter/count agreement. Reuse existing checks for behavior that already works.
- **Platform sync:** use the existing RomM client fixture and database seam for a paginated scoped success and an interrupted later-page run. Verify selected-platform pruning, preservation of unrelated/local/personal state, and rejection of overlapping sync. Exercise actual sync orchestration rather than only row-status helpers.
- **Achievements:** use a compact RomM response fixture to prove correct earned/locked mapping, including the concrete missing-ID false-unlock regression and rejected refresh. Use the existing injectable game-details IPC seam for switching games while a request is pending. Reuse disabled/empty-state coverage.
- **Downloads:** verify the queue through its existing download boundary: more than one active job, enforced limit, destination deduplication, failure/retry, and shared progress across navigation. Test transfer outcomes and queue state, not every speed-formatting unit or internal worker function.
- **Saves:** extend the existing safe save round-trip fixture through restore, database reopen/restart, unchanged contents, changed-save upload, and acknowledgement/upload failure. Assert resulting local contents and durable protection, retaining existing invalid-archive coverage. Check generic uploads against a fixture that accepts the canonical request and rejects HTTP errors.

Use these existing seams; a new universal test harness or separate helper-level suites are not a prerequisite. Small hostname and shortcut changes can be verified with current checks and direct interaction rather than new dedicated test files.

### Minimal app smoke checks

Use Tauri MCP against the development app, with a disposable RomM fixture where appropriate:

1. Change library sort/filter, visit a later page, open a game from a platform and go Back, and use the search shortcuts. In immersive mode navigate to an off-screen cover and back from details; confirm selection stays usable.
2. Sync one platform from the new monitor and observe progress, counts, and library refresh. Confirm the monitor is reachable from both modes.
3. Enable achievements, open a game, refresh progress, and open its overlay in desktop and immersive details.
4. Queue enough BIOS files to exceed the concurrency limit, navigate BIOS → Downloads → BIOS, and observe independent progress/speed and terminal results.
5. Restore one older Eden save revision using the existing disposable fixture, restart/reopen its persisted indicator, then change the save and confirm a successful upload releases protection.

No second machine, broad emulator certification matrix, repeated human fault-injection exercises, or new screenshot test framework is required. Add each new app view to `scripts/capture-screenshots.mjs` without duplicate captures; capture representative desktop and immersive sync-monitor views.

Run the relevant existing tests and applicable repository format/lint/type/build checks through mise. Rust changes use the current Rust quality gates. Follow existing live-RomM integration guidance when changing its API boundary and report unavailable credentials/runtime checks accurately; do not substitute unrelated live emulator-download sweeps.

## Out of Scope

- Wholesale merge/cherry-pick of upstream, release-version bumps, or adoption of upstream release/signing/toolchain configuration.
- Reimplementing Favorites, current basic sorting/filtering, Ctrl/Cmd+F, platform-preserving Back navigation, existing ROM download deduplication, or ROM storage migration.
- A navigation/history rewrite, replacement immersive design, generic scheduler/transfer framework, new credential system, or new test framework.
- BIOS pause/resume/cancel controls, cross-restart queue persistence, range-resumable downloads, and unrelated BIOS distribution/install work. The corresponding parts of issues #6/#7 remain deferred.
- Draft PR #11's startup/reconnect-wide save reconciliation and archive-inferred title fallback. Restored saves receive upload opportunities through the current launch/manual-retry lifecycle in this scope.
- Expanding protected restores to additional emulator save-path implementations or adding new emulator support.
- Direct RetroAchievements authentication, emulator achievement configuration, awarding achievements, persistent achievement caching, and claims of universal RomM-version compatibility.
- Persistent sync-history reporting, automatic scheduled library sync, a platform-identity schema redesign, or a filesystem reconciliation subsystem.

## Further Notes

### Reviewed baseline

- Fork: [auron-labs/wingosy-launcher](https://github.com/auron-labs/wingosy-launcher), local HEAD `16468fc972481242106de24eb710648e2b65c7e5`.
- Last common ancestor: [`eb576cbea86e833590cac815039cf29560c35102`](https://github.com/yash-1o1/wingosy-launcher/commit/eb576cbea86e833590cac815039cf29560c35102), August 17, 2026. This is the history-divergence baseline, not the fork repository's creation date.
- Upstream main: [`c0289bb3aec7c84ed2c16cb25ef459a283314921`](https://github.com/yash-1o1/wingosy-launcher/commit/c0289bb3aec7c84ed2c16cb25ef459a283314921), September 16, 2026.
- Upstream-only range: **42 commits — 30 automated release-version bumps, 10 substantive commits, and 2 merge commits**. The fork has 82 commits beyond the shared ancestor.
- Reviewed the complete GitHub inventory: **6 PRs and 7 issues**, including closed records and the storage-migration issue comment. None of the PRs had reviews or review threads at review time.

### Substantive upstream commits

| Commit | Change | Local disposition |
| --- | --- | --- |
| [`9aea324`](https://github.com/yash-1o1/wingosy-launcher/commit/9aea32433b0fc894a26ccc91837a66c6be21a6b2) | Functional Favorites | Already implemented; preserve. |
| [`d126c2f`](https://github.com/yash-1o1/wingosy-launcher/commit/d126c2f5c93462c7a2525de043cee5fd8cb5a5d8) | Library sort controls | Adopt missing play-count/release-year options through local paged queries. |
| [`997f38e`](https://github.com/yash-1o1/wingosy-launcher/commit/997f38ee063a226d4108233c28383cd46cb50b7f) | Availability filter | Existing basic filter; add composition with Favorites and other constraints. |
| [`a131b9b`](https://github.com/yash-1o1/wingosy-launcher/commit/a131b9b8b35e39a463b82c92928570444f744d4d) | Sort direction | Adopt. |
| [`924ea3b`](https://github.com/yash-1o1/wingosy-launcher/commit/924ea3bd8661e67f20a645205dd7b0f94ca3bdef) | Search shortcuts | Preserve Ctrl/Cmd+F; add slash/Escape behavior. |
| [`40fc76d`](https://github.com/yash-1o1/wingosy-launcher/commit/40fc76d2ee3a23c6e6ffdf06f716d6dedcef6d6a) | Keep controller selection visible | Check current shelf; adapt only a demonstrated gap, not old grid code. |
| [`57bc35f`](https://github.com/yash-1o1/wingosy-launcher/commit/57bc35fb51d61377019bbdb174970b7f1168e3e9) | Platform sync monitor | Adapt with backend serialization and scoped failure/pruning correctness. |
| [`fe9b0f4`](https://github.com/yash-1o1/wingosy-launcher/commit/fe9b0f48d9934779c96de8eaa556be2c6b4dd74b) | RetroAchievements integration | Adapt into existing details/settings, correcting ID matching and errors. |
| [`b93b365`](https://github.com/yash-1o1/wingosy-launcher/commit/b93b365) | Achievement progress display | Include with achievements; keep local empty states and clear stale game data. |
| [`c0289bb`](https://github.com/yash-1o1/wingosy-launcher/commit/c0289bb3aec7c84ed2c16cb25ef459a283314921) | Case-insensitive local hostnames | Adopt the focused fix. |

The two merge commits introduce the platform monitor and RetroAchievements commits above; they are not additional workstreams. Automated release bumps require no local implementation.

### Pull requests

| PR | State at review | Disposition |
| --- | --- | --- |
| [#1 — README punctuation](https://github.com/yash-1o1/wingosy-launcher/pull/1) | Merged | Predates divergence; no implementation work. |
| [#2 — README punctuation](https://github.com/yash-1o1/wingosy-launcher/pull/2) | Closed, unmerged | Duplicate documentation proposal; no implementation work. |
| [#9 — ROM download tracking](https://github.com/yash-1o1/wingosy-launcher/pull/9) | Merged | In shared history; preserve naming/deduplication behavior. |
| [#11 — Protected RomM save synchronization](https://github.com/yash-1o1/wingosy-launcher/pull/11) | Open draft | Selectively adapt restore protection and remaining generic upload correction; retain newer fork behavior. Reviewed head: `657fd397f09f62cdd83e0b5cf25feb9c20124d15`. |
| [#12 — ROM storage migration](https://github.com/yash-1o1/wingosy-launcher/pull/12) | Merged | In shared history; preserve migration and active-download safeguards. |
| [#13 — Platform sync monitor](https://github.com/yash-1o1/wingosy-launcher/pull/13) | Merged | Included in the platform-sync workstream. |

PR #11's marker records a revision but no content baseline, uploads unconditionally after a protected session, and marks protection only after server acknowledgement. Those details do not satisfy issue #10 and must not be copied. Its reconnect sweep and title inference also predate the fork's current guards, failure phases, and identity resolution.

### Issues

| Issue | State at review | Disposition |
| --- | --- | --- |
| [#3 — Back to the previous platform](https://github.com/yash-1o1/wingosy-launcher/issues/3) | Open | Core behavior already implemented; smoke-confirm current navigation. |
| [#4 — ROM storage migration investigation](https://github.com/yash-1o1/wingosy-launcher/issues/4) | Closed | Resolved through shared PR #12; no new migration project. |
| [#5 — Download speed](https://github.com/yash-1o1/wingosy-launcher/issues/5) | Open | Include for active ROM and BIOS transfers. |
| [#6 — BIOS progress](https://github.com/yash-1o1/wingosy-launcher/issues/6) | Open | Include byte progress and known/unknown-total states; pause/cancel criteria remain deferred. |
| [#7 — Parallel BIOS downloads](https://github.com/yash-1o1/wingosy-launcher/issues/7) | Open | Include bounded concurrency, accurate queue/progress, and destination protection; pause/cancel criteria remain deferred. |
| [#8 — BIOS on Downloads](https://github.com/yash-1o1/wingosy-launcher/issues/8) | Open | Include shared display/history and controls actually supported by this scope. |
| [#10 — User-selected restore points](https://github.com/yash-1o1/wingosy-launcher/issues/10) | Open | Include durable Eden restore protection, meaningful-change detection, and existing Saves-section state/actions. |

### Existing local work to preserve

- BIOS operation-state persistence across navigation exists. Its prior Tauri smoke check remains recorded as pending; it does not supply byte progress or concurrency.
- The existing BIOS distribution follow-up remains separate; do not duplicate its ticket in this adoption effort.
- Canonical save listing/download, safer Eden restore round-trips, manual retry, phase-specific failure recording, metadata-first identity, and the newer launch lifecycle already exist locally. The draft PR is not authoritative over these implementations.
- Existing achievements presentation and disabled/empty states are reusable; the missing part is the real RomM data flow and enabled preference.

### Research verification

Commit ancestry/counts, complete PR/issue inventory, upstream diffs, and relevant local implementation were inspected. A direct Bun execution reproduced mixed-case local hostnames incorrectly receiving HTTPS and confirmed the current sort/filter options. The desktop double-pagination defect was confirmed from both sides of the existing IPC contract.

The attempted existing targeted Vitest run could not start because dependencies are not installed in this worktree (`vitest: command not found`). No runtime sync, transfer, save, achievement, or Tauri smoke checks were performed during this planning task. These findings establish the plan, not completed implementation or runtime acceptance.
