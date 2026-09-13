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

import { useAppTheme } from "../theme-context";
import { isGameDownloaded } from "../utils/game-filters";
import { PLATFORM_COLORS, platformBadgeLabel } from "../utils/platform-icons";

/** @typedef {{id: number|string, platform_id: string, name: string, source?: string|null, romm_id?: number|null, cover_path?: string|null, sync_state?: string|null, local_file_path?: string|null, is_favorite?: boolean}} GameCardGame */
/** @typedef {import("./game/game-details-types").GameDetailsProgress} GameCardProgress */
/** @typedef {{game: GameCardGame, onClick: () => void, onToggleFavorite: () => void, onLaunch: () => void, downloadProgress?: GameCardProgress|null, launchProgress?: GameCardProgress|null}} GameCardProps */
/** @typedef {Record<string, string>} GameCardColors */

/** @param {string|null|undefined} path Candidate filesystem path. */
const isLocalPath = (path) => {
  if (path === null || path === undefined || path === "") {
    return false;
  }
  return (
    /^[a-zA-Z]:/u.test(path) || path.startsWith("\\") || path.startsWith("/")
  );
};

/** @param {string|null|undefined} coverPath Candidate cover path. */
const getCoverSrc = (coverPath) => {
  if (coverPath === null || coverPath === undefined || coverPath === "") {
    return null;
  }
  return isLocalPath(coverPath) ? convertFileSrc(coverPath) : coverPath;
};

