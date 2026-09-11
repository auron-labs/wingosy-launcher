import { alpha, createTheme } from "@mui/material/styles";

/** @typedef {"dark"|"light"} ResolvedThemeMode */

const baseColors = {
  cyan: "#00ACC1",
  difficultyRed: "#E53935",
  green: "#66BB6A",
  indigo: "#5C6BC0",
  indigoDark: "#26418F",
  indigoLight: "#8E99F3",
  onSurfaceDark: "#E1E1E1",
  onSurfaceLight: "#1C1B1F",
  onSurfaceSecondaryDark: "#B3B3B3",
  onSurfaceSecondaryLight: "#5F5F5F",
  orange: "#FF7043",
  starGold: "#FFD700",
  surfaceDark: "#121212",
  surfaceDarkVariant: "#1E1E1E",
  surfaceElevated: "#252525",
  surfaceLight: "#FFFBFE",
  surfaceLightVariant: "#F5F5F5",
  teal: "#26A69A",
  trophyAmber: "#FFB300",
};

/** @param {number} hue @param {number} saturation @param {number} lightness */
const hslToHex = (hue, saturation, lightness) => {
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const a =
    normalizedSaturation *
    Math.min(normalizedLightness, 1 - normalizedLightness);
  const formatChannel = (channel) => {
    const k = (channel + hue / 30) % 12;
    const color =
      normalizedLightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${formatChannel(0)}${formatChannel(8)}${formatChannel(4)}`;
};

/** @param {number|null} accentHue Optional HSL accent hue. */
const getAccentColors = (accentHue) => {
  if (accentHue === null || accentHue === undefined) {
    return {
      primaryDark: baseColors.indigoDark,
      primaryLight: baseColors.indigoLight,
      primaryMain: baseColors.indigo,
    };
  }
  return {
    primaryDark: hslToHex(accentHue, 70, 35),
    primaryLight: hslToHex(accentHue, 70, 65),
    primaryMain: hslToHex(accentHue, 70, 50),
  };
};

/** @param {string} focusRing @param {string} focusGlow */
const createButtonStyles = (focusRing, focusGlow) => ({
  MuiButton: {
    styleOverrides: {
      contained: {
        "&:hover": { boxShadow: `0 4px 12px ${focusGlow}` },
        boxShadow: "none",
      },
      root: {
        "&.Mui-disabled": { cursor: "not-allowed" },
        borderRadius: 8,
        fontWeight: 600,
        textTransform: "none",
      },
    },
  },
  MuiButtonBase: {
    styleOverrides: {
      root: { "&:focus-visible, &.Mui-focusVisible": focusRing },
    },
  },
  MuiChip: {
    styleOverrides: { root: { borderRadius: 6, fontWeight: 600 } },
  },
  MuiIconButton: {
    styleOverrides: {
      root: { "&:focus-visible, &.Mui-focusVisible": focusRing },
    },
  },
  MuiToggleButton: {
    styleOverrides: { root: { textTransform: "none" } },
  },
});

/** @param {boolean} isDark @param {string} primaryMain */
const createSurfaceStyles = (isDark, primaryMain) => ({
  MuiCard: {
    styleOverrides: {
      root: {
        "&:hover": { borderColor: alpha(primaryMain, 0.3) },
        backgroundColor: isDark
          ? baseColors.surfaceDarkVariant
          : baseColors.surfaceLightVariant,
        backgroundImage: "none",
        border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)"}`,
        borderRadius: 12,
        transition:
          "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        backgroundColor: isDark
          ? baseColors.surfaceDarkVariant
          : baseColors.surfaceLightVariant,
        backgroundImage: "none",
        borderRight: `1px solid ${isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)"}`,
      },
    },
  },
});

/**
 * @param {string} focusRing Focus ring CSS declaration.
 * @param {string} focusShadow Focus shadow CSS declaration.
 * @param {string} focusRingColor Focus ring color.
 * @param {string} primaryMain Primary accent color.
 */
