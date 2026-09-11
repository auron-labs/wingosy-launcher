import Box from "@mui/material/Box";
import { useEffect } from "react";

import WindowChrome from "../components/WindowChrome";
import { isTauri, mousedownTargetElement } from "../utils/isTauri";

/** @typedef {{getCurrentWindow: () => {isFullscreen: () => Promise<boolean>, onResized: (handler: () => void) => Promise<() => void>, startDragging: () => Promise<void>}, invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>, listen: (event: string, handler: (event: {payload?: unknown}) => void) => Promise<() => void>, openUrl: (url: string) => Promise<unknown>}} AppRuntime */

/** @param {{children: import("react").ReactNode, runtime: AppRuntime}} props */
const AppShell = ({ children, runtime }) => {
  useEffect(() => {
    if (!isTauri()) {
      return undefined;
    }
    const onMouseDown = (event) => {
      if (event.button !== 0) {
        return;
      }
      const element = mousedownTargetElement(event.target);
      if (
        !element ||
        element.closest("[data-tauri-no-drag]") ||
        !element.closest("[data-tauri-drag-region]")
      ) {
        return;
      }
      runtime
        .getCurrentWindow()
        .startDragging()
        .catch((error) => {
          console.warn(
            "[Wingosy] startDragging failed — use `tauri dev` (not dev:web), restart after `tauri.conf` changes:",
            error
          );
        });
    };
    document.addEventListener("mousedown", onMouseDown, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [runtime]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <WindowChrome />
      <Box
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default AppShell;
