import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SyncIcon from "@mui/icons-material/Sync";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { formatDownloadLabel } from "../../RomDownloadsContext";
import { launchStageLabel } from "./game-details-utils";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsProgress} GameDetailsProgress */

/** @typedef {{game: GameDetailsGame, canPlay: boolean, canDownload: boolean, hasLocalFile: boolean, downloading: boolean, launchActive: boolean, switchContentSyncing: boolean, canSyncSwitchContent: boolean, onLaunch: () => Promise<void>, onDownload: () => Promise<void>, onSyncSwitchContent: () => Promise<void>}} GameDetailsPlayControlsProps */

/** @param {GameDetailsPlayControlsProps} props Component properties. */
export const GameDetailsPlayControls = ({
  canDownload,
  canPlay,
  canSyncSwitchContent,
  downloading,
  game,
  hasLocalFile,
  launchActive,
  onDownload,
  onLaunch,
  onSyncSwitchContent,
  switchContentSyncing,
}) => (
  <Box
    sx={{
      alignItems: "center",
      display: "flex",
      flexWrap: "wrap",
      gap: 2,
      mb: 4,
    }}
  >
    {canPlay && (
      <Button
        disabled={launchActive || downloading || switchContentSyncing}
        onClick={() => {
          void onLaunch();
        }}
        size="large"
        startIcon={<PlayArrowIcon />}
        sx={{ borderRadius: 3, fontSize: "1.1rem", px: 5, py: 1.5 }}
        variant="contained"
      >
        {launchActive ? "Preparing..." : "Play"}
      </Button>
    )}

    {game.romm_id && !hasLocalFile && (
      <Tooltip
        arrow
        title={
          canDownload ? "" : "Connect to RomM server in Settings to download"
        }
      >
        <span>
          <Button
            disabled={
              downloading ||
              launchActive ||
              switchContentSyncing ||
              !canDownload
            }
            onClick={() => {
              void onDownload();
            }}
            size="large"
            startIcon={downloading ? null : <CloudDownloadIcon />}
            sx={{ borderRadius: 3, fontSize: "1.1rem", px: 5, py: 1.5 }}
            variant="outlined"
          >
            {downloading ? "Downloading..." : "Download ROM"}
          </Button>
        </span>
      </Tooltip>
    )}

    {canDownload && hasLocalFile && (
      <Button
        color="secondary"
        disabled={downloading || launchActive || switchContentSyncing}
        onClick={() => {
          void onDownload();
        }}
        size="small"
        startIcon={downloading ? null : <CloudDownloadIcon />}
        sx={{ borderRadius: 3 }}
        variant="outlined"
      >
        {downloading ? "Downloading..." : "Re-download"}
      </Button>
    )}

    {canSyncSwitchContent && (
      <Button
        color="secondary"
        disabled={switchContentSyncing || launchActive || downloading}
        onClick={() => {
          void onSyncSwitchContent();
        }}
        size="small"
        startIcon={switchContentSyncing ? null : <SyncIcon />}
        sx={{ borderRadius: 3 }}
        variant="outlined"
      >
        {switchContentSyncing ? "Syncing Updates & DLC…" : "Sync Updates & DLC"}
      </Button>
    )}
  </Box>
);

/** @typedef {{progress: GameDetailsProgress|null, launchError: string|null, presentation: {message: string, guidance: string, retryable: boolean}, launchActive: boolean, downloadActive: boolean, onRetry: () => Promise<void>, onOpenSettings: (() => void)|null}} GameDetailsLaunchStatusProps */

/** @param {GameDetailsLaunchStatusProps} props Component properties. */
export const GameDetailsLaunchStatus = ({
  downloadActive,
  launchActive,
  launchError,
  launchError: _launchError,
  onOpenSettings,
  onRetry,
  presentation,
  progress,
}) => {
  if (!progress && !launchError) {
    return null;
  }
  const failed = progress?.stage === "failure" || Boolean(launchError);
  const severity = failed
    ? "error"
    : (progress?.stage === "completion"
      ? "success"
      : "info");
  return (
    <Box sx={{ mb: 2 }}>
      <Alert
        action={
          failed ? (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {!presentation.retryable && onOpenSettings ? (
                <Button color="inherit" onClick={onOpenSettings} size="small">
                  Open Settings
                </Button>
              ) : null}
              {presentation.retryable ? (
                <Button
                  color="inherit"
                  disabled={launchActive || downloadActive}
                  onClick={() => {
                    void onRetry();
                  }}
                  size="small"
                >
                  Retry
                </Button>
              ) : null}
            </Box>
          ) : undefined
        }
        severity={severity}
      >
        {failed
          ? presentation.message
          : (progress
            ? launchStageLabel(progress.stage)
            : "Launch failed")}
        {failed ? (
          <Typography sx={{ display: "block", mt: 0.5 }} variant="body2">
            {presentation.guidance}
          </Typography>
        ) : null}
      </Alert>
      <LaunchDownloadProgress progress={progress} />
    </Box>
  );
};

/** @param {{progress: GameDetailsProgress|null}} props */
const LaunchDownloadProgress = ({ progress }) => {
  if (
    progress?.stage !== "downloading" &&
    progress?.stage !== "bios_preparation"
  ) {
    return null;
  }
  return (
    <Box sx={{ mt: 1 }}>
      <LinearProgress
        value={progress.percent ?? undefined}
        variant={progress.percent == null ? "indeterminate" : "determinate"}
        sx={{ borderRadius: 2 }}
      />
      {progress.downloaded == null ? null : (
        <Typography
          color="text.secondary"
          sx={{ display: "block", mt: 0.5 }}
          variant="caption"
        >
          {formatDownloadLabel(progress)}
        </Typography>
      )}
    </Box>
  );
};

/** @typedef {{downloading: boolean, progress: GameDetailsProgress|null, status: {message: string, type: "error"|"info"|"success"}|null, switchContentSyncing: boolean, switchContentProgress: GameDetailsProgress|null}} GameDetailsDownloadStatusProps */

/** @param {GameDetailsDownloadStatusProps} props Component properties. */
export const GameDetailsDownloadStatus = ({
  downloading,
  progress,
  status,
  switchContentProgress,
  switchContentSyncing,
}) => (
  <>
    {downloading && <LaunchDownloadProgress progress={progress} />}
    {status && (
      <Alert severity={status.type} sx={{ mb: 2 }}>
        {status.message}
      </Alert>
    )}
    {switchContentSyncing && (
      <Box data-testid="switch-content-sync-progress" sx={{ mb: 2 }}>
        <Typography color="text.secondary" sx={{ mb: 0.5 }} variant="body2">
          {switchContentProgress?.stage === "registering"
            ? "Registering content with Eden…"
            : (switchContentProgress?.stage === "reusing"
              ? "Reusing unchanged content…"
              : "Downloading Switch content…")}
          {switchContentProgress?.file_index != null &&
          switchContentProgress.total_files != null
            ? ` (${switchContentProgress.file_index}/${switchContentProgress.total_files})`
            : ""}
        </Typography>
        <LinearProgress
          value={switchContentProgress?.percent ?? undefined}
          variant={
            switchContentProgress?.percent == null
              ? "indeterminate"
              : "determinate"
          }
          sx={{ borderRadius: 2 }}
        />
        {switchContentProgress?.downloaded == null ? null : (
          <Typography
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
            variant="caption"
          >
            {formatDownloadLabel(switchContentProgress)}
          </Typography>
        )}
      </Box>
    )}
  </>
);
