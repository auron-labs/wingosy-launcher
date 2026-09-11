# 07 — Restore Rust Clippy

**What to build:** Correct the current Rust lint findings so the repository's configured Clippy gate passes without suppressing useful diagnostics.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] The configured Rust lint command passes.
- [x] No project-wide lint allowance is added to conceal a reported defect.

## Comments

- 2026-09-11: Implementation agent removed seven needless borrows and rewrote the reported indexed range loop with `iter().enumerate()`, limited to the three reported sync modules. Its `git diff --check` passed; orchestrator verification remains pending.
- 2026-09-11: Orchestrator reran `cargo clippy --all-targets --all-features --locked --offline -- -D warnings` with `RUSTC_WRAPPER=` and the repository's existing temporary empty-capability workaround; it passed. The committed capability file was restored byte-for-byte, generated schema side effects were removed, and no lint allowance was added. Review remains pending.
- 2026-09-11: The required `code-review` pass approved both axes with zero findings: Standards 0, Spec 0.

## Answer

Removed the reported needless borrows in Switch RomM/save sync and replaced the indexed settings-line range loop with an equivalent enumerated iterator. The strict configured Clippy flags now pass without adding lint allowances.
