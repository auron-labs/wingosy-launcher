# 10 — Keep BIOS downloads alive across navigation

**What to build:** Keep an active BIOS download running and visibly updating when the user leaves and returns to the BIOS settings page.

**Blocked by:** None — can start immediately.

**Status:** claimed

- [x] BIOS download progress updates while the BIOS page is open.
- [x] Navigating away does not cancel the download.
- [x] Returning to the BIOS page shows the current or completed state.
- [ ] Tauri MCP verifies the navigation and progress lifecycle with one safe download.

## Comments

- 2026-09-11: Implementation agent added persistent BIOS operation state and remount/completion regression coverage. Targeted Vitest passed (4 tests); full checks remain affected by pre-existing unrelated failures pending orchestrator verification.
- 2026-09-11: Implementation correction completed: focused formatting/test lint and 4 targeted tests pass; full suite has 28 passing files and 4 unrelated failing files. Tauri MCP is unavailable in this session, so the required safe-download smoke test remains blocked.
- 2026-09-11: Code review requested changes: when a user leaves and returns before completion, the remounted page can remain stale after the download finishes. Add regression coverage for that timing and ensure the mounted page reloads on completion. Tauri MCP verification still blocks resolution.
- 2026-09-11: Implementation agent addressed the review finding with stale-load protection and coverage for returning while the download is pending, then completing. Five targeted tests and focused test lint/format pass.
- 2026-09-11: Code re-review approved the corrected code and tests. The ticket remains claimed rather than resolved because the required Tauri MCP safe-download smoke test is unavailable and unchecked.
