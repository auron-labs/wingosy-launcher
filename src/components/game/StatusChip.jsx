import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

/**
 * The shared compact treatment for game metadata and sync state badges.
 * A help message adds a visible information affordance and an accessible tooltip.
 */
export default function StatusChip({
  label,
  helpText = null,
  icon = null,
  showHelpIcon = true,
  sx = {},
  ...props
}) {
  const chip = (
    <Chip
      {...props}
      label={label}
      icon={helpText && showHelpIcon ? <InfoOutlinedIcon fontSize="small" /> : icon}
      size="small"
      variant="outlined"
      title={helpText}
      sx={{
        bgcolor: "action.hover",
        borderColor: "divider",
        minHeight: 28,
        ...sx,
      }}
    />
  );

  if (!helpText) return chip;

  return (
    <Tooltip title={helpText} arrow>
      <span>{chip}</span>
    </Tooltip>
  );
}
