import { invoke } from "@tauri-apps/api/core";
import React from "react";

import "./index.css";
import "./tauri-drag.css";
import "./iconify-setup";
import ReactDOM from "react-dom/client";

import App from "./app";
import { RomDownloadsProvider } from "./rom-downloads-context";
import { AppThemeProvider } from "./theme-provider";
import {
  debugLog,
  installNativeConsoleForwarding,
  isVerboseDebugEnabled,
} from "./utils/debug-log";
import { isTauri } from "./utils/is-tauri";

if (isTauri() && isVerboseDebugEnabled()) {
  installNativeConsoleForwarding(invoke);
}

debugLog("startup", "frontend initialized", {
  gamepadApi: navigator.getGamepads !== undefined,
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
