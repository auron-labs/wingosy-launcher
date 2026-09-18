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
- 2026-09-18: Tauri MCP connected to the current debug app (bridge 0.13.0, Tauri 2.11.5) and verified the first-run state, but this Linux checkout has no configured RomM session: `is_first_run` returned `true`, `has_saved_romm_session` returned `false`, config has null RomM URL/token, and `list_bios_firmware` returned `RomM server is not configured`. A safe BIOS download could not be started without the disposable RomM credentials, so no navigation/progress lifecycle evidence was produced; this criterion remains unchecked and the ticket stays claimed.
- 2026-09-18: Tauri MCP smoke passed against a disposable local RomM mock serving only `GET /api/platforms` and `GET /api/firmware/424242/content/smoke-firmware.bin`. BIOS UI showed `Downloading…`; after navigating to General, the temporary BIOS `.part` file reached 2,686,976 bytes, and returning to BIOS showed `Downloaded 1 PlayStation firmware file`, `1 downloaded · 0 missing`, and `Ready` after the 3,145,728-byte payload completed. The temporary config, BIOS directory, database, logs, capability workaround, generated schemas, and mock server were restored or cleaned.
- 2026-09-18: Code review found no issues and approved the tracker-only resolution/evidence.

## Answer

The BIOS download remained active across settings navigation and the remounted BIOS page displayed the completed state. Tauri MCP exercised the real BIOS UI with a harmless, deliberately slow local RomM payload; no real credentials or firmware were used.
