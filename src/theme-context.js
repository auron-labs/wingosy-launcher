import { createContext, useContext } from "react";

import { baseColors } from "./theme-factory";

/** @typedef {"dark"|"light"|"system"} ThemeMode */
/** @typedef {{accentHue: number|null, colors: Record<string, string>, setAccentHue: (hue: number|null) => void, setThemeMode: (mode: ThemeMode) => void, themeMode: ThemeMode}} ThemeContextValue */

/** @param {number|null} _hue Ignored default-context accent update. */
const ignoreAccentUpdate = (_hue) => _hue;
/** @param {ThemeMode} _mode Ignored default-context mode update. */
const ignoreThemeModeUpdate = (_mode) => _mode;

/** @type {import('react').Context<ThemeContextValue>} */
export const ThemeContext = createContext({
  accentHue: null,
  colors: baseColors,
  setAccentHue: ignoreAccentUpdate,
  setThemeMode: ignoreThemeModeUpdate,
  themeMode: "dark",
});

export const useAppTheme = () => useContext(ThemeContext);
