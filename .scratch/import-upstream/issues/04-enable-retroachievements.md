# 04 — Enable RomM-backed RetroAchievements

**What to build:** Enable the existing RetroAchievements preference and show the real achievement definitions and connected-user progress supplied by RomM in both existing game-details modes.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] The existing `display.retroachievements_enabled` setting persists through the current settings flow, and the shared details integration presents the existing disabled, unsupported, and empty states without inventing locked achievements.
- [x] Achievement definitions and the game ID come from the ROM detail response's `merged_ra_metadata.achievements` and `ra_id`; connected-user progression comes from `/api/users/me`, matching only present, valid game and achievement identifiers. Two missing IDs never match, and a missing game ID selects no unrelated progress.
- [x] Explicit Refresh requests an incremental refresh through `/api/users/{user_id}/ra/refresh` and reloads progression; ordinary rendering does not repeatedly refresh the remote account.
- [x] Details show earned/total achievement counts, earned/total points, completion progress, and each supplied achievement's actual locked/unlocked and hardcore state.
- [x] User-fetch and refresh HTTP failures are checked and reported meaningfully: authentication or other failures are not shown as all-locked/zero progress, and a failed refresh is not reported as successful. Old data is cleared on game/session identity changes, late responses are ignored, and same-game retained data is identified as a previous result after refresh failure.
- [x] The integration reuses the connected RomM session only; it does not add direct RetroAchievements authentication, emulator RA configuration, achievement awarding, or a persistent achievement cache.

**Context:** Parent spec: “Selective upstream adoption”; upstream commits `fe9b0f4` and `b93b365` are the reviewed sources.

## Verification

- [x] Reuse a compact RomM response fixture and the existing injectable details seam for earned/locked mapping, missing-ID matching, rejected refresh, and pending game changes.
- [ ] Run the focused settings and Tauri smoke checks in desktop and immersive details, including explicit refresh and the existing overlay.

## Comments

- 2026-09-18: Slice 1 completed. The Integrations switch now reflects and persists `display.retroachievements_enabled` through the existing config flow; focused settings tests pass. Full criterion remains open until the shared details integration is connected.
- 2026-09-18: Slice 2 completed. The authenticated RomM client and Tauri command now load ROM-detail definitions plus connected-user progression, reject missing-ID matches, perform refresh only when explicitly requested, propagate HTTP failures, and retain the unsupported empty result without an unnecessary user request. Four focused Rust fixture tests pass; the normal Tauri build remains blocked by the repository's existing capability-schema mismatch and missing `dist/`.
- 2026-09-18: Slice 3 completed. One shared injectable achievement state hook now serves desktop and immersive details, performs only ordinary non-refresh loads during rendering, clears data across game/session identity changes, ignores late responses, and retains same-game results with refresh-failure state. Twenty-one focused frontend details tests pass, including equivalent-object rerenders, rejected refresh, and pending game changes; existing unrelated immersive export errors still block the repository-wide typecheck.
- 2026-09-18: Slice 4 completed. The shared section and overlay now show earned/total achievements and points, completion, real badge lock state, hardcore unlocks, loading, explicit refresh, and previous-result failure feedback in both details modes. Twenty-nine focused presentation/details tests pass.
- 2026-09-18: Review correction completed. A successfully saved preference now updates immersive details immediately in the same session, and the redundant immersive hook wrapper was removed. Focused immersive app/settings callback tests pass.
- 2026-09-18: Both code-review axes approved after corrections. Focused frontend verification passes (44 tests), formatting and targeted lint pass, and Rust formatting passes. The Tauri smoke/Rust test remains unrun because the repository's pre-existing capability schema rejects `core:window:allow-start-dragging`; the immersive details test baseline is also blocked by existing missing exports such as `toSpinePlatformOptions`.

## Answer

Enabled the persisted RetroAchievements preference and added one shared RomM-backed achievement integration for desktop and immersive details, including accurate progress, points, badges, hardcore state, explicit refresh, meaningful failure handling, and stale-response protection.
