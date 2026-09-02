import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import useMediaQuery from "@mui/material/useMediaQuery";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CloudIcon from "@mui/icons-material/Cloud";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { alpha } from "@mui/material/styles";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAppTheme } from "../ThemeContext";
import { platformBadgeLabel } from "../utils/platformIcons";

const PLATFORM_COLORS = {
  nes: "#e60012",
  snes: "#7b5aa6",
  n64: "#00a651",
  gc: "#6a5acd",
  wii: "#00a4e4",
  wiiu: "#009ac7",
  switch: "#e60012",
  gb: "#8b956d",
  gbc: "#8b008b",
  gba: "#6b5a9e",
  nds: "#b8b8b8",
  "3ds": "#d12228",
  psx: "#003087",
  ps2: "#003087",
  ps3: "#003087",
  ps4: "#003087",
  ps5: "#003087",
  psp: "#003087",
  psvita: "#003087",
  genesis: "#1a5c9b",
  saturn: "#0072c6",
  dreamcast: "#f47920",
  xbox: "#107c10",
  xbox360: "#107c10",
  arcade: "#ff6b00",
  pc: "#00ACC1",
};

function isLocalPath(path) {
  if (!path) return false;
  return /^[a-zA-Z]:/.test(path) || path.startsWith("\\") || path.startsWith("/");
}

function getCoverSrc(coverPath) {
  if (!coverPath) return null;
  if (isLocalPath(coverPath)) return convertFileSrc(coverPath);
  return coverPath;
}

export default function ImmersiveGameTile({
  game,
  focused,
  onFocus,
  onSelect,
  downloadProgress,
}) {
  const [imgError, setImgError] = useState(false);
  const { colors } = useAppTheme();
  const coverSrc = useMemo(() => getCoverSrc(game.cover_path), [game.cover_path]);
  const showCover = Boolean(coverSrc) && !imgError;
  const platformColor = PLATFORM_COLORS[game.platform_id] || colors.primary;
  const platformSlug = platformBadgeLabel(game.platform_id);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const remote = game.sync_state === "remote_only" || game.sync_state === "RemoteOnly";
  const synced = game.sync_state === "synced" || game.sync_state === "Synced";

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
        border: "none",
        padding: 0,
        margin: 0,
        background: "transparent",
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <Box
        sx={{
          position: "relative",
          aspectRatio: "3 / 4",
          borderRadius: "10px",
          overflow: "visible",
          transition: reducedMotion
            ? "none"
            : "transform 0.2s ease, box-shadow 0.2s ease",
          transform: focused ? "scale(1.05)" : "scale(1)",
          boxShadow: focused
            ? `0 12px 32px ${alpha("#000", 0.45)}, 0 0 24px ${colors.focusGlow}`
            : "0 1px 4px rgba(0,0,0,0.25)",
          zIndex: focused ? 2 : 1,
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "10px",
            overflow: "hidden",
            bgcolor: "background.paper",
          }}
        >
          {showCover ? (
            <Box
              component="img"
              src={coverSrc}
              alt={game.name}
              onError={() => setImgError(true)}
              draggable={false}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: focused ? "brightness(1.04)" : "brightness(1)",
                transition: reducedMotion ? "none" : "filter 0.2s ease",
              }}
            />
          ) : (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: alpha(platformColor, 0.12),
                p: 2,
              }}
            >
              <SportsEsportsIcon
                sx={{ fontSize: 40, color: alpha(platformColor, 0.5), mb: 1 }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  textAlign: "center",
                  fontSize: { xs: "0.9rem", sm: "0.95rem", md: "1rem" },
                  lineHeight: 1.25,
                  maxHeight: "2.5em",
                  overflow: "hidden",
                  px: 0.5,
                }}
              >
                {game.name}
              </Typography>
            </Box>
          )}

          <Box
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              boxShadow: focused
                ? "inset 0 0 0 1px rgba(255,255,255,0.12)"
                : "inset 0 0 12px rgba(0,0,0,0.35)",
              borderRadius: "10px",
            }}
          />

          {platformSlug ? (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                bgcolor: alpha("#000", 0.7),
                px: 1,
                py: 0.4,
                borderBottomRightRadius: "8px",
                minWidth: 24,
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: "0.8rem", sm: "0.85rem" },
                  fontWeight: 700,
                  color: "#fff",
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
              position: "absolute",
              top: 8,
              right: 8,
              display: "flex",
              gap: 0.75,
              pointerEvents: "none",
            }}
          >
            {game.is_favorite ? (
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  bgcolor: alpha("#000", 0.55),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FavoriteIcon sx={{ fontSize: 11, color: "#fff" }} />
              </Box>
            ) : null}
            {remote ? (
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  bgcolor: alpha("#000", 0.55),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CloudIcon sx={{ fontSize: 11, color: colors.primaryLight }} />
              </Box>
            ) : null}
            {synced ? (
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  bgcolor: alpha("#000", 0.55),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 11, color: "#66BB6A" }} />
              </Box>
            ) : null}
          </Box>

          {downloadProgress ? (
            <Box
              sx={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 5,
                pointerEvents: "none",
              }}
            >
              {downloadProgress.percent != null ? (
                <LinearProgress
                  variant="determinate"
                  value={downloadProgress.percent}
                  sx={{ height: 4, borderRadius: 0 }}
                />
              ) : (
                <LinearProgress sx={{ height: 4, borderRadius: 0 }} />
              )}
            </Box>
          ) : null}

          {showCover ? (
            <Box
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                p: { xs: 1.25, sm: 1.5 },
                pt: 4,
                background:
                  "linear-gradient(transparent 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.88) 100%)",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: "#fff",
                  textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                  lineHeight: 1.25,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  fontSize: { xs: "0.95rem", sm: "1rem", md: "1.05rem" },
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
}
