import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ScreenshotLightbox from "./ScreenshotLightbox";

/**
 * Horizontal strip + opens Argosy-style full-screen viewer on click.
 * When RomM returns no screenshot URLs, the section still shows with an empty-state hint.
 */
export default function GameScreenshotsSection({ urls, getMediaSrc, isRommGame = true }) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (list.length === 0) {
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
          Screenshots
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          {isRommGame ? (
            <>
              <strong>No screenshots.</strong> Many titles never get screenshot URLs from RomM or IGDB—that
              is normal. If you expect artwork, try <strong>Refresh game data</strong> from the game menu, or
              sync under <strong>Settings</strong> → <strong>RomM</strong> (Sync library). Otherwise nothing is
              wrong.
            </>
          ) : (
            <>
              Screenshots here come from RomM metadata. Games added only from a local folder don’t have a
              RomM gallery yet.
            </>
          )}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600 }}>
        Screenshots
      </Typography>
      <Box
        data-testid="game-screenshots-grid"
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 1.5,
        }}
      >
        {list.map((url, i) => {
          const src = getMediaSrc(url);
          if (!src) return null;
          return (
            <Tooltip key={`${url}-${i}`} title="View larger" arrow>
              <ButtonBase
                aria-label={`View screenshot ${i + 1} larger`}
                onClick={() => {
                  setLightboxIndex(i);
                  setLightboxOpen(true);
                }}
                sx={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16 / 9",
                  borderRadius: 2,
                  overflow: "hidden",
                  bgcolor: "action.hover",
                  border: 1,
                  borderColor: "divider",
                  "&:hover .screenshot-zoom": { opacity: 1 },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: 2,
                  },
                }}
              >
                <Box
                  component="img"
                  src={src}
                  alt={`Screenshot ${i + 1}`}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  sx={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
                <Box
                  className="screenshot-zoom"
                  sx={{
                    position: "absolute",
                    right: 8,
                    bottom: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    color: "common.white",
                    bgcolor: "rgba(0, 0, 0, 0.68)",
                    opacity: 0.86,
                    transition: "opacity 0.15s",
                  }}
                >
                  <ZoomInIcon fontSize="small" />
                </Box>
              </ButtonBase>
            </Tooltip>
          );
        })}
      </Box>

      <ScreenshotLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        urls={list}
        getSrc={getMediaSrc}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
      />
    </Box>
  );
}
