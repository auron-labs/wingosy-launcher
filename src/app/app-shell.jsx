import Box from "@mui/material/Box";
import { useEffect } from "react";

import WindowChrome from "../components/window-chrome";
import { isTauri, mousedownTargetElement } from "../utils/is-tauri";

/** @typedef {import("./app-runtime").AppRuntime} AppRuntime */

/** @param {AppRuntime} runtime Runtime adapter. */
const startDragging = async (runtime) => {
  try {
    await runtime.getCurrentWindow().startDragging();
  } catch (error) {
    console.warn(
      "[Wingosy] startDragging failed — use `tauri dev` (not dev:web), restart after `tauri.conf` changes:",
      error
    );
  }
};

/** @param {{children: import("react").ReactNode, runtime: AppRuntime}} props Application shell properties. */
const AppShell = ({ children, runtime }) => {
  useEffect(() => {
    /** @param {MouseEvent} event Mouse input. */
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
      void startDragging(runtime);
    };
    if (isTauri()) {
      document.addEventListener("mousedown", onMouseDown, true);
    }
    return () => {
      if (isTauri()) {
        document.removeEventListener("mousedown", onMouseDown, true);
      }
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
