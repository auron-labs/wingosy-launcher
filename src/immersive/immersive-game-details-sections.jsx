import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import GameAchievementsSection from "../components/game/game-achievements-section";
import ScreenshotLightbox from "../components/game/screenshot-lightbox";
import { formatDownloadLabel } from "../rom-downloads-format";
import { DetailsActions } from "./immersive-game-details-actions";
import { InstalledMarker } from "./immersive-shell";
import {
  IMMERSIVE_TITLE_FONT,
  getImmersiveGenres,
  getImmersiveYear,
  isImmersiveInstalled,
} from "./immersive-shell-utils";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {{downloaded?: number|null, total?: number|null, percent?: number|null, stage?: string, file_index?: number|null, total_files?: number|null}} DownloadProgress */
/** @typedef {{message: string, type: "error"|"info"|"success"}} DetailsStatus */
/** @typedef {Omit<import("./immersive-game-details-menu").DetailsMenuProps, "menuAnchor"|"setMenuAnchor">} DetailsMenuProps */

/** @param {unknown} value Candidate value. @returns {boolean} Whether the value contains text. */
const hasText = (value) =>
  value !== null && value !== undefined && value !== "";

/** @param {DownloadProgress|null} progress Download progress. @returns {boolean} Whether a determinate value is available. */
const hasProgressPercent = (progress) =>
  progress?.percent !== null && progress?.percent !== undefined;

/** @param {DownloadProgress|null} progress Switch progress. @returns {string} Progress label. */
const getSwitchStageLabel = (progress) => {
  if (progress?.stage === "registering") {
    return "Registering content with Eden…";
  }
  if (progress?.stage === "reusing") {
    return "Reusing unchanged content…";
  }
  return "Downloading Switch content…";
};

/** @param {DownloadProgress|null} progress Switch progress. @returns {string} Optional file count label. */
const getFileProgressLabel = (progress) => {
  if (
    progress?.file_index === null ||
    progress?.file_index === undefined ||
    progress.total_files === null ||
    progress.total_files === undefined
  ) {
    return "";
  }
  return ` (${progress.file_index}/${progress.total_files})`;
};

/** @param {{game: ImmersiveGame, platformLabel?: string|null}} props Hero metadata properties. */
const DetailsHeroMetadata = ({ game, platformLabel }) => (
  <Stack
    direction="row"
    spacing={2}
    sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
  >
    {hasText(platformLabel) ? (
      <Typography
        sx={{
          color: "common.white",
          fontSize: "0.95rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {getImmersiveYear(game) === null
          ? platformLabel
          : `${platformLabel} / ${getImmersiveYear(game)}`}
      </Typography>
    ) : null}
    <InstalledMarker installed={isImmersiveInstalled(game)} />
  </Stack>
);

/** @param {{genres: string[]}} props Genre line properties. */
const DetailsGenreLine = ({ genres }) => {
  if (genres.length === 0) {
    return null;
  }
  return (
    <Typography
      sx={{
        color: "rgba(245,241,232,0.75)",
        fontSize: "1rem",
        fontWeight: 500,
        letterSpacing: "0.22em",
        mt: 1,
        textTransform: "uppercase",
      }}
    >
      {genres.join(" / ")}
    </Typography>
  );
};

/** @param {{game: ImmersiveGame}} props Hero title properties. */
const DetailsHeroTitle = ({ game }) => (
  <>
    <Typography
      component="h1"
      sx={{
        color: "#f5f1e8",
        fontFamily: IMMERSIVE_TITLE_FONT,
        fontSize: "clamp(2.5rem, 5.5vw, 5rem)",
        fontWeight: 700,
        letterSpacing: "0.01em",
        lineHeight: 1.02,
        mt: 1,
        textShadow: "0 2px 24px rgba(0,0,0,0.6)",
        textTransform: "uppercase",
      }}
    >
      {game.name}
    </Typography>
    <DetailsGenreLine genres={getImmersiveGenres(game)} />
  </>
);

/** @param {{onViewAll: () => void}} props Media heading properties. */
const MediaHeading = ({ onViewAll }) => (
  <Stack direction="row" spacing={2} sx={{ alignItems: "baseline", mb: 1.5 }}>
    <Typography
      sx={{
        color: "rgba(245,241,232,0.6)",
        fontSize: "0.8rem",
        fontWeight: 700,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
      }}
    >
      Media
    </Typography>
    <ButtonBase
      onClick={onViewAll}
      sx={{
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.light",
          outlineOffset: 2,
        },
        borderRadius: 1,
        color: "primary.light",
        fontSize: "0.9rem",
        fontWeight: 700,
      }}
    >
      View all ›
    </ButtonBase>
  </Stack>
);

