# 01 — Make manual RomM downloads atomic

**What to build:** Make the existing manual Download action safe against interruption and invalid transfers while preserving its current user-visible progress and storage behaviour. A completed download should appear in the managed ROM cache only after it has been validated, and an existing valid cached copy must survive a failed replacement attempt.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [ ] Manual Download writes to a temporary partial file on the destination filesystem and exposes the final path only after validation succeeds.
- [ ] Expected size is validated when RomM supplies one; unavailable checksum or size data is not invented.
- [ ] Failed transfers do not mark the game as synced, do not overwrite a valid cached ROM, and safely remove their partial file.
- [ ] A valid cached ROM can be reused without another content download.
- [ ] Existing manual download progress, completion, and failure reporting continues to work.
- [ ] Delete Local ROM and ROM-storage migration protection continue to work.
- [ ] Automated tests cover success, truncated or failed transfer, cached reuse, and paths containing spaces and Unicode.

