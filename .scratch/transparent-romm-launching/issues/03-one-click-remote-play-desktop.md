# 03 — Enable one-click remote Play on desktop

**What to build:** Let a desktop user press Play once on a remote-only RomM game and have Wingosy restore the configured RomM session, download and validate the ROM through the shared cache path, launch it automatically, and show useful preparation or retry feedback throughout.

**Blocked by:** 02 — Route local and cached games through one Play pipeline.

**Status:** resolved

- [ ] Remote-only games expose Play as their primary desktop action rather than requiring Download followed by Play.
- [ ] The backend resolves the existing saved RomM session without introducing another credential store.
- [ ] Remote preparation uses the same atomic download service as the manual Download action.
- [ ] Progress covers resolving, downloading, validating, finalizing, save synchronization, launching, running, completion, and failure.
- [ ] Known byte totals show downloaded bytes, total bytes, and percentage; unknown totals remain indeterminate.
- [ ] A failed download never launches the emulator and presents a recoverable retry.
- [ ] A successful second Play reuses the cached copy without another content download.
- [ ] Repeated desktop activation invokes only one preparation operation.
- [ ] Manual Download and Delete Local ROM remain available and accurate.
- [ ] Automated tests cover remote success, staged progress, failed download, retry, cached replay, and double activation.

