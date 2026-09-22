import CloseIcon from "@mui/icons-material/Close";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SyncIcon from "@mui/icons-material/Sync";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { formatDownloadLabel } from "../../rom-downloads-format";
import { launchStageLabel } from "./game-details-utils";
import { SwitchContentStatusLabel } from "./switch-content-status-label";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsProgress} GameDetailsProgress */
/** @typedef {import("./game-details-types").GameDetailsSwitchContentStatus} GameDetailsSwitchContentStatus */
/** @typedef {import("./game-details-types").EmulatorInfo} EmulatorInfo */

/** @typedef {{game: GameDetailsGame, canPlay: boolean, canDownload: boolean, hasLocalFile: boolean, downloading: boolean, launchActive: boolean, saveSyncBusy: boolean, switchContentSyncing: boolean, switchContentStatus: GameDetailsSwitchContentStatus|null, canSyncSwitchContent: boolean, cloudSaveStatus?: import("react").ReactNode, onLaunch: () => Promise<void>, onDownload: () => Promise<void>, onSyncSwitchContent: () => Promise<void>}} GameDetailsPlayControlsProps */

/** @param {{downloading: boolean, launchActive: boolean, onLaunch: () => Promise<void>, saveSyncBusy: boolean, switchContentSyncing: boolean}} props Play button properties. */
const PlayButton = ({
  downloading,
  launchActive,
  onLaunch,
  saveSyncBusy,
  switchContentSyncing,
}) => (
  <Button
    disabled={
      launchActive || downloading || saveSyncBusy || switchContentSyncing
    }
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
);

/** @param {{canDownload: boolean, downloading: boolean, launchActive: boolean, onDownload: () => Promise<void>, switchContentSyncing: boolean}} props Download button properties. */
const RomDownloadButton = ({
  canDownload,
  downloading,
  launchActive,
  onDownload,
  switchContentSyncing,
}) => (
  <Tooltip
    arrow
    title={canDownload ? "" : "Connect to RomM server in Settings to download"}
  >
    <span>
      <Button
        disabled={
          downloading || launchActive || switchContentSyncing || !canDownload
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
);

/** @param {{downloading: boolean, launchActive: boolean, onDownload: () => Promise<void>, switchContentSyncing: boolean}} props Redownload button properties. */
const RedownloadButton = ({
  downloading,
  launchActive,
  onDownload,
  switchContentSyncing,
}) => (
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
);

/** @param {{downloading: boolean, launchActive: boolean, onSyncSwitchContent: () => Promise<void>, switchContentSyncing: boolean}} props Switch content button properties. */
const SwitchContentButton = ({
  downloading,
  launchActive,
  onSyncSwitchContent,
  switchContentSyncing,
}) => (
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
);

/** @param {GameDetailsPlayControlsProps} props Component properties. */
export const GameDetailsPlayControls = ({
  canDownload,
  canPlay,
  canSyncSwitchContent,
  cloudSaveStatus,
  downloading,
  game,
  hasLocalFile,
  launchActive,
  onDownload,
  onLaunch,
  onSyncSwitchContent,
  saveSyncBusy,
  switchContentStatus,
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
      <PlayButton
        downloading={downloading}
        launchActive={launchActive}
        onLaunch={onLaunch}
        saveSyncBusy={saveSyncBusy}
        switchContentSyncing={switchContentSyncing}
      />
    )}
    {cloudSaveStatus}
    {game.romm_id !== null && game.romm_id !== undefined && !hasLocalFile && (
      <RomDownloadButton
        canDownload={canDownload}
        downloading={downloading}
        launchActive={launchActive}
        onDownload={onDownload}
        switchContentSyncing={switchContentSyncing}
      />
    )}
    {canDownload && hasLocalFile && (
      <RedownloadButton
        downloading={downloading}
        launchActive={launchActive}
        onDownload={onDownload}
        switchContentSyncing={switchContentSyncing}
      />
    )}
    {canSyncSwitchContent && (
      <Box
        sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 1 }}
      >
        <SwitchContentButton
          downloading={downloading}
          launchActive={launchActive}
          onSyncSwitchContent={onSyncSwitchContent}
          switchContentSyncing={switchContentSyncing}
        />
        <SwitchContentStatusLabel
          status={switchContentStatus}
          sx={{ color: "text.secondary" }}
        />
      </Box>
    )}
  </Box>
);

/** @typedef {{offer: EmulatorInfo|null, status: "idle"|"loading"|"ready"|"cancelled"|"installing"|"success"|"error", pending: boolean, error: string|null, confirm: () => Promise<void>, cancel: () => void}} MissingEmulatorRecovery */
/** @typedef {{progress: GameDetailsProgress|null, launchError: string|null, presentation: {message: string, guidance: string, retryable: boolean}, launchActive: boolean, downloadActive: boolean, onDismiss: () => void, onRetry: () => Promise<void>, onOpenSettings: (() => void)|null, recovery: MissingEmulatorRecovery}} GameDetailsLaunchStatusProps */

/** @param {MissingEmulatorRecovery} recovery Recovery state. @returns {string} Install offer message. */
const getMissingEmulatorInstallMessage = (recovery) => {
  const emulatorName = recovery.offer?.name ?? "the emulator";
  if (recovery.status === "installing") {
    return `Installing ${emulatorName}…`;
  }
  if (recovery.status === "error") {
    return `Couldn’t install ${emulatorName}: ${recovery.error}`;
  }
  return `Install ${emulatorName} to play this game.`;
};

