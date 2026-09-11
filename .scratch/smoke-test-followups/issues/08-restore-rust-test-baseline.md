# 08 — Restore the Rust test baseline

**What to build:** Fix the four independently reproducible Rust test failures so they no longer poison the shared test lock and cascade into additional failures.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Each independently reproducible failing test passes in isolation.
- [x] The full Rust test command passes apart from tests already marked ignored.

## Comments

- Implementation complete: updated four stale error-message assertions to match the current verification wording. All four tests pass in isolation; the full Rust suite passes with 334 tests passed and 0 failed.
- Code review approved: no standards or specification findings.
