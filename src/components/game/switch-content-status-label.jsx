import Typography from "@mui/material/Typography";

import { getSwitchContentStatusLabel } from "./game-details-utils";

/** @typedef {import("./game-details-types").GameDetailsSwitchContentStatus} GameDetailsSwitchContentStatus */

/** @param {{status: GameDetailsSwitchContentStatus|null, sx?: object}} props Read-only content status properties. */
export const SwitchContentStatusLabel = ({ status, sx }) => {
  const label = getSwitchContentStatusLabel(status);
  if (label === null) {
    return null;
  }
  return (
    <Typography data-testid="switch-content-status" sx={sx} variant="caption">
      {label}
    </Typography>
  );
};
