import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useState } from "react";

import { useAppTheme } from "../ThemeContext";
import { isGameDownloaded } from "../utils/gameFilters";
import { platformBadgeLabel } from "../utils/platformIcons";

const PLATFORM_COLORS = {
  // Nintendo
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
  // PlayStation
  psx: "#003087",
  ps2: "#003087",
  ps3: "#003087",
  ps4: "#003087",
  ps5: "#003087",
  psp: "#003087",
  psvita: "#003087",
  // Sega
  genesis: "#1a5c9b",
  saturn: "#0072c6",
  dreamcast: "#f47920",
  // Xbox
  xbox: "#107c10",
  xbox360: "#107c10",
  // Other
  arcade: "#ff6b00",
  pc: "#00ACC1",
};

function isLocalPath(path) {
  if (!path) {
    return false;
  }
  return (
    /^[a-zA-Z]:/.test(path) || path.startsWith("\\") || path.startsWith("/")
  );
}

function getCoverSrc(coverPath) {
  if (!coverPath) {
    return null;
  }
  if (isLocalPath(coverPath)) {
    return convertFileSrc(coverPath);
  }
  return coverPath;
}

export default function GameCard({
  game,
  onClick,
  onToggleFavorite,
  onLaunch,
  downloadProgress,
  launchProgress,
}) {
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { colors } = useAppTheme();
  const platformColor = PLATFORM_COLORS[game.platform_id] || colors.primary;
  const coverSrc = getCoverSrc(game.cover_path);
  const showCover = coverSrc && !imgError;

  const isRemoteOnly =
    game.sync_state === "remote_only" || game.sync_state === "RemoteOnly";
  const hasLocalFile = game.local_file_path && game.local_file_path.length > 0;
  const canPlay =
    hasLocalFile || game.source !== "RomM" || Boolean(game.romm_id);
  const launchActive = Boolean(launchProgress?.active);
  const downloadActive = Boolean(downloadProgress);
  const visibleProgress = launchActive ? launchProgress : downloadProgress;
  const isDownloaded = isGameDownloaded(game);
  const downloadStatusLabel = isDownloaded
    ? "Downloaded"
    : isRemoteOnly
      ? "Cloud only"
      : "Not downloaded";

  const platformSlug = platformBadgeLabel(game.platform_id);

  return (
    <Box
      data-testid="game-card"
      role="button"
      aria-label={game.name}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        onClick();
      }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      sx={{
        aspectRatio: "3 / 4",
        borderRadius: "8px",
        boxShadow: isHovered
          ? `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${colors.focusGlow}`
          : "0 2px 8px rgba(0,0,0,0.3)",
        cursor: "pointer",
        overflow: "visible",
        position: "relative",
        transform: isHovered ? "scale(1.08)" : "scale(1)",
        transition: "transform 0.2s ease, box-shadow 0.25s ease",
        zIndex: isHovered ? 10 : 1,
      }}
      tabIndex={0}
    >
      {/* Main card container with border */}
      <Box
        sx={{
          bgcolor: "background.paper",
          border: isHovered
            ? `2px solid ${colors.primary}`
            : "2px solid transparent",
          borderRadius: "8px",
          height: "100%",
          overflow: "hidden",
          position: "relative",
          transition: "border-color 0.2s ease",
          width: "100%",
        }}
      >
        {/* Cover image or placeholder */}
        {showCover ? (
          <Box
            component="img"
            src={coverSrc}
            alt={game.name}
            loading="lazy"
            decoding="async"
            onError={() => {
              setImgError(true);
            }}
            draggable={false}
            sx={{
              filter: isHovered ? "brightness(1.05)" : "brightness(1)",
              height: "100%",
              objectFit: "cover",
              transition: "filter 0.2s ease",
              width: "100%",
            }}
          />
        ) : (
          <Box
            sx={{
              alignItems: "center",
              bgcolor: `${platformColor}15`,
              display: "flex",
              flexDirection: "column",
              height: "100%",
              justifyContent: "center",
              p: 2,
              width: "100%",
            }}
          >
            <SportsEsportsIcon
              sx={{ color: `${platformColor}66`, fontSize: 48 }}
            />
          </Box>
        )}

        {/* Inner shadow effect (Argosy-style) */}
        <Box
          sx={{
            borderRadius: "6px",
            boxShadow: "inset 0 0 12px rgba(0,0,0,0.4)",
            inset: 0,
            pointerEvents: "none",
            position: "absolute",
          }}
        />

        {/* Download state is always visible so cover art is not the only identifier. */}
        <Box
          sx={{
            alignItems: "center",
            backdropFilter: "blur(8px)",
            bgcolor: "rgba(18,18,18,0.92)",
            border: "1px solid rgba(255,255,255,0.24)",
            borderBottomRightRadius: "8px",
            borderLeft: 0,
            borderTop: 0,
            display: "flex",
            gap: 0.5,
            left: 0,
            position: "absolute",
            px: 1,
            py: 0.5,
            top: 0,
            zIndex: 3,
          }}
        >
          {isDownloaded ? (
            <CheckCircleIcon sx={{ color: "#9BE7A0", fontSize: 17 }} />
          ) : (
            <CloudDownloadIcon sx={{ color: "#FFD180", fontSize: 17 }} />
          )}
          <Typography
            sx={{
              color: "#fff",
              fontSize: "0.8125rem",
              fontWeight: 700,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            {downloadStatusLabel}
          </Typography>
        </Box>

        {/* Platform badge - top right corner */}
        <Box
          sx={{
            backdropFilter: "blur(8px)",
            bgcolor: "rgba(0,0,0,0.78)",
            borderRadius: 1,
            pointerEvents: "none",
            position: "absolute",
            px: 1,
            py: 0.5,
            right: 8,
            top: 8,
            zIndex: 3,
          }}
        >
          <Typography
            sx={{
              color: "#fff",
              fontSize: "0.8125rem",
              fontWeight: 700,
              letterSpacing: "0.03em",
              lineHeight: 1.2,
            }}
          >
            {platformSlug}
          </Typography>
        </Box>

        {visibleProgress ? (
          <Box
            sx={{
              bottom: 0,
              left: 0,
              pointerEvents: "none",
              position: "absolute",
              right: 0,
              zIndex: 6,
            }}
          >
            {visibleProgress.percent == null ? (
              <LinearProgress sx={{ height: 5, borderRadius: 0 }} />
            ) : (
              <LinearProgress
                variant="determinate"
                value={visibleProgress.percent}
                sx={{ height: 5, borderRadius: 0 }}
              />
            )}
          </Box>
        ) : null}

        {/* Persistent title and actions keep the card navigable without hover. */}
        <Box
          sx={{
            background:
              "linear-gradient(transparent 0%, rgba(0,0,0,0.78) 48%, rgba(0,0,0,0.94) 100%)",
            bottom: 0,
            left: 0,
            p: 1.25,
            position: "absolute",
            pt: 5,
            right: 0,
            zIndex: 3,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              color: "#fff",
              display: "-webkit-box",
              fontWeight: 600,
              lineHeight: 1.3,
              mb: 1,
              minHeight: "2.6em",
              overflow: "hidden",
              textAlign: "center",
              textOverflow: "ellipsis",
              textShadow: "0 2px 4px rgba(0,0,0,0.8)",
            }}
            title={game.name}
          >
            {game.name}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ pointerEvents: "auto" }}>
            {canPlay ? (
              <Tooltip title={launchActive ? "Launching…" : "Play game"}>
                <span>
                  <IconButton
                    aria-label={`Play ${game.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunch();
                    }}
                    disabled={launchActive || downloadActive}
                    sx={{
                      "&:hover": {
                        bgcolor: colors.primary,
                        boxShadow: `0 0 16px ${colors.focusGlow}`,
                        color: "#fff",
                      },
                      bgcolor: "rgba(18,18,18,0.92)",
                      border: `1px solid ${colors.primaryLight}`,
                      color: colors.primaryLight,
                      height: 44,
                      width: 44,
                    }}
                  >
                    <PlayArrowIcon />
                  </IconButton>
                </span>
              </Tooltip>
            ) : isRemoteOnly ? (
              <Tooltip title="Open to download">
                <IconButton
                  aria-label={`Download ${game.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                  sx={{
                    bgcolor: "rgba(18,18,18,0.92)",
                    color: "#FFD180",
                    border: "1px solid #FFD180",
                    width: 44,
                    height: 44,
                    "&:hover": { bgcolor: "#8A4B08", color: "#fff" },
                  }}
                >
                  <CloudDownloadIcon />
                </IconButton>
              </Tooltip>
            ) : null}

            <Tooltip
              title={game.is_favorite ? "Remove favorite" : "Add favorite"}
            >
              <IconButton
                aria-label={
                  game.is_favorite
                    ? `Remove ${game.name} from favorites`
                    : `Add ${game.name} to favorites`
                }
                aria-pressed={Boolean(game.is_favorite)}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                sx={{
                  "&:hover": {
                    bgcolor: game.is_favorite
                      ? "#E53935"
                      : "rgba(50,50,50,0.96)",
                  },
                  bgcolor: game.is_favorite
                    ? "rgba(229,57,53,0.92)"
                    : "rgba(18,18,18,0.92)",
                  border: "1px solid rgba(255,255,255,0.7)",
                  color: "#fff",
                  height: 44,
                  width: 44,
                }}
              >
                {game.is_favorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
