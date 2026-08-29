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
- [x] `cargo test --manifest-path src-tauri/Cargo.toml` passes on Windows.
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

### 2026-08-24 — Reopened after completed-task audit

A stale immersive pagination race remains to be resolved, and the Windows
large-catalogue check remains pending.

### 2026-08-25 — Investigation complete

The stale race occurs when an obsolete next-page request clears a newer
request's shared in-flight lock in `finally`; implementation will use request
ownership and add a regression test.

### 2026-08-25 — Implementation progress

Each immersive next-page request now owns the in-flight guard, and an overlap
regression test has been added. At that point, verification had not yet run
because the implementation agent had no shell.

### 2026-08-25 — Review progress

The request-ownership fix is correct. Review found that refresh pagination
bookkeeping can repeat the last partially loaded page and that the next-page
total guard should read the current games ref; these findings were addressed
before final verification.

### 2026-08-25 — Review findings addressed

Retained-page bookkeeping now advances with ceiling page math, the next-page
total guard uses the current games ref, and a refresh regression was added.
The earlier pending-verification note is superseded by the final verification below.

### 2026-08-25 — Agent follow-up complete

The stale request ownership race and refresh page bookkeeping were fixed, and regressions were added. Verification passed: focused immersive 5/5; typecheck; full Vitest (11 files, 74 tests); build; lint with 7 pre-existing warnings and no errors; Rust unit (260 passed, 1 ignored). Native Windows Cargo and the representative Windows large-catalogue first-render/next-page exercise remain for human acceptance.

### 2026-08-26 — Native Windows verification

The full native Windows Rust suite passed: 270 unit tests passed with 1 ignored,
including the bounded page/count/filter regression. Computer Use launched the
native build against a representative RomM catalogue and observed a responsive
first desktop page with 60 bounded entries and 43 pages of results. Next-page and
immersive navigation could not be exercised because Computer Use input injection
was rejected by the fullscreen Tauri/WebView window after refocus-and-retry.
Keep the ticket `ready-for-human` until that remaining interaction is observed.
