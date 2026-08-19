# 02 — Route local and cached games through one Play pipeline

**What to build:** Give desktop and immersive Play actions one backend prepare-and-launch operation for games whose ROM is already local. The operation should resolve and validate the ROM, preserve the existing save-sync and emulator lifecycle, wait for the emulator to exit, record the play session, and report coherent preparation stages.

**Blocked by:** 01 — Make manual RomM downloads atomic.

**Status:** resolved

- [ ] Desktop and immersive Play invoke the same prepare-and-launch operation for local and cached games.
- [ ] A valid local or cached game launches without requesting its ROM content from RomM.
- [ ] Missing local files fail before save sync or emulator startup with a useful error.
- [ ] Existing pre-launch and post-launch save synchronization still surrounds the emulator process.
- [ ] Existing emulator selection and play-session recording are preserved.
- [ ] Progress reports resolving, save synchronization, launching, running, completion, and failure with the game identity.
- [ ] Repeated activation for the same game cannot start multiple emulator processes.
- [ ] Existing launch callers remain compatible until all Play actions have migrated.
- [ ] Automated tests cover local success, cached success, missing ROM, lifecycle ordering, and duplicate activation.

