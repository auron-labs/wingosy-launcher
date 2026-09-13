import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect } from "react";

import KeyboardHint from "../keyboard-hint";

/** @param {{count: number, onClose: () => void}} props Renders viewer hints and close action. */
const LightboxToolbar = ({ count, onClose }) => (
  <>
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: "center",
        color: "#fff",
        left: 20,
        position: "absolute",
        top: 20,
        zIndex: 2,
      }}
    >
      {count > 1 && (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <KeyboardHint
            sx={{ borderColor: "rgba(255,255,255,0.35)", color: "#fff" }}
          >
            ← / →
          </KeyboardHint>
          <Typography variant="body2">Navigate</Typography>
        </Stack>
      )}
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
        <KeyboardHint
          sx={{ borderColor: "rgba(255,255,255,0.35)", color: "#fff" }}
        >
          Esc
        </KeyboardHint>
        <Typography variant="body2">Close</Typography>
      </Stack>
    </Stack>
    <IconButton
      aria-label="Close"
      onClick={onClose}
      sx={{
        color: "#fff",
        position: "absolute",
        right: 12,
        top: 12,
        zIndex: 2,
      }}
    >
      <CloseIcon />
    </IconButton>
  </>
);

/** @param {{count: number, onPrevious: () => void, onNext: () => void}} props Renders previous/next controls. */
const LightboxNavigation = ({ count, onNext, onPrevious }) =>
  count > 1 ? (
    <>
      <IconButton
        aria-label="Previous screenshot"
        onClick={onPrevious}
        sx={{
          "&:hover": { bgcolor: "rgba(255,255,255,0.16)" },
          bgcolor: "rgba(255,255,255,0.08)",
          color: "#fff",
          left: 8,
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 2,
        }}
      >
        <ChevronLeftIcon sx={{ fontSize: 40 }} />
      </IconButton>
      <IconButton
        aria-label="Next screenshot"
        onClick={onNext}
        sx={{
          "&:hover": { bgcolor: "rgba(255,255,255,0.16)" },
          bgcolor: "rgba(255,255,255,0.08)",
          color: "#fff",
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 2,
        }}
      >
        <ChevronRightIcon sx={{ fontSize: 40 }} />
      </IconButton>
    </>
  ) : null;

/** @param {{goNext: () => void, goPrevious: () => void, onClose: () => void, open: boolean}} options Keyboard navigation properties. */
const useLightboxKeyboard = ({ goNext, goPrevious, onClose, open }) => {
  useEffect(() => {
    /** @param {KeyboardEvent} event Keyboard input. */
    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowLeft") {
        goPrevious();
      }
      if (event.key === "ArrowRight") {
        goNext();
      }
    };
    if (!open) {
      return () => {
        window.removeEventListener("keydown", onKey);
      };
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [goNext, goPrevious, onClose, open]);
};

/**
 * Full-screen screenshot viewer.
 * @param {object} props Lightbox properties.
 * @param {boolean} props.open Whether the viewer is visible.
 * @param {() => void} props.onClose Close callback.
 * @param {string[]} props.urls Screenshot URLs.
 * @param {(url: string) => string|null} props.getSrc URL resolver.
 * @param {number} props.index Current image index.
 * @param {(index: number|((current: number) => number)) => void} props.onIndexChange Index callback.
 */
const ScreenshotLightbox = ({
  getSrc,
  index,
  onClose,
  onIndexChange,
  open,
  urls,
}) => {
  const count = urls.length;
  const safeIndex = count > 0 ? Math.min(Math.max(0, index), count - 1) : 0;
  const src = count > 0 ? getSrc(urls[safeIndex]) : null;
  const goPrevious = useCallback(() => {
    if (count > 1) {
      onIndexChange((safeIndex - 1 + count) % count);
    }
  }, [count, onIndexChange, safeIndex]);
  const goNext = useCallback(() => {
    if (count > 1) {
      onIndexChange((safeIndex + 1) % count);
    }
  }, [count, onIndexChange, safeIndex]);
  useLightboxKeyboard({ goNext, goPrevious, onClose, open });
  return (
    <Dialog
      fullScreen
      onClose={onClose}
      open={open && src !== null}
      slotProps={{
        paper: { sx: { backgroundImage: "none", bgcolor: "rgba(0,0,0,0.94)" } },
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          p: 2,
          position: "relative",
          width: "100%",
        }}
      >
        <LightboxToolbar count={count} onClose={onClose} />
        <LightboxNavigation
          count={count}
          onNext={goNext}
          onPrevious={goPrevious}
        />
        <Box
          alt=""
          component="img"
          src={src ?? ""}
          sx={{
            borderRadius: 1,
            maxHeight: "100%",
            maxWidth: "100%",
            objectFit: "contain",
          }}
        />
        {count > 1 && (
          <Typography
            sx={{
              bottom: 24,
              color: "rgba(255,255,255,0.7)",
              left: "50%",
              position: "absolute",
              transform: "translateX(-50%)",
            }}
            variant="caption"
          >
            {safeIndex + 1} / {count}
          </Typography>
        )}
      </Box>
    </Dialog>
  );
};

export default ScreenshotLightbox;
