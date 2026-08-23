# Testing

## Overview

| Type | Count | Location | Run Command |
|------|-------|----------|-------------|
| Unit Tests (Rust) | ~151+ | Inline `#[cfg(test)]` | `cargo test` |
| Unit Tests (JS) | growing | `src/**/*.test.{js,jsx}` (Vitest) | `bun run test:unit` |
| Integration | 14 | `src-tauri/tests/` | `cargo test --test '*' -- --ignored` |
| E2E | ~154 cases | `e2e-webdriver/` | `bun run test:e2e` |

## Unit Tests (JavaScript)

**Vitest** with **`jsdom`**, **React Testing Library**, and **`@testing-library/jest-dom`** matchers (`vitest.setup.js`). Use **`src/test/muiHarness.jsx`** (`MuiTestProvider`) when rendering MUI components so tests do not depend on `ThemeContext` or Tauri.

| Pattern | Use when |
|---------|----------|
| `*.test.js` | Pure JS helpers (no DOM) |
| `*.test.jsx` | React components — import `@testing-library/react`’s `render` / `screen` |

```bash
bun install
bun run test:unit
bun run test:unit:watch   # Vitest watch mode
```

| Module | What it Tests |
|--------|---------------|
| `utils/normalizeUrl.test.js` | RomM URL scheme, local vs public hosts, trimming |
| `components/LauncherIcon.test.jsx` | Example RTL test with `MuiTestProvider` |

## Unit Tests (Rust)

Fast, no network. Test pure functions and data structures.

```bash
cd src-tauri && cargo test
```

**RetroArch — all mapped cores (network, large downloads):** validates every distinct `*_libretro.dll` in `retroarch_cores()` against the Libretro buildbot. Opt-in (ignored by default so `cargo test` stays quick):

```bash
bun run test:rust:cores
```

| Module | What it Tests |
|--------|---------------|
| `api/download.rs` | Progress formatting, size calculations |
| `config/mod.rs` | Config serialization, defaults |
| `emulators/cores.rs` | Core URLs, ZIP validation; **opt-in** `all_mapped_retroarch_core_buildbot_zips_are_valid` (every DLL in `retroarch_cores()`, hits buildbot) |
| `emulators/detection.rs` | Emulator patterns, install types |
| `models/game.rs` | Game creation, play time, filters |
| `scanner/mod.rs` | ROM name cleaning, multi-disc |

### RetroArch vs standalone emulators

**RetroArch** is a single install that pulls **many small cores** (`*_libretro.dll`). The launcher maps each platform id to one core (`retroarch_cores()`), so automated checks can iterate **those many buildbot artefacts** — see **`bun run test:rust:cores`** (opt-in; large downloads).

**Standalone emulators** (Dolphin, PCSX2, mGBA as its own zip, PPSSPP, etc.) don’t expose a separate “cores” matrix in Wingosy: typically **one exe or one release archive per emulator**. Integration coverage is structured **per emulator**, not per sub-DLL — e.g. **`test_all_emulator_sources_accessible`** in **`emulator_integration.rs`** HEADs RetroArch stable and probes GitHub **`releases/latest`** plus asset regexes for listed repos.

## Integration Tests (Rust)

These hit the **real network** (GitHub, buildbot, RomM, etc.). They are **important** for validating API clients and download paths; we are **not** telling anyone to skip them on purpose.

Rust marks many of them with **`#[ignore]`** so a plain `cargo test` stays **fast, deterministic, and offline-friendly** for everyday development. You **opt in** when you need to verify external integration.

**Run them when:**

- You change `src-tauri/src/api/romm.rs`, download helpers, or emulator fetch/install code.
- Before a release or when debugging “works on my machine” against real services.

```bash
cd src-tauri

# Emulator / download integration (no RomM credentials)
cargo test --test emulator_integration -- --ignored

# RomM live API (needs credentials, e.g. `.env` — see that test file)
cargo test --test romm_integration -- --ignored
```