/** @param {{url: string, index: number, getMediaSrc: (url: string) => string|null, onOpen: (index: number) => void}} props Media thumbnail properties. */
const MediaThumbnail = ({ url, index, getMediaSrc, onOpen }) => {
  const src = getMediaSrc(url);
  if (src === null || src === "") {
    return null;
  }
  return (
    <ButtonBase
      aria-label={`View screenshot ${index + 1} larger`}
      onClick={() => {
        onOpen(index);
      }}
      sx={{
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.light",
          outlineOffset: 2,
        },
        aspectRatio: "4 / 3",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 1.5,
        overflow: "hidden",
      }}
    >
      <Box
        component="img"
        loading="lazy"
        src={src}
        alt={`Screenshot ${index + 1}`}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        sx={{ height: "100%", objectFit: "cover", width: "100%" }}
      />
    </ButtonBase>
  );
};

/** @param {{urls: string[], getMediaSrc: (url: string) => string|null, onOpen: (index: number) => void}} props Media grid properties. */
const MediaGrid = ({ urls, getMediaSrc, onOpen }) => (
  <Box
    sx={{
      display: "grid",
      gap: 2,
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      maxWidth: 900,
    }}
  >
    {urls.slice(0, 3).map((url, index) => (
      <MediaThumbnail
        key={`${url}-${index}`}
        url={url}
        index={index}
        getMediaSrc={getMediaSrc}
        onOpen={onOpen}
      />
    ))}
  </Box>
);

/** @param {{screenshots: string[], getMediaSrc: (url: string) => string|null}} props Media gallery properties. */
const DetailsMediaGallery = ({ screenshots, getMediaSrc }) => {
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const urls = screenshots.filter((url) => url !== "");
  if (urls.length === 0) {
    return null;
  }
  /** @param {number} index Screenshot index. */
  const openAt = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };
  return (
    <Box sx={{ mt: 4 }}>
      <MediaHeading
        onViewAll={() => {
          openAt(0);
        }}
      />
      <MediaGrid urls={urls} getMediaSrc={getMediaSrc} onOpen={openAt} />
      <ScreenshotLightbox
        getSrc={getMediaSrc}
        index={lightboxIndex}
        onClose={() => {
          setLightboxOpen(false);
        }}
        onIndexChange={setLightboxIndex}
        open={lightboxOpen}
        urls={urls}
      />
    </Box>
  );
};

/** @param {{game: ImmersiveGame, achievementState: ReturnType<typeof import("../components/game/use-game-details-achievements").useGameDetailsAchievements>, retroachievementsEnabled: boolean, onOpenIntegrations: (() => void)|null}} props About properties. */
const DetailsAbout = ({
  achievementState,
  game,
  onOpenIntegrations,
  retroachievementsEnabled,
}) => (
  <Box sx={{ maxWidth: 720, mt: 4 }}>
    <Typography
      sx={{
        color: "rgba(245,241,232,0.6)",
        fontSize: "0.8rem",
        fontWeight: 700,
        letterSpacing: "0.28em",
        mb: 1.5,
        textTransform: "uppercase",
      }}
    >
      About the game
    </Typography>
    <Typography
      variant="body1"
      sx={{
        color: "rgba(245,241,232,0.9)",
        lineHeight: 1.75,
        textShadow: "0 1px 12px rgba(0,0,0,0.6)",
      }}
    >
      {hasText(game.summary) ? game.summary : "No description available."}
    </Typography>
    <Box sx={{ mt: 2 }}>
      <GameAchievementsSection
        achievements={achievementState.achievements}
        error={achievementState.error}
        gameName={game.name}
        loading={achievementState.loading}
        onRefresh={
          achievementState.canRefresh
            ? achievementState.refreshAchievements
            : null
        }
        onOpenIntegrations={onOpenIntegrations}
        previousResult={achievementState.previousResult}
        retroAchievementsEnabled={retroachievementsEnabled}
        refreshing={achievementState.refreshing}
      />
    </Box>
  </Box>
);

