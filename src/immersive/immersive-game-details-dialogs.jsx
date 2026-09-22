import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

import ConfirmDestructiveDialog from "../components/confirm-destructive-dialog";
import CollectionPickerDialog from "../components/game/collection-picker-dialog";
import KeyboardHint from "../components/keyboard-hint";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {{downloaded?: number|null, total?: number|null, percent?: number|null, stage?: string}} DownloadProgress */
/** @typedef {{id: number, name: string, is_smart?: boolean}} Collection */
/** @typedef {{message: string, guidance: string, retryable: boolean}} LaunchErrorPresentation */
/** @typedef {ReturnType<typeof import("../components/game/use-missing-emulator-recovery").useMissingEmulatorRecovery>} MissingEmulatorRecovery */
/** @typedef {{game: ImmersiveGame, deleteDialogOpen: boolean, setDeleteDialogOpen: (open: boolean) => void, onDeleteDownload: () => Promise<void>, collectionDialogOpen: boolean, setCollectionDialogOpen: (open: boolean) => void, collections: Collection[], onPickCollection: (collectionId: number) => Promise<void>, launchDialogOpen: boolean, launchFailure: boolean, onBack: () => void, launchErrorPresentation: LaunchErrorPresentation, missingEmulatorRecovery: MissingEmulatorRecovery, visibleLaunchProgress: DownloadProgress|null, launchActive: boolean, launchStageLabel: (stage?: string) => string, launchProgressLabel: (progress: DownloadProgress|null) => string, retryableLaunchFailure: boolean, onOpenSettings: () => void, onLaunchGame: () => Promise<void>}} ImmersiveDetailsDialogsProps */

/** @param {DownloadProgress|null} progress Launch progress. @returns {boolean} Whether a determinate value is available. */
const hasProgressPercent = (progress) =>
  progress?.percent !== null && progress?.percent !== undefined;

/** @param {Pick<ImmersiveDetailsDialogsProps, "game"|"deleteDialogOpen"|"setDeleteDialogOpen"|"onDeleteDownload">} props Delete dialog properties. */
const DeleteDialog = ({
  game,
  deleteDialogOpen,
  setDeleteDialogOpen,
  onDeleteDownload,
}) => (
  <ConfirmDestructiveDialog
    open={deleteDialogOpen}
    title="Delete Downloaded ROM?"
    message={`This will delete the local ROM file for "${game.name}".${game.romm_id !== null && game.romm_id !== undefined ? " The game will remain in your library (from RomM) and can be re-downloaded." : " This will remove the game from your library completely."}`}
    confirmLabel="Delete"
    onCancel={() => {
      setDeleteDialogOpen(false);
    }}
    onConfirm={() => {
      void onDeleteDownload();
    }}
  />
);

/** @param {Pick<ImmersiveDetailsDialogsProps, "game"|"collectionDialogOpen"|"setCollectionDialogOpen"|"collections"|"onPickCollection">} props Collection dialog properties. */
const CollectionDialog = ({
  game,
  collectionDialogOpen,
  setCollectionDialogOpen,
  collections,
  onPickCollection,
}) => (
  <CollectionPickerDialog
    open={collectionDialogOpen}
    onClose={() => {
      setCollectionDialogOpen(false);
    }}
    collections={collections}
    onPick={(collectionId) => {
      void onPickCollection(collectionId);
    }}
    gameName={game.name}
  />
);

/** @param {MissingEmulatorRecovery} recovery Recovery state. @returns {boolean} Whether the user can confirm an installation. */
const hasInstallConfirmation = (recovery) =>
  recovery.offer !== null && recovery.status !== "success";

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

/** @param {{recovery: MissingEmulatorRecovery}} props Missing-emulator installation state. */
const MissingEmulatorInstallOffer = ({ recovery }) => {
  const emulator = recovery.offer;
  if (emulator === null) {
    return null;
  }
  if (recovery.status === "success") {
    return (
      <Typography variant="body2" sx={{ mt: 1 }}>
        {emulator.name} was installed. Press Play when you&apos;re ready.
      </Typography>
    );
  }
  const handleCancel = () => {
    recovery.cancel();
  };
  return (
    <>
      <Typography variant="body2" sx={{ mt: 1 }}>
        {getMissingEmulatorInstallMessage(recovery)}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button
          autoFocus
          disabled={recovery.pending}
          onClick={() => {
            void recovery.confirm();
          }}
          variant="contained"
        >
          Install {emulator.name}
        </Button>
        <Button
          disabled={recovery.pending}
          onClick={handleCancel}
          variant="outlined"
        >
          Cancel
        </Button>
      </Stack>
    </>
  );
};

/** @param {{launchErrorPresentation: LaunchErrorPresentation, recovery: MissingEmulatorRecovery}} props Launch failure properties. */
const LaunchFailure = ({ launchErrorPresentation, recovery }) => (
  <Alert severity="error" sx={{ alignItems: "flex-start" }}>
    <Typography variant="body1">{launchErrorPresentation.message}</Typography>
    <Typography variant="body2" sx={{ mt: 1 }}>
      {launchErrorPresentation.guidance}
    </Typography>
    <MissingEmulatorInstallOffer recovery={recovery} />
  </Alert>
);

