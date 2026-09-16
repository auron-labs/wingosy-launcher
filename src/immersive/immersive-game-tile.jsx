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

import { useAppTheme } from "../theme-context";
import { platformBadgeLabel } from "../utils/platform-icons";

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

/** @param {string|null|undefined} path Candidate local path. */
const isLocalPath = (path) => {
  if (path === null || path === undefined || path === "") {
    return false;
  }
  return (
    /^[a-zA-Z]:/u.test(path) || path.startsWith("\\") || path.startsWith("/")
  );
};

/** @param {string|null|undefined} coverPath Cover path returned by the backend. */
const getCoverSrc = (coverPath) => {
  if (coverPath === null || coverPath === undefined || coverPath === "") {
    return null;
  }
  return isLocalPath(coverPath) ? convertFileSrc(coverPath) : coverPath;
};

/** @param {{game: ImmersiveGame, platformColor: string}} props Placeholder properties. */
const TilePlaceholder = ({ game, platformColor }) => (
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
);

/** @param {{children: import("react").ReactNode, visible: boolean}} props Status badge properties. */
const StatusBadge = ({ children, visible }) =>
  visible ? (
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
      {children}
    </Box>
  ) : null;

/** @param {{game: ImmersiveGame, colors: Record<string, string>, platformSlug: string|null, remote: boolean, synced: boolean}} props Tile status properties. */
const TileStatusBadges = ({ colors, game, platformSlug, remote, synced }) => (
  <>
    {platformSlug !== null && platformSlug !== "" ? (
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
      <StatusBadge visible={game.is_favorite === true}>
        <FavoriteIcon sx={{ color: "#fff", fontSize: 11 }} />
      </StatusBadge>
      <StatusBadge visible={remote}>
        <CloudIcon sx={{ color: colors.primaryLight, fontSize: 11 }} />
      </StatusBadge>
      <StatusBadge visible={synced}>
        <CheckCircleIcon sx={{ color: "#66BB6A", fontSize: 11 }} />
      </StatusBadge>
    </Box>
  </>
);

/** @param {{downloadProgress: TileDownloadProgress}} props Tile progress properties. */
const TileProgress = ({ downloadProgress }) =>
  downloadProgress ? (
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
      <LinearProgress
        variant={
          downloadProgress.percent === null ||
          downloadProgress.percent === undefined
            ? "indeterminate"
            : "determinate"
        }
        value={downloadProgress.percent ?? undefined}
        sx={{ borderRadius: 0, height: 4 }}
      />
    </Box>
  ) : null;

/** @param {{game: ImmersiveGame, focused: boolean, reducedMotion: boolean}} props Tile title properties. */
const TileTitle = ({ focused, game, reducedMotion }) => (
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
        filter: focused ? "brightness(1.04)" : "brightness(1)",
        fontSize: { md: "1.05rem", sm: "1rem", xs: "0.95rem" },
        fontWeight: 700,
        lineHeight: 1.25,
        overflow: "hidden",
        textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        transition: reducedMotion ? "none" : "filter 0.2s ease",
      }}
      title={game.name}
    >
      {game.name}
    </Typography>
  </Box>
);

/** @param {{colors: Record<string, string>, coverSrc: string|null, downloadProgress: TileDownloadProgress, focused: boolean, game: ImmersiveGame, imgError: boolean, onImageError: () => void, platformColor: string, platformSlug: string|null, reducedMotion: boolean, remote: boolean, synced: boolean}} props Tile artwork properties. */
const TileSurface = ({
  colors,
  coverSrc,
  downloadProgress,
  focused,
  game,
  imgError,
  onImageError,
  platformColor,
  platformSlug,
  reducedMotion,
  remote,
  synced,
}) => {
  const showCover = coverSrc !== null && !imgError;
  return (
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
          alt={game.name}
          component="img"
          draggable={false}
          onError={onImageError}
          src={coverSrc}
          sx={{
            filter: focused ? "brightness(1.04)" : "brightness(1)",
            height: "100%",
            objectFit: "cover",
            transition: reducedMotion ? "none" : "filter 0.2s ease",
            width: "100%",
          }}
        />
      ) : (
        <TilePlaceholder game={game} platformColor={platformColor} />
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
      <TileStatusBadges
        colors={colors}
        game={game}
        platformSlug={platformSlug}
        remote={remote}
        synced={synced}
      />
      <TileProgress downloadProgress={downloadProgress} />
      {showCover ? (
        <TileTitle
          focused={focused}
          game={game}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </Box>
  );
};

/** @param {import("react").ComponentProps<typeof TileSurface>} props Tile artwork properties. */
const TileArtwork = (props) => (
  <Box
    sx={{
      aspectRatio: "3 / 4",
      borderRadius: "10px",
      boxShadow: props.focused
        ? `0 12px 32px ${alpha("#000", 0.45)}, 0 0 24px ${props.colors.focusGlow}`
        : "0 1px 4px rgba(0,0,0,0.25)",
      overflow: "visible",
      position: "relative",
      transform: props.focused ? "scale(1.05)" : "scale(1)",
      transition: props.reducedMotion
        ? "none"
        : "transform 0.2s ease, box-shadow 0.2s ease",
      zIndex: props.focused ? 2 : 1,
    }}
  >
    <TileSurface {...props} />
  </Box>
);

/** @param {ImmersiveGameTileProps} props Tile properties. */
const ImmersiveGameTile = ({
  downloadProgress = null,
  focused,
  game,
  onFocus,
  onSelect,
}) => {
  const [imgError, setImgError] = useState(false);
  const { colors } = useAppTheme();
  const coverSrc = useMemo(
    () => getCoverSrc(game.cover_path),
    [game.cover_path]
  );
  const platformColor = PLATFORM_COLORS[game.platform_id] ?? colors.primary;
  const platformSlug = platformBadgeLabel(game.platform_id);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const remote =
    game.sync_state === "remote_only" || game.sync_state === "RemoteOnly";
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
        background: "transparent",
        border: "none",
        cursor: "pointer",
        margin: 0,
        padding: 0,
        textAlign: "left",
        width: "100%",
      }}
    >
      <TileArtwork
        colors={colors}
        coverSrc={coverSrc}
        downloadProgress={downloadProgress}
        focused={focused}
        game={game}
        imgError={imgError}
        onImageError={() => {
          setImgError(true);
        }}
        platformColor={platformColor}
        platformSlug={platformSlug}
        reducedMotion={reducedMotion}
        remote={remote}
        synced={synced}
      />
    </Box>
  );
};

export default ImmersiveGameTile;