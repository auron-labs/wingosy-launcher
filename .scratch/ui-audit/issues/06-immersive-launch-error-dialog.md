# 06 — Immersive launch error dialog

**What to build:** When a game can't launch, the error dialog helps the user fix it instead of frustrating them: "No certified RetroArch core is promised for ps2" becomes plain language with a concrete next step — an "Open Settings" / emulator-install CTA alongside corrected Back/Retry behavior (Retry only when a retry could succeed); the dialog header no longer duplicates the game title already on the page behind it; the modal gets a real dim/scrim so it clearly separates from the page; and the "Saves (RomM)" copy referring to "the menu above" is rewritten to name the actual control or location.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Error copy is plain language with no internal jargon ("promised" removed)
- [x] Dialog offers an actionable CTA (Open Settings / install/mapping guidance)
- [x] Retry is not offered when it would deterministically fail again
- [x] Game title is not duplicated between dialog header and page behind
- [x] Modal dim clearly separates dialog from background
- [x] "The menu above" spatial reference replaced with a direct reference

## Notes

- The frontend maps the known missing-core backend error to plain language, names the platform, and points to Settings → Emulators. The backend string remains unchanged.
- `Retry` is retained for failures that may succeed on another attempt, while the deterministic missing-core failure offers `Open Settings` as its contained action instead.
- The launch dialog header is now `Launch failed`/`Preparing game` rather than the game title, and its backdrop uses a strong scrim plus brightness reduction. The page title remains the only game-title heading.
- Cloud-save guidance now names the game's More options menu instead of using a spatial reference.

## Smoke test (human)

1. Open a game whose platform has no available emulator core and attempt to launch it.
2. Confirm the dialog explains the emulator problem in plain language, offers Open Settings, has no Retry, and visibly dims the page behind it.
3. Trigger a transient launch failure and confirm Retry remains available; verify the Saves section names the More options menu directly.
