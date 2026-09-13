import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";

/** Minimal MUI tree for Vitest (avoids ThemeContext / Tauri invoke). */
const testTheme = createTheme({ palette: { mode: "dark" } });

export const MuiTestProvider = ({ children }) => (
  <ThemeProvider theme={testTheme}>
    <CssBaseline />
    {children}
  </ThemeProvider>
);
