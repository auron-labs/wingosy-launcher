import { useEffect, useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import Stack from "@mui/material/Stack";
import KeyboardHint from "../KeyboardHint";

/**
 * Argosy-style full-screen screenshot viewer (ScreenshotViewerOverlay).
 */
export default function ScreenshotLightbox({ open, onClose, urls, getSrc, index, onIndexChange }) {
  const n = urls?.length ?? 0;
  const safeIndex = n ? Math.min(Math.max(0, index), n - 1) : 0;
  const src = n ? getSrc(urls[safeIndex]) : null;

  const goPrev = useCallback(() => {
    if (n < 2) return;
    onIndexChange((safeIndex - 1 + n) % n);
  }, [n, safeIndex, onIndexChange]);

  const goNext = useCallback(() => {
    if (n < 2) return;
    onIndexChange((safeIndex + 1) % n);
  }, [n, safeIndex, onIndexChange]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  return (
    <Dialog
      open={open && Boolean(src)}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            bgcolor: "rgba(0,0,0,0.94)",
            backgroundImage: "none",
          },
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            position: "absolute",
            top: 20,
            left: 20,
            alignItems: "center",
            color: "#fff",
            zIndex: 2,
          }}
        >
          {n > 1 ? (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <KeyboardHint sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.35)" }}>← / →</KeyboardHint>
              <Typography variant="body2">Navigate</Typography>
            </Stack>
          ) : null}
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <KeyboardHint sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.35)" }}>Esc</KeyboardHint>
            <Typography variant="body2">Close</Typography>
          </Stack>
        </Stack>

        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", top: 12, right: 12, color: "#fff", zIndex: 2 }}
          aria-label="Close"
        >
          <CloseIcon />
        </IconButton>

        {n > 1 && (
          <>
            <IconButton
              onClick={goPrev}
              sx={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#fff",
                bgcolor: "rgba(255,255,255,0.08)",
                zIndex: 2,
                "&:hover": { bgcolor: "rgba(255,255,255,0.16)" },
              }}
              aria-label="Previous screenshot"
            >
              <ChevronLeftIcon sx={{ fontSize: 40 }} />
            </IconButton>
            <IconButton
              onClick={goNext}
              sx={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#fff",
                bgcolor: "rgba(255,255,255,0.08)",
                zIndex: 2,
                "&:hover": { bgcolor: "rgba(255,255,255,0.16)" },
              }}
              aria-label="Next screenshot"
            >
              <ChevronRightIcon sx={{ fontSize: 40 }} />
            </IconButton>
          </>
        )}

        <Box
          component="img"
          src={src || undefined}
          alt=""
          sx={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            borderRadius: 1,
          }}
        />

        {n > 1 ? (
          <Typography
            variant="caption"
            sx={{
              position: "absolute",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {safeIndex + 1} / {n}
          </Typography>
        ) : null}
      </Box>
    </Dialog>
  );
}