/** @param {{game: GameCardGame, coverSrc: string|null, showCover: boolean, platformColor: string, setImgError: (value: boolean) => void}} props Cover properties. */
const CardCover = ({
  coverSrc,
  game,
  platformColor,
  setImgError,
  showCover,
}) => {
  if (showCover) {
    return (
      <Box
        component="img"
        src={coverSrc ?? ""}
        alt={game.name}
        loading="lazy"
        decoding="async"
        onError={() => {
          setImgError(true);
        }}
        draggable={false}
        sx={{ height: "100%", objectFit: "cover", width: "100%" }}
      />
    );
  }
  return (
    <Box
      sx={{
        alignItems: "center",
        bgcolor: `${platformColor}15`,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <SportsEsportsIcon sx={{ color: `${platformColor}66`, fontSize: 48 }} />
    </Box>
  );
};

/** @param {{isDownloaded: boolean, statusLabel: string, platformSlug: string|null}} props Status properties. */
const CardStatus = ({ isDownloaded, platformSlug, statusLabel }) => (
  <Box
    sx={{
      alignItems: "center",
      bgcolor: "rgba(18,18,18,0.92)",
      border: "1px solid rgba(255,255,255,0.24)",
      borderBottomRightRadius: "8px",
      display: "flex",
      gap: 0.5,
      left: 0,
      pointerEvents: "none",
      position: "absolute",
      px: 1,
      py: 0.5,
      top: 0,
      zIndex: 3,
    }}
  >
    {isDownloaded ? (
      <CheckCircleIcon sx={{ color: "#9BE7A0" }} />
    ) : (
      <CloudDownloadIcon sx={{ color: "#FFD180" }} />
    )}
    <Typography sx={{ color: "#fff", fontSize: "0.8125rem", fontWeight: 700 }}>
      {statusLabel}
    </Typography>
    {platformSlug !== null && platformSlug !== "" && (
      <Typography
        component="span"
        sx={{
          bgcolor: "rgba(0,0,0,0.78)",
          borderRadius: 1,
          color: "#fff",
          fontSize: "0.8125rem",
          fontWeight: 700,
          left: "calc(100% + 8px)",
          position: "absolute",
          px: 1,
          py: 0.5,
          top: 0,
        }}
      >
        {platformSlug}
      </Typography>
    )}
  </Box>
);

/** @param {{progress: GameCardProgress|null|undefined}} props Progress properties. */
const CardProgress = ({ progress }) => {
  if (progress === null || progress === undefined) {
    return null;
  }
  const determinate =
    progress.percent !== null && progress.percent !== undefined;
  const value = determinate ? progress.percent : undefined;
  return (
    <LinearProgress
      variant={determinate ? "determinate" : "indeterminate"}
      value={value ?? undefined}
      sx={{
        bottom: 0,
        height: 5,
        left: 0,
        pointerEvents: "none",
        position: "absolute",
        right: 0,
        zIndex: 6,
      }}
    />
  );
};

/** @param {{game: GameCardGame, canPlay: boolean, launchActive: boolean, downloadActive: boolean, colors: GameCardColors, onClick: () => void, onLaunch: () => void}} props Primary action properties. */
const PrimaryCardAction = ({
  canPlay,
  colors,
  downloadActive,
  game,
  launchActive,
  onClick,
  onLaunch,
}) => {
  if (canPlay) {
    return (
      <Tooltip title={launchActive ? "Launching…" : "Play game"}>
        <span>
          <IconButton
            aria-label={`Play ${game.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onLaunch();
            }}
            disabled={launchActive || downloadActive}
            sx={{
              bgcolor: "rgba(18,18,18,0.92)",
              color: colors.primaryLight,
              height: 44,
              width: 44,
            }}
          >
            <PlayArrowIcon />
          </IconButton>
        </span>
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Open to download">
      <IconButton
        aria-label={`Download ${game.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        sx={{
          bgcolor: "rgba(18,18,18,0.92)",
          color: "#FFD180",
          height: 44,
          width: 44,
        }}
      >
        <CloudDownloadIcon />
      </IconButton>
    </Tooltip>
  );
};

/** @param {{game: GameCardGame, onToggleFavorite: () => void}} props Favorite action properties. */
const FavoriteCardAction = ({ game, onToggleFavorite }) => {
  const favorite = game.is_favorite === true;
  return (
    <Tooltip title={favorite ? "Remove favorite" : "Add favorite"}>
      <IconButton
        aria-label={
          favorite
            ? `Remove ${game.name} from favorites`
            : `Add ${game.name} to favorites`
        }
        aria-pressed={favorite}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        sx={{
          bgcolor: favorite ? "rgba(229,57,53,0.92)" : "rgba(18,18,18,0.92)",
          color: "#fff",
          height: 44,
          width: 44,
        }}
      >
        {favorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
      </IconButton>
    </Tooltip>
  );
};

/** @param {{game: GameCardGame, canPlay: boolean, launchActive: boolean, downloadActive: boolean, colors: GameCardColors, onClick: () => void, onLaunch: () => void, onToggleFavorite: () => void}} props Action properties. */
const CardActions = (props) => (
  <Stack direction="row" spacing={1} sx={{ pointerEvents: "auto" }}>
    <PrimaryCardAction {...props} />
    <FavoriteCardAction
      game={props.game}
      onToggleFavorite={props.onToggleFavorite}
    />
  </Stack>
);

/** @param {boolean} downloaded Whether the game is local. @param {boolean} remoteOnly Whether the game is remote only. @returns {string} Status label. */
const getStatusLabel = (downloaded, remoteOnly) => {
  if (downloaded) {
    return "Downloaded";
  }
  return remoteOnly ? "Cloud only" : "Not downloaded";
};

/** @param {{game: GameCardGame, canPlay: boolean, colors: GameCardColors, downloadActive: boolean, launchActive: boolean, onClick: () => void, onLaunch: () => void, onToggleFavorite: () => void}} props Footer properties. */
const CardFooter = ({
  canPlay,
  colors,
  downloadActive,
  game,
  launchActive,
  onClick,
  onLaunch,
  onToggleFavorite,
}) => (
  <Box
    onClick={onClick}
    sx={{
      background: "linear-gradient(transparent, rgba(0,0,0,0.94))",
      bottom: 0,
      left: 0,
      p: 1.25,
      position: "absolute",
      pt: 5,
      right: 0,
      zIndex: 2,
    }}
  >
    <Typography
      title={game.name}
      variant="body2"
      sx={{
        color: "#fff",
        fontWeight: 600,
        mb: 1,
        minHeight: "2.6em",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      {game.name}
    </Typography>
    <CardActions
      canPlay={canPlay}
      colors={colors}
      downloadActive={downloadActive}
      game={game}
      launchActive={launchActive}
      onClick={onClick}
      onLaunch={onLaunch}
      onToggleFavorite={onToggleFavorite}
    />
  </Box>
);

/** @param {{game: GameCardGame, onClick: () => void}} props Card selection properties. */
const CardSelectButton = ({ game, onClick }) => (
  <Box
    component="button"
    type="button"
    aria-label={game.name}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    sx={{
      "&:focus-visible": {
        outline: "2px solid",
        outlineColor: "primary.light",
        outlineOffset: 3,
      },
      background: "transparent",
      border: 0,
      cursor: "pointer",
      inset: 0,
      padding: 0,
      position: "absolute",
      width: "100%",
      zIndex: 1,
    }}
  />
);

/** @param {GameCardProps & {colors: GameCardColors, isRemoteOnly: boolean, canPlay: boolean, launchActive: boolean, downloadActive: boolean, visibleProgress: GameCardProgress|null|undefined, isDownloaded: boolean, platformColor: string, coverSrc: string|null, imgError: boolean, setImgError: (value: boolean) => void}} props Card body properties. */
const CardBody = (props) => {
  const {
    canPlay,
    colors,
    coverSrc,
    downloadActive,
    game,
    imgError,
    isDownloaded,
    isRemoteOnly,
    launchActive,
    onClick,
    onLaunch,
    onToggleFavorite,
    platformColor,
    setImgError,
    visibleProgress,
  } = props;
  const platformSlug = platformBadgeLabel(game.platform_id);
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderRadius: "8px",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      <CardCover
        coverSrc={coverSrc}
        game={game}
        platformColor={platformColor}
        setImgError={setImgError}
        showCover={coverSrc !== null && coverSrc !== "" && !imgError}
      />
      <CardSelectButton game={game} onClick={onClick} />
      <CardStatus
        isDownloaded={isDownloaded}
        platformSlug={platformSlug}
        statusLabel={getStatusLabel(isDownloaded, isRemoteOnly)}
      />
      <CardProgress progress={visibleProgress} />
      <CardFooter
        canPlay={canPlay}
        colors={colors}
        downloadActive={downloadActive}
        game={game}
        launchActive={launchActive}
        onClick={onClick}
        onLaunch={onLaunch}
        onToggleFavorite={onToggleFavorite}
      />
    </Box>
  );
};

/** @param {GameCardProps & {colors: GameCardColors, isRemoteOnly: boolean, canPlay: boolean, launchActive: boolean, downloadActive: boolean, visibleProgress: GameCardProgress|null|undefined, isDownloaded: boolean, platformColor: string, coverSrc: string|null, imgError: boolean, setImgError: (value: boolean) => void, isHovered: boolean, setIsHovered: (value: boolean) => void}} props Card rendering properties. */
const GameCardView = (props) => {
  const { colors, game, isHovered, onClick, setIsHovered, ...bodyProps } =
    props;
  return (
    <Box
      component="div"
      data-testid="game-card"
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      sx={{
        aspectRatio: "3 / 4",
        bgcolor: "transparent",
        border: 0,
        borderRadius: "8px",
        cursor: "pointer",
        overflow: "visible",
        p: 0,
        position: "relative",
        transform: isHovered ? "scale(1.08)" : "scale(1)",
        transition: "transform 0.2s ease",
        width: "100%",
      }}
    >
      <CardBody {...bodyProps} colors={colors} game={game} onClick={onClick} />
    </Box>
  );
};

/** @param {GameCardProps} props Game card data and actions. */
const GameCard = (props) => {
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { colors } = useAppTheme();
  const { game, launchProgress, downloadProgress } = props;
  const isRemoteOnly = ["remote_only", "RemoteOnly"].includes(
    game.sync_state ?? ""
  );
  const hasLocalFile =
    game.local_file_path !== null &&
    game.local_file_path !== undefined &&
    game.local_file_path !== "";
  const hasRommId = game.romm_id !== null && game.romm_id !== undefined;
  const canPlay = hasLocalFile || game.source !== "RomM" || hasRommId;
  const launchActive = launchProgress?.active === true;
  const downloadActive =
    downloadProgress !== null && downloadProgress !== undefined;
  const visibleProgress = launchActive ? launchProgress : downloadProgress;
  const coverSrc = getCoverSrc(game.cover_path);
  const platformColor = PLATFORM_COLORS[game.platform_id] ?? colors.primary;
  return (
    <GameCardView
      {...props}
      canPlay={canPlay}
      colors={colors}
      coverSrc={coverSrc}
      downloadActive={downloadActive}
      imgError={imgError}
      isDownloaded={isGameDownloaded(game)}
      isHovered={isHovered}
      isRemoteOnly={isRemoteOnly}
      launchActive={launchActive}
      platformColor={platformColor}
      setImgError={setImgError}
      setIsHovered={setIsHovered}
      visibleProgress={visibleProgress}
    />
  );
};

export default GameCard;
