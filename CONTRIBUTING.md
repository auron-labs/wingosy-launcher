# Contributing

**Manual QA backlog / dev todos:** [DEV_README.md](DEV_README.md).

## Setup

Prerequisites: **Windows 10/11**, **Bun 1.3.14+** (pinned in `package.json` as `packageManager`), **Rust stable** (Tauri v2 / updater plugin), **VS Build Tools (C++)**.

### PATH on Windows

`bun` and `cargo` must be on your `Path`. Bun normally installs under
`%USERPROFILE%\.bun\bin`, and Rust under `%USERPROFILE%\.cargo\bin`. If a shell
still cannot find them, prepend both manually for that session:

```powershell
$env:Path = "$env:USERPROFILE\.bun\bin;$env:USERPROFILE\.cargo\bin;" + $env:Path
```

Verify in that same terminal:

```powershell
bun --version
cargo -v
```

### Troubleshooting: `tauri dev` exits or “app isn’t running”

| What you see | What it usually means | What to do |
|----------------|----------------------|------------|
| `bun` is not recognized | Bun is not on `Path` for this terminal | Use the `$env:Path = ...` line above, or open a **new** terminal after installing Bun; confirm with `bun --version`. |
| `failed to get cargo metadata: program not found` | **Cargo** is not on `Path` (Tauri needs Rust) | Add `%USERPROFILE%\.cargo\bin` (see line above), then `cargo -v`. Install Rust via `winget` / rustup if needed. |
| No window yet, only compile logs | First **debug** build of `src-tauri` can take **30–120+ seconds** | Wait until you see **`Finished` `dev` profile** and the log line **Starting Wingosy Launcher**; check the taskbar for the window. |
| Only the browser / `localhost:5173` | You ran **`bun run dev:web`** instead of the full app | Use **`bun run tauri dev`** (or **`bun run dev`**, which is the same) so the **native** window opens. |
| Can’t drag the frameless window / title bar feels “dead” | Vite **HMR** doesn’t reload **`tauri.conf.json`** or the **Rust** shell; `-webkit-app-region` can also lag until a full reload | **Stop** `tauri dev` (Ctrl+C), start it again. After changing **`src-tauri/tauri.conf.json`** or **`src-tauri/capabilities/`**, restart so the native binary picks up the new config. |

Install if missing:

```powershell
winget install Oven-sh.Bun --accept-package-agreements
winget install Rustlang.Rustup --accept-package-agreements
rustup default stable
```

After installing, **close and reopen** terminals (or sign out) so `Path` updates apply.

```bash
git clone https://github.com/yash-1o1/wingosy-launcher.git
cd wingosy-launcher
bun install
bun run tauri dev
```

### Development vs release

**Development — `bun run tauri dev`**

- Runs a **debug** native shell and serves the React app from your **`src/`** tree with Vite.
- **Frontend:** Vite **hot module replacement** — many React/CSS changes show up while the window stays open.
- **Rust (`src-tauri/`):** Saving files **rebuilds** the native side; the dev app **restarts** (not the same instant refresh as the web UI).
- You are always tied to **whatever is on disk** in your clone when you run this command.

**Release — `bun run tauri build`**

- Produces an optimized **`Wingosy Launcher.exe`** under `src-tauri/target/release/` (and installers if configured).
- The UI and Rust code are **fixed at build time**. New commits do **not** change an `.exe` you already built until you **build again** and **open the new binary**.
- Use this when you care about **production-like** speed, installers, or **E2E** tests that target the release app.

For everyday UI work, use **`tauri dev`**. Use a **release** build when you need to match what users install.

### Release channels (stable / beta / nightly)

The in-app **Updates** settings use GitHub’s API to compare your build to the correct **track**:

