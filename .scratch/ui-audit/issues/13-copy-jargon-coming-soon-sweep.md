# 13 — Copy, jargon, and coming-soon sweep

**What to build:** A final app-wide copy pass that cleans up everything the page tickets didn't already fix: internal vocabulary ("certified RetroArch core", "certification ledger", "promised for ps2", "RomM pair", tag-matching rules) is replaced with plain user language everywhere it appears; and a consistent policy is applied to unshipped features — every "Coming soon" / "Not available" surface is either hidden, clearly marked as preview, or carries a note/roadmap link — so roughly a fourth of the currently surfaced UI stops being tombstones that train users to ignore real controls.

**Blocked by:** 05 — Game details page overhaul; 10 — RomM and Integrations; 12 — Updates.

**Status:** resolved

- [x] No internal jargon remains in user-facing copy (searched and replaced systematically)
- [x] A consistent preview/hide policy is applied to every unshipped-feature surface
- [x] Disabled placeholder surfaces either link to a note/roadmap or are hidden
- [x] Copy pass verified across library, details, dialogs, downloads, and all settings pages

## Notes

- Immersive More options now contains working actions only. The Ratings, Updates/DLC, disc, variant, and Title ID tombstones (including every `Coming soon` / `Not available` label) are hidden rather than presented as dead controls. The existing Integrations `Preview` chip and explanatory note remain the policy for that disabled integration.
- RetroArch settings now use plain language: `Wingosy-managed RetroArch setup`, `RetroArch support needed for your game library`, and `Wingosy controller settings`; the beta-profile, certified-manifest, and promised-core wording is no longer shown. RomM sync fallbacks say `Not reported`, with the existing metadata explanation retained.
- Missing RetroArch launch errors are translated in desktop and Immersive details, including an emulator-settings action and no retry for deterministic failures. Direct Rust errors used by settings/core downloads were also changed to remove certification language. Update-channel empty results no longer expose tag-matching or GitHub prerelease mechanics.
- Sweep terms and outcomes: `coming soon`, `not available`, `certified`, `certification`, `promised`, `ledger`, `tag contains`, `tag matching`, and `RomM pair` have no remaining user-facing-copy matches in `src`; `beta` remains only for the real Private Beta/release channels, and `pairing` remains the intentional Device pairing authentication choice established by ticket 10. Remaining matches in tests, internal identifiers/comments, debug logging, and the non-visible certification document URL are not rendered UI copy. BIOS `Unavailable` labels describe actual RomM file availability and retain their explanatory note.

## Smoke test (human)

1. Open Immersive game details → More options and confirm only working actions are listed; no Coming soon/Not available tombstones appear.
2. Open Settings → Emulators and expand RetroArch; confirm the setup/core copy uses plain language. Open Settings → Integrations and confirm the `Preview` label and explanation remain visible.
3. Trigger a missing-emulator launch from desktop and Immersive details; confirm the message names a compatible emulator, offers Open Settings, and does not offer Retry. Check Settings → RomM metadata and Updates for `Not reported`/plain release messages.
