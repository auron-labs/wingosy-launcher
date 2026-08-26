# Add a minimal beta support path

Type: task
Mode: agent
Status: ready-for-human
Blocked by: 01

> Follow this plan step by step and update `../spec.md` when done.
>
> Drift check: `git diff --stat a96ce03..HEAD -- src-tauri/src/main.rs src-tauri/src/config/mod.rs src-tauri/src/commands.rs src/components/Settings.jsx README.md .github/ISSUE_TEMPLATE/bug_report.md`

## Status

- **Priority:** P1
- **Effort:** S
- **Risk:** LOW
- **Depends on:** 001
- **Category:** direction / support
- **Planned at:** commit `a96ce03`, 2026-08-23

## Why this matters

The app already writes logs, but code and README disagree on their location and
the UI offers no route to them. Private-beta reports without app version, OS,
steps, and logs will be expensive to diagnose.

## Current state

- `src-tauri/src/main.rs:21-41` writes daily logs using a different ProjectDirs
  application name than the rest of the app.
- `src-tauri/src/config/mod.rs:167-169` defines the intended logs directory.
- `README.md:70-79` documents that intended directory.
- `.github/ISSUE_TEMPLATE/bug_report.md` asks for logs/screenshots, but Settings
  has no Open Logs or Report a Problem action.
- Local logs are enough for MVP; no external telemetry dependency is needed.

## Scope

In scope: the files in the drift check, one small command returning/opening the
log directory, user-facing support instructions, and tests. Out of scope: crash
analytics, automatic uploads, attaching databases/configs, or collecting secrets.

## Steps

1. Make logging use `AppConfig::logs_dir()` so runtime and docs agree. State the
   actual retention behavior; either remove the inaccurate retention claim or
   delete files older than seven days with the standard library at startup.
2. Add Settings actions for Open Logs Folder and Report a Problem. The report
   route must target the canonical repository from 001 and tell testers to include
   app version, Windows version, steps, expected/actual behavior, and relevant log
   files. Never auto-attach config, database, credentials, ROM names, or paths.
3. Add a short private-beta guide covering backups, supported scope, known
   limitations, update channel, log redaction, and response expectations.
4. Run the first cohort with 3–5 testers for one week. Triage only P0 setup,
   launch, update, data-loss, and credential issues before expanding to 10–20.

## Verification and done criteria

- [x] `bun run typecheck && bun run test:unit` exits 0.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml` passes on Windows.
- [ ] Settings opens the same log folder documented in README.
- [ ] A test report can identify app version, OS, and relevant log without sharing
      credentials or user data.
- [ ] The beta guide names a monitored feedback owner and expected response window.
- [ ] The second cohort starts only after all first-cohort P0 issues are closed.

## STOP conditions

- The feedback route is not monitored by a named maintainer.
- The proposed diagnostics bundle includes configuration, database, credentials,
  ROM paths/names, or automatic network upload.

## Maintenance notes

Add telemetry only if local logs repeatedly fail to answer concrete beta issues.
The private cohort should generate product evidence, not a new observability stack.

## Comments

- Startup logging and the Settings support command now use `AppConfig::logs_dir()`,
  matching the README's `%APPDATA%\wingosy\launcher\data\logs\` path.
- Settings now opens the logs folder and the canonical GitHub bug report form.
  The form and Settings guidance request app version, Windows version, repro,
  expected/actual behavior, and redacted logs without collecting or sharing user
  data, credentials, configuration, database files, or ROM names/paths.
- Daily rolling is documented as retaining older files until the user removes
  them; no seven-day cleanup machinery or telemetry was added.
- The beta guide names Auron Labs maintainers, uses best-effort review language
  without an SLA, and records the 3-5 then 10-20 tester cohort gate.

### 2026-08-24 — Reopened after completed-task audit

The named monitored owner and response window still need confirmation, and the
first cohort is pending.

### 2026-08-26 — Native Windows verification

Windows verification passed: typecheck, 74 Vitest tests across 11 files, the
frontend build, and the full Rust suite (270 unit tests passed with 1 ignored;
4 emulator and 4 RomM parsing integration tests passed). Frontend lint completed
with the same 7 pre-existing warnings and no errors. The monitored feedback owner,
response window, Settings log-folder action, and cohort gates remain unverified,
so this ticket stays `ready-for-human`.
