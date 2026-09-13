import CssBaseline from "@mui/material/CssBaseline";
import { alpha, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";

import { ThemeContext } from "./theme-context";
import { baseColors, createAppTheme, getAccentColors } from "./theme-factory";

/** @typedef {"dark"|"light"|"system"} ThemeMode */
/** @typedef {{display?: {theme_mode?: ThemeMode, accent_hue?: number|null}}} ThemeConfig */

/** @type {ThemeMode} */
const defaultThemeMode = "dark";
/** @type {number|null} */
const defaultAccentHue = null;

/** @returns {Promise<ThemeConfig>} Current persisted theme settings. */
const loadThemeConfig = async () => await invoke("get_config");

/** @param {{children: import('react').ReactNode}} props Provider props. */
export const AppThemeProvider = ({ children }) => {
  /** @returns {ThemeMode} Initial theme mode. */
  const initialThemeMode = () => defaultThemeMode;
  const [themeMode, setThemeMode] = useState(initialThemeMode);
  /** @returns {number|null} Initial accent hue. */
  const initialAccentHue = () => defaultAccentHue;
  const [accentHue, setAccentHue] = useState(initialAccentHue);
  const [loaded, setLoaded] = useState(false);

  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  useEffect(() => {
    const loadThemeSettings = async () => {
      try {
        const cfg = await loadThemeConfig();
        if (cfg.display?.theme_mode !== undefined) {
          setThemeMode(cfg.display.theme_mode);
        }
        if (cfg.display?.accent_hue !== undefined) {
          setAccentHue(cfg.display.accent_hue);
        }
      } catch {
        // Config may not exist yet
      }
      setLoaded(true);
    };
    void loadThemeSettings();
  }, []);

  const effectiveMode = useMemo(() => {
    if (themeMode === "system") {
      return prefersDark ? "dark" : "light";
    }
    return themeMode;
  }, [themeMode, prefersDark]);

  const theme = useMemo(
    () => createAppTheme(effectiveMode, accentHue),
    [effectiveMode, accentHue]
  );

  const colors = useMemo(() => {
    const { primaryDark, primaryLight, primaryMain } =
      getAccentColors(accentHue);
    return {
      ...baseColors,
      focusGlow: alpha(primaryMain, 0.4),
      primary: primaryMain,
      primaryDark,
      primaryLight,
    };
  }, [accentHue]);

  const contextValue = useMemo(
    () => ({
      accentHue,
      colors,
      setAccentHue,
      setThemeMode,
      themeMode,
    }),
    [themeMode, accentHue, colors]
  );

  if (!loaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
