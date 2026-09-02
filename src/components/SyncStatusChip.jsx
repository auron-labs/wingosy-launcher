import CircularProgress from "@mui/material/CircularProgress";
import CloudIcon from "@mui/icons-material/Cloud";
import StatusChip from "./game/StatusChip";

const STATUS_DETAILS = {
  online: {
    label: "Connected",
    color: "success",
    icon: <CloudIcon fontSize="small" />,
    helpText: (serverUrl) =>
      `Connected to RomM${serverUrl ? ` at ${serverUrl}` : ""}. Library sync is available.`,
    scope: "RomM",
  },
  checking: {
    label: "Checking",
    color: "info",
    icon: <CircularProgress size={16} thickness={5} />,
    helpText: () => "Checking the RomM server connection.",
    scope: "RomM",
  },
  offline: {
    label: "Offline",
    color: "warning",
    icon: <CloudIcon fontSize="small" />,
    helpText: (serverUrl) =>
      `RomM is offline or rejected the session${serverUrl ? ` at ${serverUrl}` : ""}.`,
    scope: "RomM",
  },
  "not-configured": {
    label: "Not configured",
    color: "default",
    icon: <CloudIcon fontSize="small" />,
    helpText: () => "Connect to a RomM server to sync this library.",
    scope: "RomM",
  },
  synced: {
    label: "Synced",
    color: "success",
    icon: <CloudIcon fontSize="small" />,
    helpText: () => "This local download is synchronized with RomM.",
    scope: "Sync",
  },
  "remote-only": {
    label: "Cloud only",
    color: "info",
    icon: <CloudIcon fontSize="small" />,
    helpText: () => "This game is available from RomM but is not downloaded to this device.",
    scope: "Sync",
  },
  "downloaded-not-synced": {
    label: "Downloaded, not synced",
    color: "warning",
    icon: <CloudIcon fontSize="small" />,
    helpText: () =>
      "This ROM is stored locally, but its download has not been synchronized with RomM.",
    scope: "Sync",
  },
};

/** Shared labeled status treatment for RomM connection health and game sync state. */
export default function SyncStatusChip({ status, serverUrl = "", ...props }) {
  const details = STATUS_DETAILS[status] || STATUS_DETAILS["not-configured"];
  const helpText = details.helpText(serverUrl);

  return (
    <StatusChip
      {...props}
      role="status"
      aria-label={`${details.scope} status: ${details.label}`}
      label={details.label}
      color={details.color}
      icon={details.icon}
      helpText={helpText}
      showHelpIcon={false}
    />
  );
}
