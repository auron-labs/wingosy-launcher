# 02 — Prepare Switch firmware automatically for Eden

**What to build:** On Switch Play through the selected Eden instance, prepare
the user's RomM-hosted `prod.keys` and firmware archive, validate and safely
install compatible artifacts into that instance, then launch Eden.

**Blocked by:** 01 — Prepare BIOS automatically before launch

**Status:** ready-for-agent

- [ ] Switch Play through the selected Eden instance downloads the user's RomM-hosted `prod.keys` and firmware archive using the existing scoped download, integrity, and path checks.
- [ ] The keys and firmware archive are validated for compatibility before installation or process spawn.
- [ ] Valid artifacts are installed only into the selected Eden instance, and Eden launches only after preparation succeeds.
- [ ] Missing, invalid, or incompatible artifacts stop launch with an actionable error; retries are idempotent.
- [ ] No proprietary keys or firmware are bundled or sourced outside the user's configured RomM.