/** @param {{recovery: MissingEmulatorRecovery}} props Missing-emulator install offer state. */
const MissingEmulatorInstallOffer = ({ recovery }) => {
  const emulator = recovery.offer;
  if (emulator === null) {
    return null;
  }
  if (recovery.status === "success") {
    return (
      <Typography sx={{ display: "block", mt: 1 }} variant="body2">
        {emulator.name} was installed. Press Play when you&apos;re ready.
      </Typography>
    );
  }
  const handleInstall = () => {
    void recovery.confirm();
  };
  const handleCancel = () => {
    recovery.cancel();
  };
  return (
    <>
      <Typography sx={{ display: "block", mt: 1 }} variant="body2">
        {getMissingEmulatorInstallMessage(recovery)}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
        <Button
          color="inherit"
          disabled={recovery.pending}
          onClick={handleInstall}
          size="small"
        >
          Install {emulator.name}
        </Button>
        <Button
          color="inherit"
          disabled={recovery.pending}
          onClick={handleCancel}
          size="small"
        >
          Cancel
        </Button>
      </Box>
    </>
  );
};

/** @param {{progress: GameDetailsProgress|null}} props Download progress properties. */
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
        variant={
          progress.percent === null || progress.percent === undefined
            ? "indeterminate"
            : "determinate"
        }
        sx={{ borderRadius: 2 }}
      />
      {progress.downloaded === null ||
      progress.downloaded === undefined ? null : (
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

/** @param {GameDetailsProgress|null} progress - Download progress. @param {string|null} launchError - Launch error. @returns {"error"|"info"|"success"} Alert severity. */
const getLaunchStatusSeverity = (progress, launchError) => {
  if (
    progress?.stage === "failure" ||
    (launchError !== null && launchError !== "")
  ) {
    return "error";
  }
  if (progress?.stage === "completion") {
    return "success";
  }
  return "info";
};

/** @param {GameDetailsProgress|null} progress - Download progress. @param {boolean} failed - Whether launch failed. @param {{message: string}} presentation - Failure presentation. @returns {string} Message to display. */
const getLaunchStatusMessage = (progress, failed, presentation) => {
  if (failed) {
    return presentation.message;
  }
  if (progress !== null) {
    return launchStageLabel(progress.stage);
  }
  return "Launch failed";
};

/** @param {GameDetailsLaunchStatusProps} props Component properties. */
export const GameDetailsLaunchStatus = ({
  downloadActive,
  launchActive,
  launchError,
  onDismiss,
  onOpenSettings,
  onRetry,
  presentation,
  progress,
  recovery,
}) => {
  if (progress === null && launchError === null) {
    return null;
  }
  const failed =
    progress?.stage === "failure" ||
    (launchError !== null && launchError !== "");
  const severity = getLaunchStatusSeverity(progress, launchError);
  const statusMessage = getLaunchStatusMessage(progress, failed, presentation);
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
              <IconButton
                aria-label="Dismiss launch error"
                color="inherit"
                onClick={onDismiss}
                size="small"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : undefined
        }
        severity={severity}
      >
        {statusMessage}
        {failed ? (
          <>
            <Typography sx={{ display: "block", mt: 0.5 }} variant="body2">
              {presentation.guidance}
            </Typography>
            <MissingEmulatorInstallOffer recovery={recovery} />
          </>
        ) : null}
      </Alert>
      <LaunchDownloadProgress progress={progress} />
    </Box>
  );
};

/** @typedef {{downloading: boolean, progress: GameDetailsProgress|null, status: {message: string, type: "error"|"info"|"success"}|null, switchContentSyncing: boolean, switchContentProgress: GameDetailsProgress|null}} GameDetailsDownloadStatusProps */

/** @param {GameDetailsProgress|null} progress Switch content progress. @returns {string} Progress message. */
const getSwitchContentProgressLabel = (progress) => {
  if (progress?.stage === "registering") {
    return "Registering content with Eden…";
  }
  if (progress?.stage === "reusing") {
    return "Reusing unchanged content…";
  }
  return "Downloading Switch content…";
};

/** @param {{progress: GameDetailsProgress|null}} props Switch content progress. */
const SwitchContentProgress = ({ progress }) => (
  <Box data-testid="switch-content-sync-progress" sx={{ mb: 2 }}>
    <Typography color="text.secondary" sx={{ mb: 0.5 }} variant="body2">
      {getSwitchContentProgressLabel(progress)}
      {progress?.file_index !== null &&
      progress?.file_index !== undefined &&
      progress.total_files !== null &&
      progress.total_files !== undefined
        ? ` (${progress.file_index}/${progress.total_files})`
        : ""}
    </Typography>
    <LinearProgress
      value={progress?.percent ?? undefined}
      variant={
        progress?.percent === null || progress?.percent === undefined
          ? "indeterminate"
          : "determinate"
      }
      sx={{ borderRadius: 2 }}
    />
    {progress?.downloaded === null ||
    progress?.downloaded === undefined ? null : (
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
    {status !== null && (
      <Alert severity={status.type} sx={{ mb: 2 }}>
        {status.message}
      </Alert>
    )}
    {switchContentSyncing && (
      <SwitchContentProgress progress={switchContentProgress} />
    )}
  </>
);
