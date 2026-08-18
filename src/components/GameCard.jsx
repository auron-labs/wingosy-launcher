import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import IconButton from "@mui/material/IconButton";
import FavoriteIcon from "@mui/icons-material/Favorite";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import CloudIcon from "@mui/icons-material/Cloud";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAppTheme } from "../ThemeContext";
import { platformBadgeLabel } from "../utils/platformIcons";

const PLATFORM_COLORS = {
  // Nintendo
  nes: "#e60012", snes: "#7b5aa6", n64: "#00a651", gc: "#6a5acd",
  wii: "#00a4e4", wiiu: "#009ac7", switch: "#e60012",
  gb: "#8b956d", gbc: "#8b008b", gba: "#6b5a9e",
  nds: "#b8b8b8", "3ds": "#d12228",
  // PlayStation
  psx: "#003087", ps2: "#003087", ps3: "#003087", ps4: "#003087", ps5: "#003087",
  psp: "#003087", psvita: "#003087",
  // Sega
  genesis: "#1a5c9b", saturn: "#0072c6", dreamcast: "#f47920",
  // Xbox
  xbox: "#107c10", xbox360: "#107c10",
  // Other
  arcade: "#ff6b00", pc: "#00ACC1",
};

function isLocalPath(path) {
  if (!path) return false;
  return /^[a-zA-Z]:/.test(path) || path.startsWith("\\") || path.startsWith("/");
}

function getCoverSrc(coverPath) {
  if (!coverPath) return null;
  if (isLocalPath(coverPath)) {
    return convertFileSrc(coverPath);
  }
  return coverPath;
}

export default function GameCard({ game, onClick, onToggleFavorite, onLaunch, downloadProgress, launchProgress }) {
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { colors } = useAppTheme();
  const platformColor = PLATFORM_COLORS[game.platform_id] || colors.primary;
  const coverSrc = getCoverSrc(game.cover_path);
  const showCover = coverSrc && !imgError;

  const isRemoteOnly = game.sync_state === "remote_only" || game.sync_state === "RemoteOnly";
  const hasLocalFile = game.local_file_path && game.local_file_path.length > 0;
  const canPlay = hasLocalFile || game.source !== "RomM" || Boolean(game.romm_id);
  const launchActive = Boolean(launchProgress?.active);
  const downloadActive = Boolean(downloadProgress);
  const visibleProgress = launchActive ? launchProgress : downloadProgress;

  const platformSlug = platformBadgeLabel(game.platform_id);

  return (
    <Box
      role="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: "relative",
        aspectRatio: "3 / 4",
        borderRadius: "8px",
        overflow: "visible",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.25s ease",
        transform: isHovered ? "scale(1.08)" : "scale(1)",
        boxShadow: isHovered
          ? `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${colors.focusGlow}`
          : "0 2px 8px rgba(0,0,0,0.3)",
        zIndex: isHovered ? 10 : 1,
        "&:focus-visible": {
          outline: `2px solid ${colors.primary}`,
          outlineOffset: 2,
        },
      }}
      tabIndex={0}
    >
      {/* Main card container with border */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "8px",
          overflow: "hidden",
          border: isHovered ? `2px solid ${colors.primary}` : "2px solid transparent",
          transition: "border-color 0.2s ease",
          bgcolor: "background.paper",
        }}
      >
        {/* Cover image or placeholder */}
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
              transition: "filter 0.2s ease",
              filter: isHovered ? "brightness(1.05)" : "brightness(1)",
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
              bgcolor: `${platformColor}15`,
              p: 2,
            }}
          >
            <SportsEsportsIcon sx={{ fontSize: 48, color: `${platformColor}66`, mb: 1 }} />
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                textAlign: "center",
                fontSize: "0.7rem",
                lineHeight: 1.2,
                maxHeight: "2.4em",
                overflow: "hidden",
                px: 1,
              }}
            >
              {game.name}
            </Typography>
          </Box>
        )}

        {/* Inner shadow effect (Argosy-style) */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            boxShadow: "inset 0 0 12px rgba(0,0,0,0.4)",
            borderRadius: "6px",
          }}
        />

        {/* Platform badge - top left corner (Argosy-style) */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            bgcolor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            px: 1,
            py: 0.4,
            borderBottomRightRadius: "8px",
            minWidth: 32,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.6rem",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "0.5px",
              textAlign: "center",
            }}
          >
            {platformSlug}
          </Typography>
        </Box>

        {/* Status badges - bottom row */}
        <Box
          sx={{
            position: "absolute",
            bottom: 6,
            left: 6,
            right: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          {/* Favorite badge */}
          {game.is_favorite && (
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                bgcolor: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FavoriteIcon sx={{ fontSize: 12, color: "#fff" }} />
            </Box>
          )}
          <Box sx={{ flex: 1 }} />

          {/* Sync state badge */}
          {game.sync_state === "remote_only" && (
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                bgcolor: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CloudIcon sx={{ fontSize: 12, color: colors.primaryLight }} />
            </Box>
          )}
          {game.sync_state === "synced" && (
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                bgcolor: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 12, color: "#66BB6A" }} />
            </Box>
          )}
        </Box>

        {visibleProgress ? (
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 6,
              pointerEvents: "none",
            }}
          >
            {visibleProgress.percent != null ? (
              <LinearProgress
                variant="determinate"
                value={visibleProgress.percent}
                sx={{ height: 5, borderRadius: 0 }}
              />
            ) : (
              <LinearProgress sx={{ height: 5, borderRadius: 0 }} />
            )}
          </Box>
        ) : null}

        {/* Hover overlay with actions */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.5)",
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.2s ease",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            pointerEvents: isHovered ? "auto" : "none",
          }}
        >
          {/* Game title on hover */}
          <Typography
            variant="body2"
            sx={{
              color: "#fff",
              fontWeight: 600,
              textAlign: "center",
              px: 1.5,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              textShadow: "0 2px 4px rgba(0,0,0,0.8)",
              mb: 1,
            }}
          >
            {game.name}
          </Typography>

          {/* Action buttons */}
          <Box sx={{ display: "flex", gap: 1 }}>
            {canPlay ? (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onLaunch();
                }}
                disabled={launchActive || downloadActive}
                sx={{
                  bgcolor: colors.primary,
                  color: "#fff",
                  width: 40,
                  height: 40,
                  "&:hover": {
                    bgcolor: colors.primaryLight,
                    boxShadow: `0 0 16px ${colors.focusGlow}`,
                  },
                }}
              >
                <PlayArrowIcon />
              </IconButton>
            ) : isRemoteOnly ? (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                sx={{
                  bgcolor: "#FF7043",
                  color: "#fff",
                  width: 40,
                  height: 40,
                  "&:hover": { bgcolor: "#FFAB91" },
                }}
              >
                <CloudDownloadIcon />
              </IconButton>
            ) : null}

            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              sx={{
                bgcolor: game.is_favorite ? "#E53935" : "rgba(255,255,255,0.15)",
                color: "#fff",
                width: 40,
                height: 40,
                "&:hover": {
                  bgcolor: game.is_favorite ? "#E53935" : "rgba(255,255,255,0.25)",
                },
              }}
            >
              <FavoriteIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
