# 06 — Restore frontend static-analysis gates

**What to build:** Correct the existing frontend type and lint failures so the repository's configured frontend static-analysis commands pass without hiding errors.

**Blocked by:** None — can start immediately.

**Status:** claimed

- [ ] The configured frontend typecheck passes.
- [ ] The configured frontend lint command passes.
- [ ] Fixes preserve the behavior covered by the existing frontend suite and production build.

## Comments

- 2026-09-11: Claimed after retaining ticket 05's unavailable Windows readiness and device smoke checks. One Luna xhigh worker per acceptance item, followed by fresh Luna xhigh verification. Preserve the configured gates: no relaxed rules, exclusions, or suppression comments to conceal errors.
- 2026-09-11: Baseline behavior worker `s06_behavior_luna` ran the full frontend suite (28 files, 210 tests passed) and production build (passed, existing large-chunk warning). Static-analysis baseline failed across most source files: 69 formatting failures and thousands of type-aware lint diagnostics, with missing data types and existing oversized components accounting for much of the debt. Final behavior verification is still required after repairs.
