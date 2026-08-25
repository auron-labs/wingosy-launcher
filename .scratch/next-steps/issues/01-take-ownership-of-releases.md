# Take ownership of releases and updates

Type: task
Mode: human
Status: ready-for-human
Blocked by: none

> Follow this plan step by step. Run each verification before continuing. If a
> STOP condition occurs, report it instead of improvising. On completion, update
> the status in `../spec.md`.
>
> Drift check: `git diff --stat a96ce03..HEAD -- README.md CONTRIBUTING.md .github/workflows src-tauri/tauri.conf.json src-tauri/src/commands.rs`

## Status

- **Priority:** P0
- **Effort:** M
- **Risk:** MED
- **Depends on:** none
- **Category:** direction / release
- **Planned at:** commit `a96ce03`, 2026-08-23

## Why this matters

This checkout has no Git remote. Runtime update discovery is hard-coded to the
abandoned repository, while workflows upload manifests to whichever repository
runs them. A revived build would therefore publish in one place and update from
another. The updater signing private key may also be unavailable to the new
maintainer.

## Current state

- `src-tauri/src/commands.rs:2744-2753` sets
  `UPDATE_CHECK_REPO` to the original owner's repository.
- `src-tauri/tauri.conf.json:59-62` points the built-in updater there too.
- `.github/workflows/beta.yml:87-93` and `release.yml:99-105` publish using
  `${{ github.repository }}`.
- `README.md:3-4,21-22` and workflow release copy link to the old repository.
- `git remote -v` currently prints no remotes.
- Keep the GPL license and original author attribution; adoption is not a reason
  to erase provenance.

## Decision and scope

Default to a maintainer-controlled GitHub repository with public Release assets
and private invitations to testers. This keeps Tauri's unauthenticated updater
working without building an authenticated distribution service. If the source
must remain private, disable in-app updates for the MVP and distribute the signed
NSIS installer manually; do not invent private-GitHub authentication in the app.

In scope: `README.md`, `CONTRIBUTING.md`, `.github/workflows/{beta,nightly,release}.yml`,
`src-tauri/tauri.conf.json`, `src-tauri/src/commands.rs`, repository settings and
updater signing secrets. Out of scope: application features, emulator sources,
license/authorship removal, stable public launch.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Baseline | `bun run typecheck && bun run test:unit` | exit 0; 37+ tests pass |
| Rust check | `cargo check --manifest-path src-tauri/Cargo.toml --tests --target x86_64-pc-windows-gnu` | exit 0 |
| Old origin audit | `rg -n "yash-1o1/wingosy-launcher" README.md CONTRIBUTING.md .github src-tauri/src src-tauri/tauri.conf.json` | no operational update/release links remain |

## Steps

1. Create or select the canonical maintainer-controlled repository, add it as
   `origin`, and protect `main` so CI must pass. Verify with `git remote -v` and
   the repository settings page.
2. Replace operational release, updater, badge, issue, and user-agent URLs with
   the canonical origin. Use one Rust constant for GitHub release discovery;
   do not add configuration machinery for a value fixed at build time.
3. Generate a new Tauri updater signing key unless the existing private key is
   demonstrably under the new maintainer's control. Commit only the public key;
   store the private key and optional password as repository secrets. Never put
   secret contents in commits, logs, plans, or issue text.
4. Build a beta installer and `latest.json` from the canonical repository. On a
   clean Windows VM, install it, publish a second higher-version draft, and prove
   the first install discovers and verifies the second manifest.
5. Record repository ownership, release origin, public updater key fingerprint,
   and key-rotation owner in maintainer docs. Do not record private key material.

## Test plan and done criteria

- [x] Baseline commands pass.
- [x] `git remote -v` shows a maintainer-controlled origin.
- [x] The old owner string is absent from operational runtime/workflow URLs.
- [ ] A beta installer and manifest are attached to the canonical repository.
- [ ] A clean Windows install discovers a signed higher-version beta from that
      same origin; a manifest signed by another key is rejected.
- [x] No private signing material appears in `git status`, `git diff`, or logs.

## STOP conditions

- No canonical artifact host has been chosen.
- The existing updater private key's ownership is uncertain and rotation has not
  been authorized.
- The chosen repository is private but the operator still expects anonymous
  in-app GitHub Release downloads.

## Maintenance notes

Treat the update origin and updater public key as release infrastructure. Any
future repository transfer must update runtime discovery, workflow publication,
and installer verification together.

## Comments

### 2026-08-24 — Reopened after completed-task audit

The canonical repository is empty and has no releases. The stable-release
`workflow_dispatch` tag guard is defective: it checks the dispatch ref instead of
the selected tag, while signing ownership/evidence and Windows evidence remain
pending.

### 2026-08-25 — Implementation stopped at ownership gate

Scout and coder review confirmed that `origin` is the public
`auron-labs/wingosy-launcher` repository and the current GitHub identity has admin
permission, but the repository is still empty and has no releases. The old-owner
operational URL audit is clean. Updater private-key ownership or authorized
rotation is still not evidenced, so the ticket's STOP condition applies before
release or signing changes. The existing stable-release `workflow_dispatch` tag
guard defect remains a safe follow-up after the ownership decision.

### 2026-08-25 — Ownership decisions

The maintainer confirmed `auron-labs/wingosy-launcher` as the definitive public
canonical release repository and authorized rotation to a new updater signing
key under current maintainer control.

### 2026-08-25 — Local release ownership work complete

The stable workflow now validates the effective push or dispatch tag as an exact
stable SemVer tag. A new encrypted updater key is ignored locally, both signing
secret names are configured in the canonical repository, and only the public
key plus its fingerprint are tracked. `actionlint`, the fingerprint/config
check, `git diff --check`, the old-origin audit, `mise exec -- bun run
typecheck`, `mise exec -- bun run test:unit` (11 files, 74 tests), and native
`mise exec -- cargo test --manifest-path src-tauri/Cargo.toml` (266 unit passed/1
ignored, 4 emulator integration passed/9 ignored, 4 RomM integration passed/7
ignored) passed. The Windows GNU Cargo check remains blocked because
`x86_64-w64-mingw32-gcc` is unavailable. The first push, branch protection,
published beta artifacts, and clean-Windows update/signature verification remain
pending, so this issue stays `ready-for-human` and the roadmap stays `IN
PROGRESS`.

The pre-push Gitleaks scan covered all 370 commits. Its 23 findings were repeated
detections of one deterministic, test-only Switch firmware fixture; review found
no live credential and no required history rewrite or rotation.

### 2026-08-25 — Remote publication deferred

The maintainer declined the first public `main` push and public beta publication
for now. Branch protection cannot be configured until `main` exists remotely, and
the installer, manifest, and Windows update verification therefore remain
blocked. Local ownership work is committed, but the task is not complete.
