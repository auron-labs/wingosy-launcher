import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";

const EMPTY_SX = {};

/**
 * The shared compact treatment for game metadata and sync state badges.
 * A help message adds a visible information affordance and an accessible tooltip.
 */
/** @param {{label: string, helpText?: string|null, icon?: import("react").ReactElement|null, showHelpIcon?: boolean, sx?: object, role?: string, component?: string, ["aria-label"]?: string, color?: "default"|"error"|"info"|"primary"|"secondary"|"success"|"warning"}} props Status chip properties. */
const StatusChip = ({
  label,
  helpText = null,
  icon = null,
  showHelpIcon = true,
  sx = EMPTY_SX,
  ...props
}) => {
  const chip = (
    <Chip
      {...props}
      label={label}
      icon={
        helpText !== null && helpText !== "" && showHelpIcon ? (
          <InfoOutlinedIcon fontSize="small" />
        ) : (
          (icon ?? undefined)
        )
      }
      size="small"
      variant="outlined"
      title={helpText ?? undefined}
      sx={{
        bgcolor: "action.hover",
        borderColor: "divider",
        minHeight: 28,
        ...sx,
      }}
    />
  );

  if (helpText === null || helpText === "") {
    return chip;
  }

  return (
    <Tooltip title={helpText} arrow>
      <span>{chip}</span>
    </Tooltip>
  );
};

export default StatusChip;
