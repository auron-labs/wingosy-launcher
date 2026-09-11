# 10 — Keep BIOS downloads alive across navigation

**What to build:** Keep an active BIOS download running and visibly updating when the user leaves and returns to the BIOS settings page.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] BIOS download progress updates while the BIOS page is open.
- [ ] Navigating away does not cancel the download.
- [ ] Returning to the BIOS page shows the current or completed state.
- [ ] Tauri MCP verifies the navigation and progress lifecycle with one safe download.
