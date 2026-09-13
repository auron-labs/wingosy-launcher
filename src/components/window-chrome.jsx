import CloseIcon from "@mui/icons-material/Close";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import RemoveIcon from "@mui/icons-material/Remove";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import { alpha, useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";

import {
  isTauri,
  tauriDragRegionProps,
  tauriDragRegionSx,
  tauriNoDragProps,
  tauriNoDragSx,
} from "../utils/is-tauri";

const appWindow = isTauri() ? getCurrentWindow() : null;

const CHROME_HEIGHT = 40;

/** @param {() => Promise<void>} action Window operation. */
const runWindowAction = async (action) => {
  try {
    await action();
  } catch {
    // Window controls are unavailable while the native window is closing.
  }
};

/** @param {{windowHandle: ReturnType<typeof getCurrentWindow>, theme: import("@mui/material/styles").Theme}} props Window control dependencies. */
const WindowControls = ({ windowHandle, theme }) => (
  <Box
    {...tauriNoDragProps()}
    sx={{
      alignItems: "center",
      display: "flex",
      flexShrink: 0,
      ...tauriNoDragSx,
    }}
  >
    <Tooltip title="Minimize">
      <IconButton
        {...tauriNoDragProps()}
        size="small"
        onClick={() => {
          void runWindowAction(async () => {
            await windowHandle.minimize();
          });
        }}
        aria-label="Minimize"
        sx={{ borderRadius: 1, color: "text.secondary", ...tauriNoDragSx }}
      >
        <RemoveIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
    <Tooltip title="Maximize">
      <IconButton
        {...tauriNoDragProps()}
        size="small"
        onClick={() => {
          void runWindowAction(async () => {
            await windowHandle.toggleMaximize();
          });
        }}
        aria-label="Maximize"
        sx={{ borderRadius: 1, color: "text.secondary", ...tauriNoDragSx }}
      >
        <CropSquareIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
    <Tooltip title="Close">
      <IconButton
        {...tauriNoDragProps()}
        size="small"
        onClick={() => {
          void runWindowAction(async () => {
            await windowHandle.close();
          });
        }}
        aria-label="Close"
        sx={{
          borderRadius: 1,
          color: "text.secondary",
          ...tauriNoDragSx,
          "&:hover": {
            bgcolor: alpha(theme.palette.error.main, 0.12),
            color: "error.main",
          },
        }}
      >
        <CloseIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  </Box>
);

/** @param {() => Promise<void>} syncFullscreen Synchronize fullscreen state. */
const useWindowResizeListener = (syncFullscreen) => {
  useEffect(() => {
    /** @type {(() => void)|undefined} */
    let unlistenResize;
    let cancelled = false;

    if (isTauri() && appWindow !== null) {
      void (async () => {
        await syncFullscreen();
        try {
          unlistenResize = await appWindow.onResized(() => {
            if (!cancelled) {
              void syncFullscreen();
            }
          });
        } catch {
          // ignore
        }
      })();
    }

    return () => {
      cancelled = true;
      unlistenResize?.();
    };
  }, [syncFullscreen]);
};

/**
 * Frameless-window top bar: drag region + window controls (Tauri only).
 * Hidden while OS fullscreen so content can use the full display.
 */
const WindowChrome = () => {
  const theme = useTheme();
  const [fullscreen, setFullscreen] = useState(false);

  const syncFullscreen = useCallback(async () => {
    if (!isTauri()) {
      return;
    }
    if (!appWindow) {
      return;
    }
    try {
      setFullscreen(await appWindow.isFullscreen());
    } catch {
      // web preview / tests
    }
  }, []);

  useWindowResizeListener(syncFullscreen);

  if (!isTauri() || appWindow === null || fullscreen) {
    return null;
  }

  // Same surface as the app body so the drag strip reads as part of the UI, not a separate bar.
  const chromeBg = theme.palette.background.default;

  return (
    <Box
      data-testid="window-chrome"
      {...tauriDragRegionProps()}
      sx={{
        alignItems: "center",
        bgcolor: chromeBg,
        display: "flex",
        flexShrink: 0,
        height: CHROME_HEIGHT,
        pl: 1.25,
        pr: 0.25,
        ...tauriDragRegionSx,
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          cursor: "default",
          display: "flex",
          flex: 1,
          height: "100%",
          minWidth: 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontWeight: 600,
            letterSpacing: "0.06em",
            ml: 0.5,
            userSelect: "none",
          }}
        >
          Wingosy Launcher
        </Typography>
      </Box>
      <WindowControls windowHandle={appWindow} theme={theme} />
    </Box>
  );
};

export default WindowChrome;
