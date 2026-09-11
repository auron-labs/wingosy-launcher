import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { invoke } from "@tauri-apps/api/core";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import SettingSlider from "./SettingSlider";

/** @typedef {{display?: {accent_hue?: number|null}}} AccentConfig */

/**
 * @param {number|null} hue Selected accent, or the default palette.
 * @param {string} errorMessage Context for a failed save.
 */
const persistHue = async (hue, errorMessage) => {
  try {
    /** @type {AccentConfig} */
    const config = await invoke("get_config");
    config.display ??= {};
    config.display.accent_hue = hue;
    await invoke("save_config", { config });
  } catch (error) {
    console.error(errorMessage, error);
  }
};

/**
 * @param {number|null} accentHue Saved accent.
 * @param {number} defaultHue Default palette hue.
 */
const useHuePreview = (accentHue, defaultHue) => {
  const initial = accentHue ?? defaultHue;
  const [preview, setPreview] = useState({
    accentHue,
    defaultHue,
    value: initial,
  });
  /** @type {import("react").RefObject<number|null>} */
  const rafRef = useRef(null);
  const pendingHueRef = useRef(initial);

  if (preview.accentHue !== accentHue || preview.defaultHue !== defaultHue) {
    setPreview({ accentHue, defaultHue, value: initial });
  }

  useEffect(() => {
    pendingHueRef.current = accentHue ?? defaultHue;
  }, [accentHue, defaultHue]);

  const setHue = useCallback(
    /** @param {number} value Immediate preview hue. */
    (value) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingHueRef.current = value;
      setPreview((current) => ({ ...current, value }));
    },
    []
  );

  const schedulePreview = useCallback(
    /** @param {number} hue Latest value during a drag. */
    (hue) => {
      pendingHueRef.current = hue;
      if (rafRef.current !== null) {
        return;
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const value = pendingHueRef.current;
        setPreview((current) => ({ ...current, value }));
      });
    },
    []
  );

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    []
  );

  return { previewHue: preview.value, schedulePreview, setHue };
};

/** @param {{previewHue: number, thumbColor: string, onChange: import("@mui/material/Slider").SliderProps["onChange"], onCommit: import("@mui/material/Slider").SliderProps["onChangeCommitted"]}} props Slider preview and input handlers. */
const HueSliderTrack = ({ previewHue, thumbColor, onChange, onCommit }) => (
  <>
    <Box
      sx={{
        background: `linear-gradient(to right, 
            hsl(0, 70%, 50%), 
            hsl(60, 70%, 50%), 
            hsl(120, 70%, 50%), 
            hsl(180, 70%, 50%), 
            hsl(240, 70%, 50%), 
            hsl(300, 70%, 50%), 
            hsl(360, 70%, 50%)
          )`,
        borderRadius: 2,
        height: 24,
        mb: 1,
      }}
    />
    <SettingSlider
      label="Accent hue"
      value={previewHue}
      formatValue={(value) => `${Math.round(value)}°`}
      valueTestId="accent-hue-value"
      min={0}
      max={360}
      step={1}
      onChange={onChange}
      onChangeCommitted={onCommit}
      sliderSlotProps={{
        thumb: {
          style: {
            backgroundColor: thumbColor,
            border: "2px solid #fff",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            height: 20,
            width: 20,
          },
        },
      }}
      sliderSx={{
        "& .MuiSlider-rail": { opacity: 0 },
        "& .MuiSlider-thumb::before": { display: "none" },
        "& .MuiSlider-track": { opacity: 0 },
        py: 0.5,
      }}
    />
  </>
);

/** @param {{thumbColor: string, defaultHue: number, onReset: () => void}} props Current and default accent comparison. */
const HueSwatches = ({ thumbColor, defaultHue, onReset }) => (
  <Box
    sx={{
      alignItems: "flex-start",
      display: "flex",
      gap: 2,
      justifyContent: "space-between",
      mt: 1,
    }}
  >
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
      }}
    >
      <Box
        style={{ backgroundColor: thumbColor }}
        sx={{
          border: "2px solid rgba(255,255,255,0.2)",
          borderRadius: 1,
          height: 24,
          width: 24,
        }}
      />
      <Typography variant="caption" color="text.secondary">
        Current accent
      </Typography>
      <Box
        aria-hidden="true"
        sx={{
          bgcolor: `hsl(${Math.round(defaultHue)}, 70%, 50%)`,
          border: "2px solid rgba(255,255,255,0.2)",
          borderRadius: 1,
          height: 24,
          width: 24,
        }}
      />
      <Typography variant="caption" color="text.secondary">
        Default (Indigo)
      </Typography>
    </Box>
    <Button size="small" variant="contained" onClick={onReset}>
      Reset to Default
    </Button>
  </Box>
);

/**
 * Isolated control: dragging batches previews without re-rendering Settings.
 * @param {{accentHue: number|null, setAccentHue: (value: number|null) => void, defaultHue?: number}} props Saved accent and update callback.
 */
const AccentHueSlider = ({ accentHue, setAccentHue, defaultHue = 235 }) => {
  const { previewHue, schedulePreview, setHue } = useHuePreview(
    accentHue,
    defaultHue
  );
  const thumbColor = `hsl(${Math.round(previewHue)}, 70%, 50%)`;
  const handleChangeCommitted = useCallback(
    /**
     * @param {Event|import("react").SyntheticEvent} _ Slider event.
     * @param {number|number[]} newValue Committed hue.
     */
    (_, newValue) => {
      const hue = Array.isArray(newValue) ? newValue[0] : newValue;
      setHue(hue);
      setAccentHue(hue);
      void persistHue(hue, "Failed to save accent hue:");
    },
    [setHue, setAccentHue]
  );
  const handleReset = useCallback(() => {
    setHue(defaultHue);
    setAccentHue(null);
    void persistHue(null, "Failed to reset accent:");
  }, [defaultHue, setHue, setAccentHue]);

  return (
    <Box sx={{ px: 1 }}>
      <HueSliderTrack
        previewHue={previewHue}
        thumbColor={thumbColor}
        onChange={(_, value) => {
          schedulePreview(Array.isArray(value) ? value[0] : value);
        }}
        onCommit={handleChangeCommitted}
      />
      <HueSwatches
        defaultHue={defaultHue}
        thumbColor={thumbColor}
        onReset={handleReset}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 1 }}
      >
        {accentHue === null
          ? "The Default (Indigo) swatch is the built-in accent. Move the slider to choose a custom hue."
          : "The slider overrides the Default (Indigo) swatch. Reset restores the built-in accent."}
      </Typography>
    </Box>
  );
};

export default memo(AccentHueSlider);
