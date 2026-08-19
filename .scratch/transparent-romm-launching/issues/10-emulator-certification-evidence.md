# 10 — Record evidence-based emulator certification

**What to build:** Produce a durable certification ledger for the six target RetroArch combinations and three standalone mGBA combinations, clearly separating automated construction evidence from real Windows 11 runtime evidence.

**Blocked by:** 09 — Exercise the complete one-Play regression matrix.

**Status:** ready-for-agent

- [ ] Every target emulator/platform combination records installation, detection, core resolution where applicable, command construction, real process start, content load, fullscreen, controller input, save synchronization, date, and environment.
- [ ] Each combination is labelled verified, partially verified, or not verified with its remaining defect or blocker.
- [ ] Actual runtime certification uses Windows 11 and legally redistributable or user-supplied test content.
- [ ] No commercial ROM, credential, emulator binary, database, or user data is added to the repository.
- [ ] When Windows 11 or suitable content is unavailable, real-runtime fields remain `NOT VERIFIED` and state exactly what remains to be exercised.
- [ ] README support claims change only for combinations genuinely exercised end to end.
- [ ] No unrelated emulator or platform is marked complete.

