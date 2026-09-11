# 11 — Distribute BIOS and firmware to managed emulators

**What to build:** After Wingosy obtains BIOS or firmware for a platform, place it in the expected location for each relevant managed emulator so it is usable without manual copying.

**Blocked by:** 10 — Keep BIOS downloads alive across navigation.

**Status:** ready-for-agent

- [ ] Completed BIOS and firmware downloads are distributed to the relevant installed managed emulators.
- [ ] Existing valid emulator files are not overwritten with invalid or incomplete downloads.
- [ ] The UI reports whether distribution completed or failed.
- [ ] Tauri MCP verifies the observable result for one available platform and managed emulator.
