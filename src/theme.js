import { createTheme, alpha } from "@mui/material/styles";

// Argosy-inspired color palette
const colors = {
  cyan: "#00ACC1",
  cyanDark: "#007C91",
  cyanLight: "#5DDEF4",

  // Secondary: Indigo
  difficultyRed: "#E53935",

  // Accent: Teal
  focusGlow: "rgba(92, 107, 192, 0.4)",
  green: "#66BB6A",
  indigo: "#5C6BC0",
  indigoDark: "#26418F",
  indigoLight: "#8E99F3",
  onSurfaceDark: "#E1E1E1",
  onSurfaceSecondary: "#9E9E9E",
  orange: "#FF7043",
  starGold: "#FFD700",
  surfaceDark: "#121212",
  surfaceDarkVariant: "#1E1E1E",
  surfaceElevated: "#252525",
  teal: "#26A69A",
  tealDark: "#00766C",
  tealLight: "#64D8CB",
  trophyAmber: "#FFB300",
};

const muiThemeKey = "shape";

const theme = createTheme({
  components: {
    MuiButton: {
      styleOverrides: {
        contained: {
          "&:hover": {
            boxShadow: `0 4px 12px ${colors.focusGlow}`,
          },
          boxShadow: "none",
        },
        root: {
          borderRadius: 8,
          fontWeight: 600,
          textTransform: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          "&:hover": {
            borderColor: alpha(colors.indigo, 0.3),
          },
          backgroundColor: colors.surfaceDarkVariant,
          backgroundImage: "none",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: 12,
          transition:
            "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            height: 8,
            width: 8,
          },
          "&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            backgroundClip: "content-box",
            backgroundColor: colors.surfaceElevated,
            border: "2px solid transparent",
            borderRadius: 4,
          },
          "&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover":
            {
              backgroundColor: alpha(colors.indigo, 0.4),
            },
          "&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track": {
            background: "transparent",
          },
          scrollbarColor: `${colors.surfaceElevated} transparent`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.surfaceDarkVariant,
          backgroundImage: "none",
          borderRight: "1px solid rgba(255, 255, 255, 0.06)",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: `2px solid ${colors.indigo}`,
            outlineOffset: 2,
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            "&:hover": {
              backgroundColor: alpha(colors.indigo, 0.2),
            },
            backgroundColor: alpha(colors.indigo, 0.15),
          },
          "&:focus-visible": {
            outline: `2px solid ${colors.indigo}`,
            outlineOffset: -2,
          },
          "&:hover": {
            backgroundColor: alpha(colors.indigo, 0.08),
          },
          borderRadius: 8,
          margin: "2px 0",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: colors.indigo,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(colors.indigo, 0.5),
            },
          },
        },
      },
    },
  },
  palette: {
    background: {
      default: colors.surfaceDark,
      paper: colors.surfaceDarkVariant,
    },
    divider: "rgba(255, 255, 255, 0.08)",
    error: {
      main: colors.difficultyRed,
    },
    info: {
      main: colors.teal,
    },
    mode: "dark",
    primary: {
      contrastText: "#FFFFFF",
      dark: colors.indigoDark,
      light: colors.indigoLight,
      main: colors.indigo,
    },
    secondary: {
      dark: colors.indigoDark,
      light: colors.indigoLight,
      main: colors.indigo,
    },
    success: {
      main: colors.green,
    },
    text: {
      primary: colors.onSurfaceDark,
      secondary: colors.onSurfaceSecondary,
    },
    warning: {
      main: colors.orange,
    },
  },
  [muiThemeKey]: {
    borderRadius: 8,
  },
  typography: {
    button: { fontWeight: 600 },
    fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 500 },
  },
});

// Export color constants for use in components
export { colors };
export default theme;
