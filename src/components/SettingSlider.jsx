import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";

/**
 * Settings slider with a persistent value readout. The readout stays visible
 * while the slider is disabled so the saved value remains discoverable.
 */
/** @param {import("@mui/material/Slider").SliderProps & {label: string, value: number|number[], formatValue?: (currentValue: number) => string, valueTestId?: string, sliderSx?: import("@mui/material/Slider").SliderProps["sx"], sliderSlotProps?: import("@mui/material/Slider").SliderProps["slotProps"]}} props Slider presentation and input props. */
const SettingSlider = ({
  label,
  value,
  formatValue = String,
  valueTestId,
  sliderSx,
  sliderSlotProps,
  ...sliderProps
}) => {
  const displayValue = Array.isArray(value) ? value[0] : value;

  return (
    <Box>
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          gap: 2,
          justifyContent: "space-between",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            bgcolor: "action.hover",
            borderRadius: 1,
            color:
              sliderProps.disabled === true ? "text.disabled" : "text.primary",
            fontWeight: 600,
            minWidth: 48,
            px: 1,
            py: 0.25,
            textAlign: "right",
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
};

export default SettingSlider;
