# 01 — Prepare BIOS automatically before launch

**What to build:** On Play, automatically prepare only the relevant BIOS files
from the user's configured RomM for the selected configured emulator, then launch
the real executable after successful installation. Show preparation progress in
desktop and immersive launch UI, reuse valid cache, and preserve manual BIOS
repair and retry controls.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] On Play, relevant RomM BIOS files are downloaded only for the selected configured emulator with a real executable, using the supported generic mappings for RetroArch, DuckStation, PCSX2, melonDS, Flycast, and mGBA.
- [x] Existing validation and cache behavior is reused, valid cached BIOS files are reused on repeated launches, and unsupported, unconfigured, or stale targets receive no writes.
- [x] BIOS preparation completes before the emulator process is spawned, with progress exposed in both desktop and immersive launch UI.
- [x] A required preparation failure prevents launch and provides an actionable error.
- [x] Manual BIOS controls remain available for repair and retry.
