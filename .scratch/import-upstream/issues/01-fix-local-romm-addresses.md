# 01 — Fix mixed-case local RomM addresses

**What to build:** Make scheme-less local RomM addresses choose the existing local HTTP behavior even when the hostname uses uppercase or mixed case.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Scheme-less `LOCALHOST:3000`, `RomM.LOCAL:8080`, and mixed-case `.lan` addresses infer HTTP just like their lowercase equivalents.
- [x] Explicit schemes, user-entered path casing, trimming, and the existing public/private address rules remain unchanged.

**Context:** Parent spec: “Selective upstream adoption”; upstream commit `c0289bb3`.

## Verification

- [x] Run the existing focused checks and a direct hostname check covering lowercase, uppercase, and mixed-case local addresses.

## Comments

- 2026-09-17: Claimed for implementation.
- TODO:
  - [x] Add focused regression coverage for mixed-case local hostname scheme inference.
  - [x] Apply the minimal case-insensitive host comparison and run targeted verification.
  - [x] Review the completed change and resolve the ticket if approved.
- 2026-09-17: Added focused regression coverage. The narrow test fails as expected because mixed-case local hostnames currently infer HTTPS; formatting and lint passed.
- 2026-09-17: Applied the case-insensitive comparison while preserving the original URL text. Focused Vitest passed (8/8), as did targeted lint and format checks. Broader checks still report unrelated existing `src/immersive` failures.
- 2026-09-17: Code review approved with no Standards or Spec findings.

## Answer

Local/private hostname checks now compare a lowercase copy of the hostname while returning the original normalized URL text unchanged. Focused tests cover uppercase `localhost`, mixed-case `.local` and `.lan` hosts, and explicit path-case preservation.
