import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudIcon from "@mui/icons-material/Cloud";
import FavoriteIcon from "@mui/icons-material/Favorite";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useMemo, useState } from "react";

import { useAppTheme } from "../ThemeContext";
import { platformBadgeLabel } from "../utils/platformIcons";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {{percent?: number|null}|null} TileDownloadProgress */

/**
 * @typedef {Object} ImmersiveGameTileProps
 * @property {ImmersiveGame} game - Game represented by the tile.
 * @property {boolean} focused - Whether keyboard/controller focus is on this tile.
 * @property {() => void} onFocus - Focus callback.
 * @property {() => void} onSelect - Selection callback.
 * @property {TileDownloadProgress} [downloadProgress] - Optional active download progress.
 */

/** @type {Record<string, string>} */
const PLATFORM_COLORS = {
  "3ds": "#d12228",
  arcade: "#ff6b00",
  dreamcast: "#f47920",
  gb: "#8b956d",
  gba: "#6b5a9e",
  gbc: "#8b008b",
  gc: "#6a5acd",
  genesis: "#1a5c9b",
  n64: "#00a651",
  nds: "#b8b8b8",
  nes: "#e60012",
  pc: "#00ACC1",
  ps2: "#003087",
  ps3: "#003087",
  ps4: "#003087",
  ps5: "#003087",
  psp: "#003087",
  psvita: "#003087",
  psx: "#003087",
  saturn: "#0072c6",
  snes: "#7b5aa6",
  switch: "#e60012",
  wii: "#00a4e4",
  wiiu: "#009ac7",
  xbox: "#107c10",
  xbox360: "#107c10",
};

/** @param {string|null|undefined} path - Candidate local path. */
const isLocalPath = (path) => {
  if (path === null || path === undefined || path === "") {
    return false;
  }
  return (
    /^[a-zA-Z]:/u.test(path) || path.startsWith("\\") || path.startsWith("/")
  );
};

/** @param {string|null|undefined} coverPath - Cover path returned by the backend. */
const getCoverSrc = (coverPath) => {
  if (coverPath === null || coverPath === undefined || coverPath === "") {
    return null;
  }
  if (isLocalPath(coverPath)) {
    return convertFileSrc(coverPath);
  }
  return coverPath;
};

