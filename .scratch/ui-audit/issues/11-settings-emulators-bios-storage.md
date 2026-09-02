# 11 — Settings: Emulators, BIOS/Firmware, and Storage

**What to build:** The three heaviest settings pages become self-explanatory. Emulators: icon-only action buttons on installed emulator cards get labels; truncated install paths gain a copy affordance, full-path tooltip, or open-folder action; the platform-defaults panel is aligned so each dropdown unambiguously belongs to its platform, with dropdowns showing a real value ("Auto") instead of the "Emulator" placeholder; the configurable-platform set is reconciled with the downloadable emulators so users can tell where unlisted platforms are managed; the download list shows version/size/installed state; and "Apply Paths" + refresh controls are labeled or explained. BIOS & Firmware: the wall of red "Missing" pills is prioritized by what the user's library actually needs, suspicious totals ("0 of 70") are validated or explained, and per-platform download is possible without hunting chevrons (rows look and act clickable) alongside the bulk action. Storage: stat cards gain free-disk-space, the directory row orders buttons primary-first ("Change" before "Default"), folder rows get a clear click affordance, and the migration info banner is tightened.

**Blocked by:** 01 — Design-system pass; 02 — Layout width and scrollbar system.

**Status:** resolved

- [x] Emulator card actions are labeled; paths are copyable/expandable; placeholder dropdowns show real values
- [x] Platform-defaults rows are visually unambiguous (aligned dropdowns)
- [x] Downloadable emulator list shows version/size/installed metadata
- [x] BIOS "Missing" list is prioritized by library relevance; per-platform download is an obvious, clickable affordance
- [x] Suspicious BIOS counts are verified or explained in the UI
- [x] Storage shows free disk space; directory buttons ordered with primary first; folder rows clearly clickable

## Notes

- Installed emulator actions now use visible labels; paths have a full-path tooltip, Copy path, and Open folder actions. Apply detected paths and Refresh are also labeled.
- Platform defaults use aligned grid rows and display `Auto` as the actual unset value. Defaults are listed for platforms with games; unlisted platforms remain on Auto until a game is added, while the download list shows each emulator's supported platforms.
- The current `EmulatorInfo` backend exposes installed versions but does not preflight download release version/size. The download list displays `Not reported` rather than inventing metadata until the backend supplies it.
- BIOS groups are ordered using the existing platform-with-games context, with a `Needed by your library` marker. RomM-unavailable firmware is separated from downloadable totals so counts such as `0 of 70` are explained instead of presented as missing local files. Each group exposes a visible Download missing action.
- Storage has a Free disk space card and honest `Not reported` fallback because `get_storage_overview` does not currently expose host free-space data. Change appears before Default; Default only resets directly when no tracked ROMs need migration, otherwise the user is directed through Change. Existing storage rows use a clickable Open folder affordance.

## Smoke test (human)

1. Open Settings → Emulators: confirm installed cards show Launch, Open folder, Copy path, and More; hover a long path for its full value, and confirm Apply detected paths / Refresh are labeled. Check a platform default reads Auto and the download rows show version, size, and install state (or the honest Not reported fallback).
2. Open Settings → BIOS: confirm library platforms appear first and are marked Needed by your library, unavailable RomM files are explained in the totals, and a platform's Download missing button works without expanding the row first.
3. Open Settings → Storage: confirm the Free disk space card, Change before Default, the shortened migration banner, and clickable existing folder rows.