| Channel | GitHub source | CI workflow |
|--------|----------------|-------------|
| **Stable** | Latest **non-prerelease** release (`/releases/latest`) | [`.github/workflows/release.yml`](.github/workflows/release.yml) — tag `v*` **without** `beta` or `nightly` in the name (e.g. `v0.2.0`) |
| **Beta** | Newest **prerelease** whose tag contains `beta` and not `nightly` | [`.github/workflows/beta.yml`](.github/workflows/beta.yml) — manual dispatch; tags like `beta-<run_id>` |
| **Nightly** | Newest **prerelease** whose tag contains `nightly` | [`.github/workflows/nightly.yml`](.github/workflows/nightly.yml) — push a tag matching `nightly*` (e.g. `nightly-2026-04-11`), **or** daily schedule / manual dispatch (`nightly-<run_id>`) |

Pre-release workflows set **`prerelease: true`** so they do not replace **stable** on `/releases/latest`.

### Signed in-app updates (Tauri v2 updater)

Release, Beta, and Nightly workflows build **signed** NSIS artifacts and upload **`latest.json`** next to the installer so the app can call **`install_signed_app_update`** (in-place update, then restart).

`scripts/write-updater-manifest.mjs` reads the **published** NSIS asset URL from the GitHub API (GitHub renames `Wingosy Launcher` → `Wingosy.Launcher` in filenames). If an older release has a broken manifest (installer URL 404), run the **Repair updater manifest** workflow (`.github/workflows/repair-updater-manifest.yml`) with that release tag, or locally: `RELEASE_TAG=<tag> GITHUB_TOKEN=… bun scripts/repair-updater-manifest.mjs`.

