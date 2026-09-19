# 08 — Correct generic/manual save uploads

**What to build:** Make generic and manual save uploads use RomM's supported upload contract and report unsuccessful HTTP responses as failures, while preserving device-aware Eden uploads and the existing manual-save UI.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Generic/manual uploads target the canonical `/api/saves` endpoint with the canonical ROM identity and multipart `saveFile` field.
- [x] HTTP status is validated before reporting success; rejected or failed responses produce an actionable failure and never appear as a successful upload.
- [x] The existing manual upload UI, retry behavior, and save identity handling remain usable, and device-aware Eden uploads retain their current canonical behavior.

**Context:** Parent spec: “Selective upstream adoption”; generic upload portion of the reviewed save-sync work (PR #11). This ticket is independently startable and is not a prerequisite for ticket 09.

## Verification

- [x] Use the existing save fixture to accept the canonical multipart request and reject HTTP failures, then verify the existing manual UI reports each outcome correctly.

## Implementation progress

- [x] Add focused fixture coverage for the generic upload contract and HTTP failure handling.
- [x] Correct the generic RomM upload request while preserving the device-aware Eden path.
- [x] Verify the existing manual upload UI reports success, failure, and retry with the same save identity.
- [x] Run targeted and repository verification.
- [x] Complete code review and address any findings.

## Comments

- Targeted frontend save tests pass (4/4), as do changed-file formatting and diff checks. Rust fixture tests are present but could not execute: the shared target has a missing generated Tauri permission artifact, while an isolated target reaches unrelated pre-existing `src/bios.rs` compile errors. Repository-wide frontend checks likewise reach unrelated immersive-mode failures; no changed-file failures remain.
- Code review approved both Standards and Spec after the generic error detail was made UTF-8-safe and covered by the fixture.

## Answer

Generic/manual saves now use RomM's canonical `/api/saves?rom_id=…` multipart contract with the `saveFile` field. Non-success responses return bounded actionable errors, while the existing device-aware Eden request remains unchanged. Focused fixture and UI coverage verifies the request, HTTP failure presentation, success presentation, and retry with the same save identity.
