import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";

/**
 * Settings slider with a persistent value readout. The readout stays visible
 * while the slider is disabled so the saved value remains discoverable.
 */
export default function SettingSlider({
  label,
  value,
  formatValue = (currentValue) => String(currentValue),
  valueTestId = undefined,
  sliderSx = undefined,
  sliderSlotProps = undefined,
  ...sliderProps
}) {
  const displayValue = Array.isArray(value) ? value[0] : value;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            minWidth: 48,
            px: 1,
            py: 0.25,
            borderRadius: 1,
            textAlign: "right",
            fontWeight: 600,
            color: sliderProps.disabled ? "text.disabled" : "text.primary",
            bgcolor: "action.hover",
          }}
          data-testid={valueTestId}
        >
          {formatValue(displayValue)}
        </Typography>
      </Box>
      <Slider
        {...sliderProps}
        aria-label={label}
        value={value}
        slotProps={sliderSlotProps}
        sx={sliderSx}
      />
    </Box>
  );
}