| Test | What it Tests |
|------|---------------|
| `all_mapped_retroarch_core_buildbot_zips_are_valid` (in `emulators/cores.rs`, `#[ignore]`) | Every mapped core’s buildbot URL returns a real ZIP |
| `test_all_emulator_sources_accessible` (`emulator_integration`, `#[ignore]`) | RetroArch stable HEAD + GitHub release assets regex for standalone emulators in the suite |
| `test_github_release_download` | Full emulator download workflow |
| `test_rom_download_url_format` | ROM URL construction |

**CI note:** The current GitHub Actions workflow builds releases but does **not** run these ignored suites automatically; running them locally (or adding a workflow job) is how they get exercised today.

## E2E Tests (WebDriver)

Test full app with Rust backend.

### Prerequisites

1. Install **tauri-driver** and ensure it is on `PATH` (same shell you use for `bun run test:e2e`):

   ```bash
   cargo install tauri-driver
   ```

   Default install location: `%USERPROFILE%\.cargo\bin` (already on `PATH` after a normal Rustup setup).

2. **Edge WebDriver** — `bun install` includes the `edgedriver` package; **WebdriverIO’s `onPrepare` downloads** `msedgedriver.exe` into `e2e-webdriver/` before starting `tauri-driver` (needs Microsoft Edge installed for version detection). Override CDN with `EDGEDRIVER_CDNURL` if required.

3. Build app: `bun run tauri build` (release binary path is set in `wdio.conf.js`).

### Running

```bash
bun run test:e2e              # All tests
bun run test:e2e:setup        # Setup wizard only
bun run test:e2e:app          # Core navigation
bun run test:e2e:settings     # Settings page
bun run test:e2e:sensing      # Emulator auto-detection
bun run test:e2e:download     # Emulator downloads
bun run test:e2e:cores        # RetroArch cores
bun run test:e2e:roms         # ROM download flows
bun run test:e2e:games        # Game launching
bun run test:e2e:gba          # GBA-focused launch checks
bun run test:e2e:coverage     # Broad UI coverage pass
bun run test:e2e:immersive    # Immersive mode only
```

### Test Files

| File | What it Tests |
|------|---------------|
| `setup-wizard.spec.js` | First-run wizard |
| `app.spec.js` | Navigation, sidebar |
| `immersive.spec.js` | Immersive toggle from Settings, Immersive library chrome, **Exit to desktop mode** |
| `settings.spec.js` | Navigation, General default, Appearance / Sound / Updates smoke, RomM, Library, Emulators (with platform defaults beside it), persistence |
| `emulator-download.spec.js` | Emulator installation |
| `retroarch-cores.spec.js` | Core management |
| `rom-download.spec.js` | ROM downloads |
| `game-launch.spec.js` | Game launching |

## When to Add Tests

| Adding... | Unit | Integration | E2E |
|-----------|------|-------------|-----|
| Pure function (parsing, formatting) | ✅ Vitest (`*.test.js`) | - | - |
| API client method | - | ✅ Rust (`#[ignore]` where live HTTP) | - |
| File operation (download, extract) | - | ✅ Rust (`#[ignore]` where real I/O) | - |
| New React component | ✅ Vitest + Testing Library (`*.test.jsx`) for what you can mount without Tauri; use `MuiTestProvider` for MUI | - | ✅ Flows that need the real app, navigation, or `invoke` |
| New Tauri command | ✅ Rust unit / command tests | ⚠️ if external I/O | ✅ if user-facing |

**Note:** RomM HTTP and heavy downloads live in **opt-in** integration tests (`romm_integration`, `emulator_integration`) so default `cargo test` does not require the network. Run those tests when you touch those areas (see Integration Tests above).

**React:** Prefer **RTL unit tests** for props, conditional UI, and light interaction; use **E2E** when the behavior depends on the full Tauri shell, routing, or backend responses you do not want to mock.
