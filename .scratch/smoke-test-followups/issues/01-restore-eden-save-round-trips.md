# 01 — Restore Eden save round-trips

**What to build:** Make the existing Eden/RomM save flow complete a real round-trip: a successful upload remains discoverable, downloads as a valid save archive, and restores safely before Eden relaunches.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] A save reported as uploaded remains discoverable through Refresh Saves.
- [x] Restore from RomM accepts the uploaded archive and restores its files without changing local data when validation fails.
- [x] One focused regression check proves upload, discovery, archive download, and restore through the existing save-sync boundary.
- [x] Tauri MCP verifies the observable upload, refresh, and restore result against the disposable RomM fixture.

## Comments

- 2026-09-10: Claimed as the next code ticket while the preceding Eden tickets retain their unavailable live Windows checks. Each unchecked item has a Luna xhigh worker and will be independently verified by a fresh Luna xhigh agent before being marked complete.
- 2026-09-11: Item 2 implemented by `s01_restore_luna` and independently passed by fresh Luna xhigh verifier `s01_restore_verify_luna`. Downloads use RomM's canonical `/api/saves/{id}/content`, check HTTP status, and retain legacy fallback only for unsupported-route statuses. The strict round-trip check passed (1), alongside API tests (28), save-layout/ZIP-safety tests (7), and Switch sync tests (9); malformed archive responses preserved existing local files and did not send download confirmation. Verification caught and returned a helper lifetime error, which was fixed before passing.
- 2026-09-11: Item 1 implemented by `s01_discovery_luna` and independently passed by fresh Luna xhigh verifier `s01_discovery_verify_luna`. The actual Refresh Saves caller chain now uses authenticated `GET /api/saves?rom_id=...`, matching RomM 4.8.1. The strict round-trip regression returned the uploaded save and passed (1); its fixture rejects the old routes. The earlier permissive UI fixture is not counted as evidence of this correction.
- 2026-09-11: Item 3 implemented by `s01_regression_luna` and independently passed by fresh Luna xhigh verifier `s01_regression_verify_luna`. `RUSTC_WRAPPER= /home/aaron/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml eden_save_sync_round_trips_upload_discovery_archive_and_safe_restore --locked --offline -- --nocapture` passes (1), with local TCP binding permitted. The fixture enforces authenticated canonical routes and upload parameters, serves the actual uploaded ZIP bytes, checks replacement and invalid-archive preservation, and rejects both old routes. It uses temporary files at the existing API/ZIP boundary without changing process-wide environment or real app data. ZIP traversal coverage also passed independently.
- 2026-09-11: Item 4 completed by `s01_tauri_luna` and independently passed by fresh Luna xhigh verifier `s01_tauri_verify_luna` after tightening the disposable fixture to reject old routes. Actual UI upload, explicit Refresh Saves, and Restore invoked canonical `/api/saves`, `/api/saves?rom_id=4242`, and `/api/saves/9001/content`, followed by download confirmation. The captured 177-byte ZIP passed `unzip -t`; after changing the disposable local file, restore returned SHA-256 `1811c3f44f1303bda32680fed087dc7aace616f7cdca947aa809721798288037` and displayed success. Screenshot: `/tmp/wingosy-luna/restore-result-saves.png`. Tested current app binary SHA-256 `35979d9dcfa91c9f782e31c68e7f8af05128aa260cf571bcf72e3133c29b079c`, Tauri 2.11.5/MCP 0.13.0. All four items now have independent Luna xhigh verification.

## Answer

Refresh Saves and save downloads now use RomM's canonical save endpoints. Downloads reject HTTP errors before archive handling, while unsupported-route fallback and existing ZIP safety remain intact. A focused regression proves upload/discovery/download/restore and preserves local data on invalid archives; independent Tauri verification proves the observable flow against a strict disposable fixture.
