import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

/** @typedef {import("./use-romm-sync-monitor").RommSyncMonitorState} RommSyncMonitorState */

/** @param {{label: string, value: number}} props Overview metric. */
const OverviewMetric = ({ label, value }) => (
  <Box>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block" }}
    >
      {label}
    </Typography>
    <Typography variant="h6">{value}</Typography>
  </Box>
);

/** @param {{name: string, status: import("./use-romm-sync-monitor").RommSyncMonitorState["platformStatuses"][string]}} props Progress status properties. */
const SyncingPlatformStatus = ({ name, status }) => {
  const processed = status.progress?.processed;
  const total = status.progress?.total;
  const determinate =
    processed !== undefined && total !== undefined && total > 0;
  const progressLabel = determinate
    ? `Syncing ${name} library metadata · ${processed} / ${total}`
    : `Syncing ${name} library metadata…`;
  const progressValue = determinate
    ? Math.min(100, (processed / total) * 100)
    : undefined;
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" color="info.main">
        {progressLabel}
      </Typography>
      <LinearProgress
        variant={determinate ? "determinate" : "indeterminate"}
        value={progressValue}
        sx={{ mt: 1 }}
      />
    </Box>
  );
};

/** @param {import("./use-romm-sync-monitor").RommSyncMonitorState["platformStatuses"][string]["result"]} result Sync result. @returns {string} Result label. */
const getPlatformResultLabel = (result) => {
  if (result === null || result === undefined) {
    return "Full library metadata sync complete.";
  }
  return `Metadata sync complete: ${result.total_games ?? 0} indexed (${result.games_added ?? 0} added, ${result.games_updated ?? 0} updated, ${result.games_deleted ?? 0} removed).`;
};

/** @param {{status: import("./use-romm-sync-monitor").RommSyncMonitorState["platformStatuses"][string]}} props Result status properties. */
const SuccessfulPlatformStatus = ({ status }) => (
  <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>
    {getPlatformResultLabel(status.result)}
  </Typography>
);

/** @param {{status: import("./use-romm-sync-monitor").RommSyncMonitorState["platformStatuses"][string]|undefined, name: string, active: boolean}} props Platform status. */
const PlatformStatus = ({ active, name, status }) => {
  if (status?.state === "syncing") {
    return <SyncingPlatformStatus name={name} status={status} />;
  }
  if (status?.state === "error") {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {status.error}
      </Alert>
    );
  }
  if (status?.state === "success") {
    return <SuccessfulPlatformStatus status={status} />;
  }
  if (active) {
    return (
      <Typography variant="body2" color="info.main" sx={{ mt: 2 }}>
        Full library metadata sync is in progress.
      </Typography>
    );
  }
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
      Ready to sync library metadata.
    </Typography>
  );
};

/** @param {{platform: import("./use-romm-sync-monitor").RommSyncMonitorState["platforms"][number], status: import("./use-romm-sync-monitor").RommSyncMonitorState["platformStatuses"][string]|undefined, busy: boolean, onSync: (platformId: number) => void}} props Platform card properties. */
const PlatformCard = ({ busy, onSync, platform, status }) => {
  const failed = status?.state === "error";
  const actionLabel = failed ? "Retry" : "Sync";
  return (
    <Paper
      data-testid={`romm-sync-platform-${platform.romm_platform_id}`}
      sx={{ p: 2.5 }}
      variant="outlined"
    >
      <Stack
        direction={{ sm: "row", xs: "column" }}
        spacing={1.5}
        sx={{
          alignItems: { sm: "center", xs: "stretch" },
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6" component="h2">
          {platform.name}
        </Typography>
        <Button
          aria-label={`${failed ? "Retry" : "Sync"} ${platform.name} library metadata`}
          disabled={busy}
          onClick={() => {
            onSync(platform.romm_platform_id);
          }}
          startIcon={failed ? <RefreshIcon /> : <CloudSyncIcon />}
          variant={failed ? "outlined" : "contained"}
        >
          {actionLabel}
        </Button>
      </Stack>
      <Divider sx={{ my: 2 }} />
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { sm: "repeat(3, 1fr)", xs: "repeat(2, 1fr)" },
        }}
      >
        <OverviewMetric label="Server ROMs" value={platform.server_games} />
        <OverviewMetric
          label="Indexed RomM entries"
          value={platform.local_games}
        />
        <OverviewMetric
          label="Downloaded locally"
          value={platform.installed_games}
        />
      </Box>
      <PlatformStatus active={busy} name={platform.name} status={status} />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 1.5 }}
      >
        Metadata/library sync only. ROM downloading and save synchronization are
        separate.
      </Typography>
    </Paper>
  );
};

