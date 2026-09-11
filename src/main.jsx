import { invoke } from "@tauri-apps/api/core";
import React from "react";

import "./index.css";
import "./tauri-drag.css";
import "./iconifySetup";
import ReactDOM from "react-dom/client";

import App from "./App";
import { RomDownloadsProvider } from "./RomDownloadsContext";
import { AppThemeProvider } from "./ThemeContext";
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
  gamepadApi: typeof navigator.getGamepads === "function",
  runtime: isTauri() ? "tauri" : "browser",
});

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("Missing root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppThemeProvider>
      <RomDownloadsProvider>
        <App />
      </RomDownloadsProvider>
    </AppThemeProvider>
  </React.StrictMode>
);
