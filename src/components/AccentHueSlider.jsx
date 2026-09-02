import { memo, useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { invoke } from "@tauri-apps/api/core";
import SettingSlider from "./SettingSlider";

/**
 * Isolated accent hue control so dragging does not re-render the full Settings screen.
 * Batches visual updates to one setState per animation frame during drag.
 */
function AccentHueSlider({ accentHue, setAccentHue, defaultHue = 235 }) {
  const initial = accentHue ?? defaultHue;
  const [previewHue, setPreviewHue] = useState(initial);
  const rafRef = useRef(null);
  const pendingHueRef = useRef(initial);

  useEffect(() => {
    const next = accentHue ?? defaultHue;
    pendingHueRef.current = next;
    setPreviewHue(next);
  }, [accentHue, defaultHue]);

  const flushPreview = useCallback(() => {
    rafRef.current = null;
    setPreviewHue(pendingHueRef.current);
  }, []);

  const schedulePreview = useCallback(
    (hue) => {
      pendingHueRef.current = hue;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushPreview);
      }
    },
    [flushPreview]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const thumbColor = `hsl(${Math.round(previewHue)}, 70%, 50%)`;

  const persistHue = useCallback(
    async (hue) => {
      try {
        const cfg = await invoke("get_config");
        cfg.display = cfg.display || {};
        cfg.display.accent_hue = hue;
        await invoke("save_config", { config: cfg });
      } catch (err) {
        console.error("Failed to save accent hue:", err);
      }
    },
    []
  );

  const handleChangeCommitted = useCallback(
    async (_, newValue) => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingHueRef.current = newValue;
      setPreviewHue(newValue);
      setAccentHue(newValue);
      await persistHue(newValue);
    },
    [persistHue, setAccentHue]
  );

  const handleReset = useCallback(async () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingHueRef.current = defaultHue;
    setPreviewHue(defaultHue);
    setAccentHue(null);
    try {
      const cfg = await invoke("get_config");
      cfg.display = cfg.display || {};
      cfg.display.accent_hue = null;
      await invoke("save_config", { config: cfg });
    } catch (err) {
      console.error("Failed to reset accent:", err);
    }
  }, [defaultHue, setAccentHue]);

  return (
    <Box sx={{ px: 1 }}>
      <Box
        sx={{
          height: 24,
          borderRadius: 2,
          background: `linear-gradient(to right, 
            hsl(0, 70%, 50%), 
            hsl(60, 70%, 50%), 
            hsl(120, 70%, 50%), 
            hsl(180, 70%, 50%), 
            hsl(240, 70%, 50%), 
            hsl(300, 70%, 50%), 
            hsl(360, 70%, 50%)
          )`,
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
        onChange={(_, v) => schedulePreview(v)}
        onChangeCommitted={handleChangeCommitted}
        sliderSlotProps={{
          thumb: {
            style: {
              width: 20,
              height: 20,
              backgroundColor: thumbColor,
              border: "2px solid #fff",
              boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            },
          },
        }}
        sliderSx={{
          py: 0.5,
          "& .MuiSlider-track": { opacity: 0 },
          "& .MuiSlider-rail": { opacity: 0 },
          "& .MuiSlider-thumb::before": { display: "none" },
        }}
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mt: 1 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          <Box
            style={{ backgroundColor: thumbColor }}
            sx={{
              width: 24,
              height: 24,
              borderRadius: 1,
              border: "2px solid rgba(255,255,255,0.2)",
            }}
          />
          <Typography variant="caption" color="text.secondary">Current accent</Typography>
          <Box
            aria-hidden="true"
            sx={{
              width: 24,
              height: 24,
              borderRadius: 1,
              bgcolor: `hsl(${Math.round(defaultHue)}, 70%, 50%)`,
              border: "2px solid rgba(255,255,255,0.2)",
            }}
          />
          <Typography variant="caption" color="text.secondary">Default (Indigo)</Typography>
        </Box>
        <Button size="small" variant="contained" onClick={handleReset}>
          Reset to Default
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        {accentHue === null
          ? "The Default (Indigo) swatch is the built-in accent. Move the slider to choose a custom hue."
          : "The slider overrides the Default (Indigo) swatch. Reset restores the built-in accent."}
      </Typography>
    </Box>
  );
}

export default memo(AccentHueSlider);
