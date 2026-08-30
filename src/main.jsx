import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./tauri-drag.css";
import "./iconifySetup";
import App from "./App";
import { AppThemeProvider } from "./ThemeContext";
import { RomDownloadsProvider } from "./RomDownloadsContext";
import { invoke } from "@tauri-apps/api/core";
import {
  debugLog,
  installNativeConsoleForwarding,
  isVerboseDebugEnabled,
} from "./utils/debugLog";
import { isTauri } from "./utils/isTauri";

if (isTauri() && isVerboseDebugEnabled()) {
  installNativeConsoleForwarding(invoke);
}

debugLog("startup", "frontend initialized", {
  runtime: isTauri() ? "tauri" : "browser",
  gamepadApi: typeof navigator.getGamepads === "function",
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppThemeProvider>
      <RomDownloadsProvider>
        <App />
      </RomDownloadsProvider>
    </AppThemeProvider>
  </React.StrictMode>
);
