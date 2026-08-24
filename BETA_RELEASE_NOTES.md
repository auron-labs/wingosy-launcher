# Private Beta Release Notes

## Scope

This beta is for **Windows 11** and the narrow RetroArch path for **NES, SNES,
GB, GBC, GBA, and Genesis**. The intended RomM flow is pair, sync the library,
download a ROM, and use one-Play. These six paths are still pending real Windows
certification; see the [certification ledger](.scratch/transparent-romm-launching/emulator-certification.md).

## Known Limitations

- Standalone mGBA and every other emulator/platform combination are experimental.
- Automatic save sync is experimental and is not part of this beta promise.
- Manual save upload/download is the supported save behavior. It may require
  selecting the intended save in game details and does not replace an emulator's
  active save directory automatically.
- Controllers, shaders, achievements, and other platform-specific behavior are
  best-effort outside the stated RetroArch path.

Back up ROMs, emulator saves, and your Wingosy data before testing. Do not use a
beta as the only copy of important saves. Keep a separate backup before trying
manual save upload/download or changing emulator save locations.

## Reporting Problems

Use the [GitHub bug report form](https://github.com/auron-labs/wingosy-launcher/issues/new?template=bug_report.md).
Include the app version, Windows version, reproduction steps, expected behavior,
actual behavior, and relevant redacted logs.

Never attach `config.toml`, the database, credentials or access tokens, or ROM
names or paths. Redact personal paths and RomM URLs from any logs before sharing.
Wingosy never automatically attaches, collects, or uploads those files or other
user data.

## Tester Guide

- **Update channel:** Select **Settings > Updates > Beta** for the cohort build
  when instructed by the maintainers. Keep a separate backup before installing
  an update.
- **Logs:** Use **Settings > General > Open Logs Folder** or open
  `%APPDATA%\wingosy\launcher\data\logs\`. Logs roll daily; Wingosy does not
  automatically delete old logs or collect and upload diagnostics.
- **Feedback owner:** Auron Labs maintainers monitor the bug report route.
  Reports are reviewed on a best-effort basis during the one-week first cohort;
  there is no guaranteed response time.
- **Cohort gates:** Start with 3-5 technically comfortable testers for one week.
  Before expanding to 10-20 testers, close all first-cohort P0 setup, launch,
  update, data-loss, and credential issues. Do not add features during this gate.