/** @param {{game: ImmersiveGame, achievementState: ReturnType<typeof import("../components/game/use-game-details-achievements").useGameDetailsAchievements>, platformLabel?: string|null, retroachievementsEnabled: boolean, onOpenIntegrations: (() => void)|null, menuAnchor: HTMLElement|null, setMenuAnchor: (anchor: HTMLElement|null) => void, menuProps: DetailsMenuProps, screenshots: string[], getMediaSrc: (url: string) => string|null, primaryActionRef: {current: HTMLButtonElement|null}, canPlay: boolean, hasRomm: boolean, rommConfigured: boolean, hasLocalFile: boolean, canDownload: boolean, canSyncSwitchContent: boolean, downloading: boolean, launchActive: boolean, switchContentSyncing: boolean, handleLaunchGame: () => Promise<void>, handleDownloadRom: () => Promise<void>, handleSyncSwitchContent: () => Promise<void>, onToggleFavorite: (gameId: number|string) => void|Promise<void>}} props Summary properties. */
export const DetailsSummary = (props) => {
  const {
    achievementState,
    game,
    onOpenIntegrations,
    retroachievementsEnabled,
  } = props;
  return (
    <Box sx={{ maxWidth: 1200 }}>
      <DetailsHeroMetadata game={game} platformLabel={props.platformLabel} />
      <DetailsHeroTitle game={game} />
      <Box sx={{ mt: 3 }}>
        <DetailsActions {...props} />
      </Box>
      <DetailsAbout
        achievementState={achievementState}
        game={game}
        retroachievementsEnabled={retroachievementsEnabled}
        onOpenIntegrations={onOpenIntegrations}
      />
      <DetailsMediaGallery
        screenshots={props.screenshots}
        getMediaSrc={props.getMediaSrc}
      />
    </Box>
  );
};

/** @param {{downloading: boolean, romDl: DownloadProgress|null, downloadStatus: DetailsStatus|null, setDownloadStatus: (status: DetailsStatus|null) => void, actionStatus: DetailsStatus|null, setActionStatus: (status: DetailsStatus|null) => void, switchContentSyncing: boolean, switchContentProgress: DownloadProgress|null}} props Status properties. */
export const DetailsStatusArea = ({
  downloading,
  romDl,
  downloadStatus,
  setDownloadStatus,
  actionStatus,
  setActionStatus,
  switchContentSyncing,
  switchContentProgress,
}) => (
  <>
    {downloading ? (
      <Box sx={{ mb: 2 }}>
        <LinearProgress
          variant={hasProgressPercent(romDl) ? "determinate" : "indeterminate"}
          value={romDl?.percent ?? undefined}
          sx={{ borderRadius: 2 }}
        />
        {romDl ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            {formatDownloadLabel(romDl)}
          </Typography>
        ) : null}
      </Box>
    ) : null}
    {downloadStatus ? (
      <Alert
        severity={downloadStatus.type}
        sx={{ mb: 2 }}
        onClose={() => {
          setDownloadStatus(null);
        }}
      >
        {downloadStatus.message}
      </Alert>
    ) : null}
    {actionStatus ? (
      <Alert
        severity={actionStatus.type}
        sx={{ mb: 2 }}
        onClose={() => {
          setActionStatus(null);
        }}
      >
        {actionStatus.message}
      </Alert>
    ) : null}
    {switchContentSyncing ? (
      <Box sx={{ mb: 2 }} data-testid="switch-content-sync-progress">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {getSwitchStageLabel(switchContentProgress)}
          {getFileProgressLabel(switchContentProgress)}
        </Typography>
        <LinearProgress
          variant={
            hasProgressPercent(switchContentProgress)
              ? "determinate"
              : "indeterminate"
          }
          value={switchContentProgress?.percent ?? undefined}
          sx={{ borderRadius: 2 }}
        />
        {switchContentProgress?.downloaded !== null &&
        switchContentProgress?.downloaded !== undefined ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            {formatDownloadLabel(switchContentProgress)}
          </Typography>
        ) : null}
      </Box>
    ) : null}
  </>
);
