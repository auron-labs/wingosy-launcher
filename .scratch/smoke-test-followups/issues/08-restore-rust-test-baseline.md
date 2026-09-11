# 08 — Restore the Rust test baseline

**What to build:** Fix the four independently reproducible Rust test failures so they no longer poison the shared test lock and cascade into additional failures.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Each independently reproducible failing test passes in isolation.
- [ ] The full Rust test command passes apart from tests already marked ignored.
