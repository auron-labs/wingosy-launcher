# Smoke-test follow-ups

## Decisions-so-far

- [x] [Keep BIOS downloads alive across navigation](issues/10-keep-bios-downloads-alive.md): Tauri MCP verified an active disposable local RomM download across BIOS → General → BIOS navigation, including visible in-progress state and completed state after remount.
- [x] [Distribute BIOS and firmware to managed emulators](issues/11-distribute-bios-and-firmware.md): Verified cached artifacts are staged into relevant managed emulator locations without replacing valid targets from invalid or incomplete sources; Tauri MCP confirmed distribution to disposable managed mGBA.
- [x] [Certify Eden update and DLC loading](issues/12-certify-eden-content-loading.md): Wingosy reused and registered the known Cuphead update, and the next managed Eden launch reported Cuphead version 1.3.7.
