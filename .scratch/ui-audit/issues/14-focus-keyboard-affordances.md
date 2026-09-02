# 14 — Focus and keyboard affordances

**What to build:** Keyboard and controller navigation become visible and discoverable across the app: focus rings render on focusable elements, keyboard shortcuts are hinted where they exist (e.g. a search shortcut hint near search, Esc/F11/controller hints where documented), using the design system's focus styling from ticket 01 so the affordance is consistent on desktop and immersive modes.

**Blocked by:** 01 — Design-system pass: typography, buttons, and interaction states.

**Status:** resolved

- [x] Visible focus rings on all interactive elements in both desktop and immersive modes
- [x] Keyboard-shortcut hints shown where shortcuts exist (search, navigation, controller/Esc/F11)
- [x] Focus styling consistent with the design-system patterns

## Notes

- `ThemeContext.jsx` now owns the shared accent-derived focus ring for global focusable elements, MUI button bases, inputs, switches, sliders, selects, and immersive controller focus markers. The dark theme uses the light accent and the light theme uses the dark accent for contrast; the immersive library no longer suppresses its root focus outline.
- Desktop Library search advertises `Ctrl+F / ⌘F`; Settings and the immersive hint bar advertise `F11` fullscreen. Immersive hints match the mapper: arrows/D-pad/stick navigate, Enter/South confirms, Esc/East goes back, PageUp/PageDown/LB/RB change sections, S/Menu opens Settings from the library, and H/View toggles help.
- Esc affordances were added to the launch-failure dialog, destructive confirmation, collection picker, achievement overlay, and screenshot lightbox. Informational dialogs keep their existing explicit OK/Cancel actions rather than adding another label.

## Smoke test (human)

1. Tab through the desktop sidebar, Library controls/cards, Settings controls, and a dialog; confirm each focused control has a clear accent ring, then press `Ctrl+F`/`⌘F` in Library.
2. Enter Immersive mode, move with a controller or arrow keys, and confirm the selected tile/action ring and bottom hints are visible; press `F11`, `Esc`, and `H` to verify their advertised actions.
3. Open a screenshot or confirmation/launch overlay and confirm the visible Esc hint matches the close/back behavior.
