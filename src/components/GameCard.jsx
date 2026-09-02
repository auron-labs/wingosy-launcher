import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useAppTheme } from "../ThemeContext";
import { platformBadgeLabel } from "../utils/platformIcons";
import { isGameDownloaded } from "../utils/gameFilters";

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
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onClick();
      }}
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
            loading="lazy"
            decoding="async"
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
            <SportsEsportsIcon sx={{ fontSize: 48, color: `${platformColor}66` }} />
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

        {/* Download state is always visible so cover art is not the only identifier. */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 3,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            bgcolor: "rgba(18,18,18,0.92)",
            backdropFilter: "blur(8px)",
            px: 1,
            py: 0.5,
            borderBottomRightRadius: "8px",
            border: "1px solid rgba(255,255,255,0.24)",
            borderTop: 0,
            borderLeft: 0,
          }}
        >
          {isDownloaded ? (
            <CheckCircleIcon sx={{ fontSize: 17, color: "#9BE7A0" }} />
          ) : (
            <CloudDownloadIcon sx={{ fontSize: 17, color: "#FFD180" }} />
          )}
          <Typography
            sx={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "#fff",
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
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 3,
            bgcolor: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(8px)",
            px: 1,
            py: 0.5,
            borderRadius: 1,
            pointerEvents: "none",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.2,
              letterSpacing: "0.03em",
            }}
          >
            {platformSlug}
          </Typography>
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

        {/* Persistent title and actions keep the card navigable without hover. */}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 3,
            p: 1.25,
            pt: 5,
            background: "linear-gradient(transparent 0%, rgba(0,0,0,0.78) 48%, rgba(0,0,0,0.94) 100%)",
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: "#fff",
              fontWeight: 600,
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              textShadow: "0 2px 4px rgba(0,0,0,0.8)",
              lineHeight: 1.3,
              minHeight: "2.6em",
              mb: 1,
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
                      bgcolor: "rgba(18,18,18,0.92)",
                      color: colors.primaryLight,
                      border: `1px solid ${colors.primaryLight}`,
                      width: 44,
                      height: 44,
                      "&:hover": {
                        bgcolor: colors.primary,
                        color: "#fff",
                        boxShadow: `0 0 16px ${colors.focusGlow}`,
                      },
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

            <Tooltip title={game.is_favorite ? "Remove favorite" : "Add favorite"}>
              <IconButton
                aria-label={game.is_favorite ? `Remove ${game.name} from favorites` : `Add ${game.name} to favorites`}
                aria-pressed={Boolean(game.is_favorite)}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                sx={{
                  bgcolor: game.is_favorite ? "rgba(229,57,53,0.92)" : "rgba(18,18,18,0.92)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.7)",
                  width: 44,
                  height: 44,
                  "&:hover": {
                    bgcolor: game.is_favorite ? "#E53935" : "rgba(50,50,50,0.96)",
                  },
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
