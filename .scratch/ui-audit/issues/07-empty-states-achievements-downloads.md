# 07 — Empty states: achievements page and downloads page

**What to build:** Empty pages stop being voids with one line of stranded text. The achievements detail page gets a centered, well-composed empty state (illustration/icon, helpful copy, a CTA), one close affordance instead of competing ✕-top-right and Back-bottom-right, and no noisy "0/0 (0%)" header over nothing. The Downloads page gets the same treatment — an icon/illustration plus copy whose references to "a game's details page or a cloud library tile" are actually clickable — and the RECENT section either renders content or offers a Clear history action once populated.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Achievements page has a centered empty state with illustration and CTA
- [x] Achievements page has exactly one close affordance
- [x] Empty achievements page does not show a "0/0 (0%)" header
- [x] Downloads empty state has icon/illustration and clickable links in its instructional copy
- [x] Downloads RECENT section offers Clear history when it has content

## Notes

- The full-screen achievements empty state is centered around a trophy illustration, provides an Integrations CTA when disabled, hides the progress counter when there is no data, and keeps only the header close control.
- Downloads now has a centered icon-led empty state with real links to the library anchor (and optional navigation callbacks for embedding contexts). Populated Recent history exposes an outlined Clear history action backed by `RomDownloadsContext`.

## Smoke test (human)

1. Open the achievements detail empty state and verify the centered icon/copy, Integrations CTA, one close control, and no `0/0` counter.
2. Open Downloads with no active transfers and click both instructional links.
3. After a download completes or fails, open Downloads and click Clear history in Recent.
