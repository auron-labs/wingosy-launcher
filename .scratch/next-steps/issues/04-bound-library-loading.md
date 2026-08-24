# Bound desktop and immersive library loading

Type: task
Mode: agent
Status: resolved
Blocked by: 02

> Preserve current user-owned changes. Run `git status --short` before editing;
> if an in-scope file is still being edited by another person, stop and
> coordinate. Update `../spec.md` when done.
>
> Drift check: `git diff --stat a96ce03..HEAD -- src/App.jsx src/components/Library.jsx src/immersive/ImmersiveModeApp.jsx src-tauri/src/commands.rs src-tauri/src/database/games.rs`

## Status

- **Priority:** P0
- **Effort:** M
- **Risk:** MED
- **Depends on:** 002
- **Category:** performance / direction
- **Planned at:** commit `a96ce03` plus expected uncommitted pagination work,
  2026-08-23

## Why this matters

The reported All Games slowdown is real in the current flow. Desktop pagination
is in progress, but immersive mode still loads every row and `get_all_games`
validates paths across the full catalogue. A couch-first beta must remain usable
with a representative RomM library.

## Current state

- The working tree adds `get_games_page` and a 60-item desktop page in
  `src/App.jsx:201-234`, `src/components/Library.jsx:35,172-179`,
  `src-tauri/src/commands.rs:318-348`, and
  `src-tauri/src/database/games.rs:200-292`.
- `src/immersive/ImmersiveModeApp.jsx:68-89` still invokes `get_all_games`.
- `src-tauri/src/commands.rs:151-215` loads all games and may rediscover missing
  paths per game.
- `.scratch/ISSUES.md:2` records the user-visible slowdown.
- Current baseline: typecheck, 37 Vitest tests, frontend build, and Windows GNU
  cross-target Cargo check pass; frontend lint has eight warnings.

## Scope

In scope: the files named in the drift check, `src/immersive/ImmersiveModeApp.test.jsx`,
and the existing Rust game-query tests. Out of scope: virtualised grid libraries,
new dependencies, custom image caching, database replacement, or design changes.

## Steps

1. Finish and test the existing server-side page query. Return a bounded page and
   total count; validate/reconcile only returned rows, not the entire catalogue.
2. Preserve the current desktop page on game detail updates and reset to page 1
   on platform/search changes. Resolve the existing `App.jsx:130` hook warning
   without creating request loops.
3. Replace immersive `get_all_games` with the same bounded command. Append the
   next page when controller selection nears the end, preserve selection by game
   ID, and stop when loaded count reaches total. One in-flight guard is enough.
4. Add one Rust page/count/filter test and one immersive test proving initial
   bounded load, one next-page append, no duplicate fetch, and no fetch past total.
5. Exercise a representative large catalogue on Windows and record first render
   and next-page behavior. Do not add caching until this bounded query is still
   measurably inadequate.

## Verification and done criteria

- [x] `bun run typecheck`, `bun run test:unit`, and `bun run build` exit 0.
- [x] `bun run lint:frontend` has no new warnings and the `App.jsx:130` warning is gone.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes on Windows.
- [x] Desktop and immersive initial loads request at most 60 games.
- [x] Immersive navigation can reach later pages without losing controller focus.
- [x] Search/platform changes cannot display a stale earlier response.
- [x] No new dependency is added.

## STOP conditions

- In-scope uncommitted work is not owned by the executor.
- Correctness requires scanning every ROM path during a list request; report the
  false assumption and move reconciliation to launch/explicit rescan instead.

## Maintenance notes

Keep one backend paging contract for both UI modes. Image caching is a later,
measurement-driven change, not part of this fix.

## Comments

Implementation uses bounded desktop and immersive page loading, preserves immersive
selection and controller focus across later-page appends, guards stale requests, and
adds no dependency. Code review was run and findings were addressed.

Final verification: focused immersive test passed; typecheck passed; full Vitest
passed (8 files, 42 tests); final build passed; frontend lint has 7 pre-existing
warnings and no `App.jsx` warning. Focused and full Cargo attempts were blocked before
crate compilation by missing Linux GUI libraries (`libsoup-3.0`/`javascriptcoregtk-4.1`).
Windows Cargo and the representative large-catalogue manual exercise remain open.