1. **One-time:** generate a minisign keypair (keep the private key secret; the public key is already in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey` — replace it if you rotate keys):

   ```bash
   bun run tauri -- signer generate -w src-tauri/tauri-signing.key
   ```

   Commit only the **public** key line into `tauri.conf.json` (never commit `tauri-signing.key`; it is listed in `.gitignore`).

2. **GitHub Actions:** add repository secrets (Settings → Secrets and variables → Actions):

   - **`TAURI_SIGNING_PRIVATE_KEY`** — full contents of `tauri-signing.key` (or use `tauri signer sign` workflow that injects it from a password-protected vault).
   - **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`** — optional; only if the private key is password-protected.

3. **Local release builds:** env vars are read by `tauri build`, not `.env`. The private key must be available as **`TAURI_SIGNING_PRIVATE_KEY`** (the full file contents). If the key is **password-protected** (`rsign encrypted secret key` in the decoded comment), also set **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`**; otherwise the CLI waits for a TTY prompt and a piped or IDE terminal can look “stuck”.

   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -Raw "$PWD\src-tauri\tauri-signing.key").Trim()
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-password"   # omit if the key has no password
   bun run tauri build
   ```

   `TAURI_SIGNING_PRIVATE_KEY_PATH` is supported by newer CLIs for some commands, but **inlining the key** (as above) matches CI (`secrets.TAURI_SIGNING_PRIVATE_KEY`) and avoids “public key found, but no private key” if the path form is not picked up for updater signing.

4. **ROM / cover paths outside standard folders:** `app.security.assetProtocol.scope` lists common user directories. If covers or ambient audio live on another drive, extend the scope in `tauri.conf.json` (or open an issue with the path pattern you need).

### App versioning (automated in CI)

The app semver is **`MAJOR.MINOR.PATCH`** in **`package.json`**, mirrored to **`src-tauri/Cargo.toml`**, **`src-tauri/tauri.conf.json`** (root `version` field in Tauri v2), and **`src-tauri/Cargo.lock`** via:

```bash
bun run version:set -- 1.2.3    # bun scripts/set-version.mjs — set all files to an exact version
bun run version:bump -- nightly # PATCH + 1
bun run version:bump -- beta    # MINOR + 1, PATCH = 0 (resets “nightly” counter)
bun run version:bump -- release # MAJOR + 1, MINOR = 0, PATCH = 0 (resets beta and nightly counters)
```

| Workflow | What happens to the version |
|----------|------------------------------|
| **Nightly** (cron or **Run workflow** on `main`) | Bump **PATCH**, build, then **commit** back to `main` with `[skip ci]`. |
| **Beta** (manual dispatch on `main`) | Bump **MINOR**, **PATCH → 0**, build, then commit to `main`. |
| **Stable** ([`release.yml`](.github/workflows/release.yml) on tag `vX.Y.Z`) | **No semver math in CI** — the tag defines the version; the workflow runs `version:set` so binaries match **`vX.Y.Z`**. Before tagging, run **`version:bump -- release`** on **`main`** so **`main`** reflects the stable line you are shipping. |

Pushing a **`nightly*`** tag builds that ref **without** running the bump script (uses whatever versions are in that snapshot). Prefer schedule / **Run workflow** on `main` for automatic PATCH bumps.

## Project Structure

```
src/                    # React frontend (MUI)
src-tauri/src/          # Rust backend
  ├── commands.rs       # Tauri commands (frontend ↔ backend)
  ├── api/              # RomM client, downloads
  ├── database/         # SQLite operations
  ├── emulators/        # Detection, launching, cores
  └── models/           # Data structures
e2e-webdriver/          # E2E tests
```

## Testing

See [TESTING.md](TESTING.md) for the full matrix, **opt-in** (network) integration tests, and the E2E spec list.

**Default local loop** (fast, no live RomM / heavy downloads):

```bash
cargo test              # Rust unit tests + integration tests that are not #[ignore]
bun run test:unit       # Vitest: pure JS (`*.test.js`) + React (`*.test.jsx` with Testing Library)
```

See [TESTING.md](TESTING.md) → *Unit Tests (JavaScript)* for `MuiTestProvider` and file naming.

**Integration tests** that talk to the real network are marked `#[ignore]` in Rust so `cargo test` stays offline-friendly. **Do run them** when you change RomM, downloads, or emulator fetch code — see [TESTING.md](TESTING.md) → *Integration Tests (Rust)* for the exact `cargo test --test … -- --ignored` commands. That is “opt in with a flag,” not “pretend integration tests do not exist.”

**E2E** (`bun run test:e2e`) is optional and needs more than `bun install` + `tauri dev`:

1. **`tauri-driver` on your `PATH`** — WebDriver talks to the native app through it. Install with Rust’s toolchain:

   ```bash
   cargo install tauri-driver
   ```

   The binary is usually `%USERPROFILE%\.cargo\bin\tauri-driver.exe`. If you see `spawn tauri-driver ENOENT` or `ECONNREFUSED` on `localhost:4444`, the driver is missing or not on `PATH`.

2. **Edge WebDriver** — Pulled automatically on E2E runs via the `edgedriver` devDependency (into `e2e-webdriver/`). Microsoft Edge must be installed so the driver version can be matched.

3. **Release build** — `wdio.conf.js` expects `src-tauri/target/release/Wingosy Launcher.exe`:

   ```bash
   bun run tauri build
   ```

Step (1) was documented in [TESTING.md](TESTING.md) and in `wdio.conf.js` comments, but not in this file until now, so it was easy to miss when only reading **Contributing**.

## Adding Features

### New Tauri Command

1. Add function in `commands.rs` with `#[tauri::command]`
2. Register in `main.rs` → `invoke_handler`
3. Call from React: `invoke("command_name", { args })`

### New Emulator

1. Add to `models/emulator.rs` → `default_emulators()`
2. Add detection in `emulators/detection.rs`
3. Add path in `config/mod.rs` → `EmulatorPaths`
4. Map in `emulators/launcher.rs` → `get_emulator_path()`

## Code Style

- Rust: `cargo fmt && cargo clippy`
- JS: Functional components, MUI

## Data Locations

| Data | Path |
|------|------|
| Config | `%APPDATA%/wingosy/launcher/config/config.toml` |
| Database | `%APPDATA%/wingosy/launcher/data/wingosy.db` |
| Logs | `%APPDATA%/wingosy/launcher/data/logs/` |
