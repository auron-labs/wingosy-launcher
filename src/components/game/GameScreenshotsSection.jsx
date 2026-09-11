import ZoomInIcon from "@mui/icons-material/ZoomIn";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import ScreenshotLightbox from "./ScreenshotLightbox";

const EMPTY_URLS = [];

/** @param {{url: string, index: number, src: string, onOpen: (index: number) => void}} props Renders one screenshot card. */
const ScreenshotCard = ({ index, onOpen, src, url }) => (
  <Tooltip arrow key={`${url}-${index}`} title="View larger">
    <ButtonBase
      aria-label={`View screenshot ${index + 1} larger`}
      onClick={() => onOpen(index)}
      sx={{
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
        "&:hover .screenshot-zoom": { opacity: 1 },
        aspectRatio: "16 / 9",
        bgcolor: "action.hover",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      <Box
        alt={`Screenshot ${index + 1}`}
        component="img"
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        src={src}
        sx={{ height: "100%", objectFit: "contain", width: "100%" }}
      />
      <Box
        className="screenshot-zoom"
        sx={{
          alignItems: "center",
          bgcolor: "rgba(0, 0, 0, 0.68)",
          borderRadius: "50%",
          bottom: 8,
          color: "common.white",
          display: "flex",
          height: 36,
          justifyContent: "center",
          opacity: 0.86,
          position: "absolute",
          right: 8,
          transition: "opacity 0.15s",
          width: 36,
        }}
      >
        <ZoomInIcon fontSize="small" />
      </Box>
    </ButtonBase>
  </Tooltip>
);

/** @param {{isRommGame: boolean}} props Renders the no-screenshot explanation. */
const ScreenshotEmptyState = ({ isRommGame }) => (
  <Box sx={{ mb: 3 }}>
    <Typography color="text.secondary" sx={{ fontWeight: 600, mb: 1 }} variant="subtitle2">
      Screenshots
    </Typography>
    <Typography color="text.secondary" sx={{ lineHeight: 1.7 }} variant="body2">
      {isRommGame ? (
        <>
          <strong>No screenshots.</strong> Many titles never get screenshot URLs
          from RomM or IGDB—that is normal. If you expect artwork, try{" "}
          <strong>Refresh game data</strong> from the game menu, or sync under{" "}
          <strong>Settings</strong> → <strong>RomM</strong> (Sync library).
          Otherwise nothing is wrong.
        </>
      ) : (
        <>Screenshots here come from RomM metadata. Games added only from a local folder don’t have a RomM gallery yet.</>
      )}
    </Typography>
  </Box>
);

/**
 * Horizontal screenshot strip with a full-screen viewer.
 * @param {object} props
 * @param {string[]} [props.urls] Screenshot URLs.
 * @param {(url: string) => string|null} props.getMediaSrc URL resolver.
 * @param {boolean} [props.isRommGame] Whether the game came from RomM.
 */
const GameScreenshotsSection = ({
  getMediaSrc,
  isRommGame = true,
  urls = EMPTY_URLS,
}) => {
  const list = urls.filter(Boolean);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  if (list.length === 0) {
    return <ScreenshotEmptyState isRommGame={isRommGame} />;
  }
  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };
  return (
    <Box sx={{ mb: 3 }}>
      <Typography color="text.secondary" sx={{ fontWeight: 600, mb: 1.5 }} variant="subtitle2">
        Screenshots
      </Typography>
      <Box
        data-testid="game-screenshots-grid"
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        }}
      >
        {list.map((url, index) => {
          const src = getMediaSrc(url);
          return src ? (
            <ScreenshotCard index={index} onOpen={openLightbox} src={src} url={url} />
          ) : null;
        })}
      </Box>
      <ScreenshotLightbox
        getSrc={getMediaSrc}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
        open={lightboxOpen}
        urls={list}
      />
    </Box>
  );
};

export default GameScreenshotsSection;