/** @param {ImmersiveGameTileProps} props - Tile properties. */
const ImmersiveGameTile = ({
  game,
  focused,
  onFocus,
  onSelect,
  downloadProgress,
}) => {
  const [imgError, setImgError] = useState(false);
  const { colors } = useAppTheme();
  const coverSrc = useMemo(
    () => getCoverSrc(game.cover_path),
    [game.cover_path]
  );
  const showCover = Boolean(coverSrc) && !imgError;
  const platformColor = PLATFORM_COLORS[game.platform_id] ?? colors.primary;
  const platformSlug = platformBadgeLabel(game.platform_id);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const remote = ["remote_only", "RemoteOnly"].includes(game.sync_state ?? "");
  const synced = ["synced", "Synced"].includes(game.sync_state ?? "");

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      onFocus={onFocus}
      data-controller-focused={focused ? "true" : undefined}
      tabIndex={0}
      style={{
        appearance: "none",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        margin: 0,
        padding: 0,
        textAlign: "left",
        width: "100%",
      }}
    >
      <Box
        sx={{
          aspectRatio: "3 / 4",
          borderRadius: "10px",
          boxShadow: focused
            ? `0 12px 32px ${alpha("#000", 0.45)}, 0 0 24px ${colors.focusGlow}`
            : "0 1px 4px rgba(0,0,0,0.25)",
          overflow: "visible",
          position: "relative",
          transform: focused ? "scale(1.05)" : "scale(1)",
          transition: reducedMotion
            ? "none"
            : "transform 0.2s ease, box-shadow 0.2s ease",
          zIndex: focused ? 2 : 1,
        }}
      >
        <Box
          sx={{
            bgcolor: "background.paper",
            borderRadius: "10px",
            height: "100%",
            overflow: "hidden",
            position: "relative",
            width: "100%",
          }}
        >
          {showCover ? (
            <Box
              component="img"
              src={coverSrc}
              alt={game.name}
              onError={() => {
                setImgError(true);
              }}
              draggable={false}
              sx={{
                filter: focused ? "brightness(1.04)" : "brightness(1)",
                height: "100%",
                objectFit: "cover",
                transition: reducedMotion ? "none" : "filter 0.2s ease",
                width: "100%",
              }}
            />
          ) : (
            <Box
              sx={{
                alignItems: "center",
                bgcolor: alpha(platformColor, 0.12),
                display: "flex",
                flexDirection: "column",
                height: "100%",
                justifyContent: "center",
                p: 2,
                width: "100%",
              }}
            >
              <SportsEsportsIcon
                sx={{ color: alpha(platformColor, 0.5), fontSize: 40, mb: 1 }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  fontSize: { md: "1rem", sm: "0.95rem", xs: "0.9rem" },
                  lineHeight: 1.25,
                  maxHeight: "2.5em",
                  overflow: "hidden",
                  px: 0.5,
                  textAlign: "center",
                }}
              >
                {game.name}
              </Typography>
            </Box>
          )}

          <Box
            sx={{
              borderRadius: "10px",
              boxShadow: focused
                ? "inset 0 0 0 1px rgba(255,255,255,0.12)"
                : "inset 0 0 12px rgba(0,0,0,0.35)",
              inset: 0,
              pointerEvents: "none",
              position: "absolute",
            }}
          />

          {platformSlug ? (
            <Box
              sx={{
                bgcolor: alpha("#000", 0.7),
                borderBottomRightRadius: "8px",
                left: 0,
                minWidth: 24,
                position: "absolute",
                px: 1,
                py: 0.4,
                top: 0,
              }}
            >
              <Typography
                sx={{
                  color: "#fff",
                  fontSize: { sm: "0.85rem", xs: "0.8rem" },
                  fontWeight: 700,
                  letterSpacing: "0.4px",
                  textAlign: "center",
                }}
              >
                {platformSlug}
              </Typography>
            </Box>
          ) : null}

          <Box
            sx={{
              display: "flex",
              gap: 0.75,
              pointerEvents: "none",
              position: "absolute",
              right: 8,
              top: 8,
            }}
          >
            {game.is_favorite === true ? (
              <Box
                sx={{
                  alignItems: "center",
                  bgcolor: alpha("#000", 0.55),
                  borderRadius: "50%",
                  display: "flex",
                  height: 20,
                  justifyContent: "center",
                  width: 20,
                }}
              >
                <FavoriteIcon sx={{ color: "#fff", fontSize: 11 }} />
              </Box>
            ) : null}
            {remote ? (
              <Box
                sx={{
                  alignItems: "center",
                  bgcolor: alpha("#000", 0.55),
                  borderRadius: "50%",
                  display: "flex",
                  height: 20,
                  justifyContent: "center",
                  width: 20,
                }}
              >
                <CloudIcon sx={{ color: colors.primaryLight, fontSize: 11 }} />
              </Box>
            ) : null}
            {synced ? (
              <Box
                sx={{
                  alignItems: "center",
                  bgcolor: alpha("#000", 0.55),
                  borderRadius: "50%",
                  display: "flex",
                  height: 20,
                  justifyContent: "center",
                  width: 20,
                }}
              >
                <CheckCircleIcon sx={{ color: "#66BB6A", fontSize: 11 }} />
              </Box>
            ) : null}
          </Box>

          {downloadProgress ? (
            <Box
              sx={{
                bottom: 0,
                left: 0,
                pointerEvents: "none",
                position: "absolute",
                right: 0,
                zIndex: 5,
              }}
            >
              {downloadProgress.percent === null ||
              downloadProgress.percent === undefined ? (
                <LinearProgress sx={{ height: 4, borderRadius: 0 }} />
              ) : (
                <LinearProgress
                  variant="determinate"
                  value={downloadProgress.percent}
                  sx={{ height: 4, borderRadius: 0 }}
                />
              )}
            </Box>
          ) : null}

          {showCover ? (
            <Box
              sx={{
                background:
                  "linear-gradient(transparent 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.88) 100%)",
                bottom: 0,
                left: 0,
                p: { sm: 1.5, xs: 1.25 },
                position: "absolute",
                pt: 4,
                right: 0,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  color: "#fff",
                  display: "-webkit-box",
                  fontSize: { md: "1.05rem", sm: "1rem", xs: "0.95rem" },
                  fontWeight: 700,
                  lineHeight: 1.25,
                  overflow: "hidden",
                  textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                }}
                title={game.name}
              >
                {game.name}
              </Typography>
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
};

export default ImmersiveGameTile;