/** @param {{monitor: RommSyncMonitorState, immersive: boolean, isBusy: boolean, onBack?: () => void}} props Monitor header properties. */
const MonitorHeader = ({ immersive, isBusy, monitor, onBack }) => (
  <Stack
    direction={{ sm: "row", xs: "column" }}
    spacing={2}
    sx={{
      alignItems: { sm: "center", xs: "stretch" },
      justifyContent: "space-between",
      mb: 2,
    }}
  >
    <Box>
      {onBack ? (
        <Button
          onClick={onBack}
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 1, ml: -1, textTransform: "none" }}
        >
          Back to library
        </Button>
      ) : null}
      <Typography component="h1" variant={immersive ? "h3" : "h4"}>
        RomM library sync
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        Reconcile RomM metadata and library entries without downloading ROMs or
        syncing saves.
      </Typography>
    </Box>
    <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
      <Button
        aria-label="Refresh RomM sync overview"
        disabled={monitor.loading || isBusy}
        onClick={() => {
          void monitor.loadOverview();
        }}
        startIcon={<RefreshIcon />}
        variant="outlined"
      >
        Refresh
      </Button>
      <Button
        disabled={isBusy}
        onClick={() => {
          void monitor.syncAll();
        }}
        startIcon={<CloudSyncIcon />}
        variant="contained"
      >
        {monitor.syncAllStatus.state === "error"
          ? "Retry sync all"
          : "Sync all"}
      </Button>
    </Stack>
  </Stack>
);

/** @param {RommSyncMonitorState["syncAllStatus"]} status Full-sync status. @returns {string} Completion label. */
const getFullSyncResultLabel = (status) =>
  status.totalGames === null
    ? "Full library metadata sync complete."
    : `Full library metadata sync complete: ${status.totalGames} RomM entries indexed.`;

/** @param {{monitor: RommSyncMonitorState}} props Monitor alerts properties. */
const MonitorAlerts = ({ monitor }) => {
  if (monitor.error !== null && monitor.error !== "") {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {monitor.error}
      </Alert>
    );
  }
  if (monitor.syncAllStatus.state === "syncing") {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Syncing full RomM library metadata. This does not download ROM files or
        synchronize saves.
      </Alert>
    );
  }
  if (monitor.syncAllStatus.state === "success") {
    return (
      <Alert severity="success" sx={{ mb: 2 }}>
        {getFullSyncResultLabel(monitor.syncAllStatus)} ROM downloading and save
        synchronization were not performed.
      </Alert>
    );
  }
  if (monitor.syncAllStatus.state === "error") {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Full library metadata sync failed: {monitor.syncAllStatus.error}
      </Alert>
    );
  }
  return null;
};

/** @param {{monitor: RommSyncMonitorState, isBusy: boolean}} props Monitor body properties. */
const MonitorBody = ({ isBusy, monitor }) => {
  if (!monitor.platforms.length && monitor.loading) {
    return (
      <Stack spacing={2} sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress />
        <Typography color="text.secondary">
          Loading RomM library overview…
        </Typography>
      </Stack>
    );
  }
  if (!monitor.platforms.length && !monitor.loading && monitor.error === null) {
    return (
      <Alert severity="info">
        Connect to RomM in Settings to view its platform library, then return
        here to sync metadata.
      </Alert>
    );
  }
  return (
    <Stack spacing={2}>
      {monitor.platforms.map((platform) => (
        <PlatformCard
          busy={isBusy}
          key={platform.romm_platform_id}
          onSync={(platformId) => {
            void monitor.syncPlatform(platformId);
          }}
          platform={platform}
          status={monitor.platformStatuses[String(platform.romm_platform_id)]}
        />
      ))}
    </Stack>
  );
};

/** @param {{monitor: RommSyncMonitorState, immersive?: boolean, onBack?: () => void}} props Monitor properties. */
const RommSyncMonitor = ({ immersive = false, monitor, onBack }) => {
  const isBusy = monitor.activeOperation !== null;
  return (
    <Box
      data-testid="romm-sync-monitor"
      sx={{
        maxWidth: immersive ? 1280 : undefined,
        mx: "auto",
        p: { lg: immersive ? 5 : 4, md: 3, xs: 2 },
        width: "100%",
      }}
    >
      <MonitorHeader
        immersive={immersive}
        isBusy={isBusy}
        monitor={monitor}
        onBack={onBack}
      />
      <MonitorAlerts monitor={monitor} />
      <MonitorBody isBusy={isBusy} monitor={monitor} />
    </Box>
  );
};

export default RommSyncMonitor;
