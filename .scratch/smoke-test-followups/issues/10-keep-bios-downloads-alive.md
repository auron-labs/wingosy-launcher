# 10 — Keep BIOS downloads alive across navigation

**What to build:** Keep an active BIOS download running and visibly updating when the user leaves and returns to the BIOS settings page.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] BIOS download progress updates while the BIOS page is open.
- [x] Navigating away does not cancel the download.
- [x] Returning to the BIOS page shows the current or completed state.
- [x] Tauri MCP verifies the navigation and progress lifecycle with one safe download.

## Comments

- 2026-09-11: Implementation agent added persistent BIOS operation state and remount/completion regression coverage. Targeted Vitest passed (4 tests); full checks remain affected by pre-existing unrelated failures pending orchestrator verification.
- 2026-09-11: Implementation correction completed: focused formatting/test lint and 4 targeted tests pass; full suite has 28 passing files and 4 unrelated failing files. Tauri MCP is unavailable in this session, so the required safe-download smoke test remains blocked.
- 2026-09-11: Code review requested changes: when a user leaves and returns before completion, the remounted page can remain stale after the download finishes. Add regression coverage for that timing and ensure the mounted page reloads on completion. Tauri MCP verification still blocks resolution.
- 2026-09-11: Implementation agent addressed the review finding with stale-load protection and coverage for returning while the download is pending, then completing. Five targeted tests and focused test lint/format pass.
- 2026-09-11: Code re-review approved the corrected code and tests. The ticket remains claimed rather than resolved because the required Tauri MCP safe-download smoke test is unavailable and unchecked.
- 2026-09-19: Blocked: the Tauri MCP daemon is available, but `tauri-mcp driver-session status` reports `connected: false` with no running development app. Per the Linux testing restriction, no Windows Tauri app was started and no BIOS download was attempted; the required safe-download lifecycle verification remains incomplete.
- 2026-09-19: RESOLVED on a Windows host (the prior Linux-only restriction did not apply). Started the MCP daemon + driver session and ran the debug app (`tauri dev`, MCP bridge on 127.0.0.1:9223, `driver-session status` → connected, plugin 0.13.0). To get the app building I fixed two unrelated pre-existing compile errors that blocked the cold build: `bios.rs:102` (`job.key` → `job.job.key`, E0609) and `sync/switch_save.rs:381` (sha2 0.11 `Array` no longer implements `LowerHex`; re-encoded via the codebase's per-byte `{byte:02x}` pattern). With a connected RomM server, I drove the BIOS settings page through Tauri MCP: started the SNES group download ("Download missing (17)"), observed live per-file "Downloading..."/"Queued" progress and progress bars on the open page (criterion 1), navigated to the Downloads view and confirmed the transfers continued and completed rather than cancelling (criterion 2 — RECENT listed the saved files), then returned to the BIOS page which reloaded to "17 downloaded · 2 missing", a green "Downloaded 17 Super Nintendo Entertainment System firmware files." banner, and a SNES "Ready / 17 of 17" state (criterion 3 + the remount-after-completion review fix; no stale "Missing"). Repeated the round-trip on the Switch group ("Download missing (2)") including the ~340MB firmware.zip: navigated away while it showed "Downloading...", returned to find "19 downloaded · 0 missing", "✓ Downloaded 2 Nintendo Switch firmware files.", and both groups "Ready". All 17 SNES + 2 Switch files confirmed on disk under `data/bios/{snes,switch}`. Screenshot evidence in `.scratch/smoke-test-followups/evidence/10-bios-downloads/`. All four acceptance criteria verified in the live app via Tauri MCP; marking resolved.