/** @param {{visibleLaunchProgress: DownloadProgress|null, launchStageLabel: (stage?: string) => string, launchProgressLabel: (progress: DownloadProgress|null) => string}} props Launch progress properties. */
const LaunchProgress = ({
  visibleLaunchProgress,
  launchStageLabel,
  launchProgressLabel,
}) => {
  const progressLabel = launchProgressLabel(visibleLaunchProgress);
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {launchStageLabel(visibleLaunchProgress?.stage)}
      </Typography>
      <LinearProgress
        variant={
          hasProgressPercent(visibleLaunchProgress)
            ? "determinate"
            : "indeterminate"
        }
        value={visibleLaunchProgress?.percent ?? undefined}
        sx={{ borderRadius: 2, height: 8 }}
      />
      {progressLabel ? (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          {progressLabel}
        </Typography>
      ) : null}
    </Box>
  );
};

/** @param {{launchFailure: boolean, onBack: () => void, onOpenSettings: () => void, recovery: MissingEmulatorRecovery, retryableLaunchFailure: boolean, onLaunchGame: () => Promise<void>, launchActive: boolean}} props Launch action properties. */
const LaunchActions = ({
  launchFailure,
  onBack,
  onOpenSettings,
  recovery,
  retryableLaunchFailure,
  onLaunchGame,
  launchActive,
}) => {
  if (!launchFailure) {
    return null;
  }
  return (
    <DialogActions>
      <Button onClick={onBack}>Back</Button>
      <Button
        onClick={onOpenSettings}
        variant={retryableLaunchFailure ? "outlined" : "contained"}
        autoFocus={!retryableLaunchFailure && !hasInstallConfirmation(recovery)}
      >
        Open Settings
      </Button>
      {retryableLaunchFailure ? (
        <Button
          onClick={() => {
            void onLaunchGame();
          }}
          variant="contained"
          autoFocus
          disabled={launchActive}
        >
          Retry
        </Button>
      ) : null}
    </DialogActions>
  );
};

/** @param {Pick<ImmersiveDetailsDialogsProps, "launchDialogOpen"|"launchFailure"|"onBack"|"launchErrorPresentation"|"missingEmulatorRecovery"|"visibleLaunchProgress"|"launchActive"|"launchStageLabel"|"launchProgressLabel"|"retryableLaunchFailure"|"onOpenSettings"|"onLaunchGame">} props Launch dialog properties. */
const LaunchDialog = ({
  launchDialogOpen,
  launchFailure,
  missingEmulatorRecovery,
  onBack,
  launchErrorPresentation,
  visibleLaunchProgress,
  launchActive,
  launchStageLabel,
  launchProgressLabel,
  retryableLaunchFailure,
  onOpenSettings,
  onLaunchGame,
}) => (
  <Dialog
    open={launchDialogOpen}
    fullWidth
    maxWidth="sm"
    onClose={launchFailure ? onBack : undefined}
    aria-labelledby="immersive-launch-title"
    slotProps={{
      backdrop: {
        sx: (theme) => ({
          backdropFilter: "brightness(0.55)",
          bgcolor: alpha("#000", theme.palette.mode === "dark" ? 0.78 : 0.62),
        }),
      },
    }}
  >
    <DialogTitle id="immersive-launch-title">
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <span>{launchFailure ? "Launch failed" : "Preparing game"}</span>
        {launchFailure ? (
          <KeyboardHint aria-hidden="true">Esc to go back</KeyboardHint>
        ) : null}
      </Stack>
    </DialogTitle>
    <DialogContent>
      {launchFailure ? (
        <LaunchFailure
          launchErrorPresentation={launchErrorPresentation}
          recovery={missingEmulatorRecovery}
        />
      ) : (
        <LaunchProgress
          launchProgressLabel={launchProgressLabel}
          launchStageLabel={launchStageLabel}
          visibleLaunchProgress={visibleLaunchProgress}
        />
      )}
    </DialogContent>
    <LaunchActions
      launchActive={launchActive}
      launchFailure={launchFailure}
      onBack={onBack}
      onLaunchGame={onLaunchGame}
      onOpenSettings={onOpenSettings}
      recovery={missingEmulatorRecovery}
      retryableLaunchFailure={retryableLaunchFailure}
    />
  </Dialog>
);

/** @param {ImmersiveDetailsDialogsProps} props Dialog properties. */
const ImmersiveGameDetailsDialogs = (props) => {
  const {
    collectionDialogOpen,
    collections,
    deleteDialogOpen,
    game,
    launchDialogOpen,
    launchErrorPresentation,
    launchFailure,
    missingEmulatorRecovery,
    launchActive,
    launchProgressLabel,
    launchStageLabel,
    onBack,
    onDeleteDownload,
    onLaunchGame,
    onOpenSettings,
    onPickCollection,
    retryableLaunchFailure,
    setCollectionDialogOpen,
    setDeleteDialogOpen,
    visibleLaunchProgress,
  } = props;
  return (
    <>
      <DeleteDialog
        deleteDialogOpen={deleteDialogOpen}
        game={game}
        onDeleteDownload={onDeleteDownload}
        setDeleteDialogOpen={setDeleteDialogOpen}
      />
      <CollectionDialog
        collectionDialogOpen={collectionDialogOpen}
        collections={collections}
        game={game}
        onPickCollection={onPickCollection}
        setCollectionDialogOpen={setCollectionDialogOpen}
      />
      <LaunchDialog
        launchActive={launchActive}
        launchDialogOpen={launchDialogOpen}
        launchErrorPresentation={launchErrorPresentation}
        launchFailure={launchFailure}
        launchProgressLabel={launchProgressLabel}
        launchStageLabel={launchStageLabel}
        missingEmulatorRecovery={missingEmulatorRecovery}
        onBack={onBack}
        onLaunchGame={onLaunchGame}
        onOpenSettings={onOpenSettings}
        retryableLaunchFailure={retryableLaunchFailure}
        visibleLaunchProgress={visibleLaunchProgress}
      />
    </>
  );
};

export default ImmersiveGameDetailsDialogs;
