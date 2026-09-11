# 09 — Fix Emulators settings markup

**What to build:** Render Settings → Emulators with valid element nesting so React no longer reports a `<div>` inside a `<p>`.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Opening Settings → Emulators produces no invalid DOM nesting warning.
- [x] The affected explanatory content retains its current appearance and meaning.

## Comments

- Implementation complete: the downloadable-emulator metadata now uses valid `div` markup, with a focused regression test preserving the explanatory content. The targeted test and diff check pass; repository-wide typecheck, build, and frontend lint remain blocked by pre-existing failures outside this ticket. Awaiting code review.
- Code review complete: Standards and Spec reviews approved the focused source and regression-test changes with no findings.

## Answer

Settings → Emulators now renders downloadable-emulator metadata through MUI's secondary `div` slot instead of the default paragraph, eliminating the invalid nested `div` while retaining the existing content and styling. A focused component test covers the metadata element and invalid-nesting regression.
