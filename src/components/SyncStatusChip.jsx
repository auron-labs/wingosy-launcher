import CloudIcon from "@mui/icons-material/Cloud";
import CircularProgress from "@mui/material/CircularProgress";

import StatusChip from "./game/StatusChip";

const STATUS_DETAILS = {
  checking: {
    color: "info",
    helpText: () => "Checking the RomM server connection.",
    icon: <CircularProgress size={16} thickness={5} />,
    label: "Checking",
    scope: "RomM",
  },
  "downloaded-not-synced": {
    color: "warning",
    helpText: () =>
      "This ROM is stored locally, but its download has not been synchronized with RomM.",
    icon: <CloudIcon fontSize="small" />,
    label: "Downloaded, not synced",
    scope: "Sync",
  },
  "not-configured": {
    color: "default",
    helpText: () => "Connect to a RomM server to sync this library.",
    icon: <CloudIcon fontSize="small" />,
    label: "Not configured",
    scope: "RomM",
  },
  offline: {
    color: "warning",
    helpText: (serverUrl) =>
      `RomM is offline or rejected the session${serverUrl ? ` at ${serverUrl}` : ""}.`,
    icon: <CloudIcon fontSize="small" />,
    label: "Offline",
    scope: "RomM",
  },
  online: {
    color: "success",
    helpText: (serverUrl) =>
      `Connected to RomM${serverUrl ? ` at ${serverUrl}` : ""}. Library sync is available.`,
    icon: <CloudIcon fontSize="small" />,
    label: "Connected",
    scope: "RomM",
  },
  "remote-only": {
    color: "info",
    helpText: () =>
      "This game is available from RomM but is not downloaded to this device.",
    icon: <CloudIcon fontSize="small" />,
    label: "Cloud only",
    scope: "Sync",
  },
  synced: {
    color: "success",
    helpText: () => "This local download is synchronized with RomM.",
    icon: <CloudIcon fontSize="small" />,
    label: "Synced",
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
