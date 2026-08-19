# 11 — Run the Phase 1 release gate

**What to build:** Run the complete project-defined validation and produce the required Phase 1 completion report so maintainers can distinguish implemented behaviour, automated evidence, real Windows verification, regressions, and remaining gaps.

**Blocked by:** 10 — Record evidence-based emulator certification.

**Status:** ready-for-agent

- [ ] All applicable frontend lint, type checking, unit tests, Rust formatting, Rust unit and integration tests, Rust clippy, production build, and Tauri/WebDriver suites are run.
- [ ] Windows-specific tests are run on Windows when supported; unavailable checks are explicitly identified rather than silently skipped.
- [ ] Failing tests are investigated and reported without weakening, skipping, or deleting them merely to obtain a green result.
- [ ] Manual ROM download, Delete Local ROM, local-only games, RomM library sync, RetroArch save sync, play-session recording, and immersive controller navigation receive explicit regression statuses.
- [ ] The completion report uses the exact structure required by the Phase 1 specification and lists exact commands and outcomes.
- [ ] Overall status is `PARTIALLY VERIFIED` or `NOT VERIFIED` whenever real Windows emulator evidence is incomplete.
- [ ] Any commits created for the phase are listed; no changes are pushed unless explicitly instructed.
