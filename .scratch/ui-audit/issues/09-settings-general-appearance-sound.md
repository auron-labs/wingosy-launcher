# 09 — Settings: General, Appearance, and Sound fixes

**What to build:** The three lighter settings pages become usable. General: the wall of beta copy is broken into bullets/sections, "Open certification ledger" jargon is replaced, the app version becomes a labeled selectable field (and stops being duplicated from Updates), the disabled "Fullscreen (Immersive)" toggle explains why it's disabled, and the deadzone slider shows its numeric value with a properly styled reset button. Appearance: the accent slider gets a value readout and its relationship to the "Default (Indigo)" swatch is made clear, "Reset to Default" stops looking permanently disabled, and theme choice (Light/System) offers a preview. Sound: when a parent toggle is off, its child sliders and file buttons are visibly disabled (not just inert), sliders show numeric values, UI sounds get a preview affordance, and the "(Immersive)" parenthetical is clarified or removed for desktop users.

**Blocked by:** 01 — Design-system pass: typography, buttons, and interaction states.

**Status:** resolved

- [x] General beta copy is sectioned; internal jargon removed; version is a labeled, selectable, non-duplicated field
- [x] Disabled Fullscreen toggle communicates its Immersive-mode dependency
- [x] Deadzone and all other sliders show numeric current values; reset controls are styled as real buttons
- [x] Accent slider shows a value and default-swatch interaction is unambiguous
- [x] Appearance offers theme preview without switching
- [x] Sound child controls are visibly disabled while their parent toggle is off
- [x] UI sound entries have a preview/play affordance

## Notes

- General beta guidance is now grouped into a scope list, with a selectable `App version` field and plain-language supported-path link instead of certification-ledger wording.
- `SettingSlider` provides the shared persistent numeric readout for deadzone, accent hue, UI volume, and background-music volume. Reset actions use outlined buttons and remain available at their default values.
- Appearance includes static Light/System/Dark previews and explains that the Default (Indigo) swatch is overridden by a custom hue.
- Sound controls inherit disabled treatment from their parent settings, including audio-source buttons, shuffle, and volume. The background-music toggle can be enabled before choosing the first source so the source buttons do not create a dead end. The UI preview uses an additive desktop-capable `previewArgosySound` context method.

## Smoke test (human)

1. Open Settings → General, Appearance, and Sound. Confirm the version field can be selected, fullscreen explains its dependency, every slider shows a value, theme previews are visible, Reset buttons look actionable, and turning sound off dims/disables its child controls while Preview is available after enabling UI sounds.