const createInputStyles = (
  focusRing,
  focusShadow,
  focusRingColor,
  primaryMain
) => ({
  MuiInputBase: {
    styleOverrides: {
      root: { "&.Mui-focused": { boxShadow: focusShadow } },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        "&.Mui-selected": {
          "&:hover": { backgroundColor: alpha(primaryMain, 0.2) },
          backgroundColor: alpha(primaryMain, 0.15),
        },
        "&:focus-visible, &.Mui-focusVisible": focusRing,
        "&:hover": { backgroundColor: alpha(primaryMain, 0.08) },
        borderRadius: 8,
        margin: "2px 0",
      },
    },
  },
  MuiSelect: {
    styleOverrides: { select: { "&.Mui-focused": focusRing } },
  },
  MuiSlider: {
    styleOverrides: {
      thumb: { "&:focus-visible, &.Mui-focusVisible": focusRing },
    },
  },
  MuiSwitch: {
    styleOverrides: { switchBase: { "&.Mui-focusVisible": focusRing } },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        "& .MuiOutlinedInput-root": {
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: focusRingColor,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(primaryMain, 0.5),
          },
        },
      },
    },
  },
});

/** @param {boolean} isDark @param {string} primaryMain @param {string} focusRing */
const createBaselineStyles = (isDark, primaryMain, focusRing) => {
  const scrollbarBase = isDark ? "#ffffff" : "#000000";
  return {
    MuiCssBaseline: {
      styleOverrides: {
        ":focus-visible": focusRing,
        body: {
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            height: 12,
            width: 12,
          },
          "&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            backgroundClip: "content-box",
            backgroundColor: alpha(scrollbarBase, 0.24),
            border: "2px solid transparent",
            borderRadius: 6,
          },
          "&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover":
            {
              backgroundColor: alpha(primaryMain, 0.6),
            },
          "&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track": {
            background: "transparent",
          },
          scrollbarColor: `${alpha(scrollbarBase, 0.32)} transparent`,
        },
        "button[data-controller-focused='true']": focusRing,
      },
    },
  };
};

/** @param {boolean} isDark @param {AccentColors} accent */
const createPalette = (isDark, accent) => ({
  background: {
    default: isDark ? baseColors.surfaceDark : baseColors.surfaceLight,
    paper: isDark
      ? baseColors.surfaceDarkVariant
      : baseColors.surfaceLightVariant,
  },
  divider: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
  error: { main: baseColors.difficultyRed },
  info: { main: baseColors.teal },
  mode: isDark ? "dark" : "light",
  primary: {
    contrastText: "#FFFFFF",
    dark: accent.primaryDark,
    light: accent.primaryLight,
    main: accent.primaryMain,
  },
  secondary: {
    dark: accent.primaryDark,
    light: accent.primaryLight,
    main: accent.primaryMain,
  },
  success: { main: baseColors.green },
  text: {
    primary: isDark ? baseColors.onSurfaceDark : baseColors.onSurfaceLight,
    secondary: isDark
      ? baseColors.onSurfaceSecondaryDark
      : baseColors.onSurfaceSecondaryLight,
  },
  warning: { main: baseColors.orange },
});

const createTypography = () => ({
  body2: { fontSize: "0.875rem" },
  button: { fontWeight: 600 },
  caption: { fontSize: "0.8125rem", lineHeight: 1.5 },
  fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
  h4: { fontWeight: 600 },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 500 },
});

/** @typedef {{primaryDark: string, primaryLight: string, primaryMain: string}} AccentColors */

/**
 * @param {ResolvedThemeMode} mode Resolved color-scheme mode.
 * @param {number|null} accentHue Optional HSL accent hue.
 * @returns {import('@mui/material/styles').Theme} Generated MUI theme.
 */
export const createAppTheme = (mode, accentHue) => {
  const isDark = mode === "dark";
  const accent = getAccentColors(accentHue);
  const focusRingColor = isDark ? accent.primaryLight : accent.primaryDark;
  const focusRing = {
    outline: `3px solid ${focusRingColor}`,
    outlineOffset: 3,
  };
  const focusGlow = alpha(accent.primaryMain, 0.4);
  const componentStyles = {
    ...createBaselineStyles(isDark, accent.primaryMain, focusRing),
    ...createButtonStyles(focusRing, focusGlow),
    ...createInputStyles(
      focusRing,
      `0 0 0 3px ${alpha(focusRingColor, 0.35)}`,
      focusRingColor,
      accent.primaryMain
    ),
    ...createSurfaceStyles(isDark, accent.primaryMain),
  };
  const themeGeometryKey = "shape";
  return createTheme({
    components: componentStyles,
    palette: createPalette(isDark, accent),
    [themeGeometryKey]: { borderRadius: 8 },
    typography: createTypography(),
  });
};

export { baseColors, getAccentColors, hslToHex };
