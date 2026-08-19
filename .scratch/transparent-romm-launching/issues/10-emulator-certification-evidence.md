# 10 — Record evidence-based emulator certification

**What to build:** Produce a durable certification ledger for the six target RetroArch combinations and three standalone mGBA combinations, clearly separating automated construction evidence from real Windows 11 runtime evidence.

**Blocked by:** 09 — Exercise the complete one-Play regression matrix.

**Status:** resolved

- [x] Every target emulator/platform combination records installation, detection, core resolution where applicable, command construction, real process start, content load, fullscreen, controller input, save synchronization, date, and environment.
- [x] Each combination is labelled verified, partially verified, or not verified with its remaining defect or blocker.
- [x] Actual runtime certification is claimed only for Windows 11 with legally redistributable or user-supplied test content; this ledger makes no runtime certification claim.
- [x] No commercial ROM, credential, emulator binary, database, or user data is added to the repository.
- [x] When Windows 11 or suitable content is unavailable, real-runtime fields remain `NOT VERIFIED` and state exactly what remains to be exercised.
- [x] README support claims change only for combinations genuinely exercised end to end.
- [x] No unrelated emulator or platform is marked complete.

## Answer

- Created `.scratch/transparent-romm-launching/emulator-certification.md` for exactly the six RetroArch and three standalone mGBA combinations.
- Separated deterministic construction/helper evidence from real Windows 11 runtime evidence; every unavailable runtime field remains `NOT VERIFIED`, with an exact blocker per combination.
- Recorded that no ROM/content, credentials, emulator binaries, database, or user data was added, and README support claims were intentionally unchanged.

## Verification

- `mise exec -- npm run typecheck`: passed (run after final docs).
- Focused `mise exec -- npm run test:unit -- src/immersive/ImmersiveGameDetails.test.jsx`: 8 passed.
- Full `mise exec -- npm run test:unit`: 37 tests across 7 files passed.
- `mise exec -- npm run lint:frontend`: passed with 8 pre-existing warnings, 0 errors.
- `mise exec -- npm run build`: passed with existing chunk-size warning.
- `mise exec -- cargo check --manifest-path src-tauri/Cargo.toml --tests --target x86_64-pc-windows-gnu`: passed.
- `mise exec -- cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features --target x86_64-pc-windows-gnu -- -D warnings`: passed.
- Focused Rust test and full `mise exec -- npm run test:rust` could not compile on Linux because required `javascriptcoregtk-4.1` / `libsoup-3.0` pkg-config metadata is absent; this is the existing environment baseline.
- `mise exec -- cargo fmt --all -- --check` (run from `src-tauri`) retains broad pre-existing formatting diffs in untouched Rust files.
- Windows WebDriver/manual emulator certification were unavailable on this Linux host and remain `NOT VERIFIED` in the ledger.
- `git diff --check`: passed.
- TDD/new tests were not applicable because only Markdown evidence/state changed and no behavioral seam was introduced.
