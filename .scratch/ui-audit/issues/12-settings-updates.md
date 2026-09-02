# 12 — Settings: Updates

**What to build:** The Updates page communicates update behavior without confusion: the two overlapping toggles ("Automatic updates" vs "Check for updates when Wingosy starts") merge into one control with three clear states (off / check-and-notify / automatic); `latest.json` stops rendering in red error-looking code styling; the version becomes a labeled field instead of tiny inline prose (consistent with the General-page version from ticket 09); and radio-option copy drops tag-matching implementation details ("tag contains 'beta'") in favor of user-language descriptions of each channel.

**Blocked by:** 01 — Design-system pass: typography, buttons, and interaction states.

**Status:** resolved

- [x] A single update control expresses off / check-only / automatic — no overlapping toggles
- [x] `latest.json` is not styled as an error
- [x] Version appears as a labeled field and is not duplicated inconsistently with General
- [x] Channel option copy describes behavior in user terms with no implementation details

## Notes

- The two switches are replaced by one sentence-case three-state control: Off, Check and notify, and Automatic. The existing Rust/JS config keys are preserved: `updater.check_on_startup` and `updater.auto_update_enabled`.
- Compatibility mapping is `off` → `{ check_on_startup: false, auto_update_enabled: false }`, `check-only` → `{ check_on_startup: true, auto_update_enabled: false }`, and `automatic` → `{ check_on_startup: true, auto_update_enabled: true }`. When reading a legacy config with both flags enabled, Automatic wins because installation requires startup checking; missing flags read as Off in the pure mapper, while Rust's normal persisted defaults still provide its existing startup-check default.
- `latest.json` remains identifiable as a filename but uses neutral secondary styling rather than browser error-looking code presentation. Beta and Nightly describe release maturity and cadence without tag mechanics.
- General and Updates use the shared selectable `AppVersionField`, so the value and presentation stay consistent wherever the current version is shown.

## Smoke test (human)

1. Open Settings → Updates, choose Off, Check and notify, and Automatic, and confirm each state persists after revisiting the page. Verify `latest.json` is neutral, the version is a selectable labeled field, and channel descriptions use plain language.
