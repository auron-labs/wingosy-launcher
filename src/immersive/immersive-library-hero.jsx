import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { InstalledMarker } from "./immersive-shell";
import {
  IMMERSIVE_TITLE_FONT,
  getImmersiveGenres,
  getImmersiveYear,
  isImmersiveInstalled,
} from "./immersive-shell-utils";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-shell-utils").SpinePlatformOption} SpinePlatformOption */

/** @param {{game: ImmersiveGame, platformOptions: SpinePlatformOption[]}} props Hero metadata properties. */
export const HeroMetadata = ({ game, platformOptions }) => {
  const platformEntry = platformOptions.find(
    (option) => option.id !== null && option.id === game.platform_id
  );
  const platformLabel = platformEntry?.label ?? game.platform_id;
  const year = getImmersiveYear(game);
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
    >
      <Typography
        sx={{
          color: "common.white",
          fontSize: "0.95rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {year === null ? platformLabel : `${platformLabel} / ${year}`}
      </Typography>
      <InstalledMarker installed={isImmersiveInstalled(game)} />
    </Stack>
  );
};

/** @param {{summary?: string|null}} props Hero summary properties. */
export const HeroSummary = ({ summary }) => {
  if (summary === null || summary === undefined || summary === "") {
    return null;
  }
  return (
    <Typography
      sx={{
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        color: "rgba(245,241,232,0.85)",
        display: "-webkit-box",
        fontSize: "1.05rem",
        lineHeight: 1.5,
        mt: 1.5,
        overflow: "hidden",
        textShadow: "0 1px 12px rgba(0,0,0,0.7)",
      }}
    >
      {summary}
    </Typography>
  );
};

/** @param {{game: ImmersiveGame, platformOptions: SpinePlatformOption[]}} props Hero stage properties. */
export const HeroStage = ({ game, platformOptions }) => (
  <Box sx={{ maxWidth: 640, mt: 2 }}>
    <HeroMetadata game={game} platformOptions={platformOptions} />
    <Typography
      component="h1"
      sx={{
        color: "#f5f1e8",
        fontFamily: IMMERSIVE_TITLE_FONT,
        fontSize: "clamp(2.75rem, 6vw, 5.5rem)",
        fontWeight: 700,
        letterSpacing: "0.01em",
        lineHeight: 1.02,
        mt: 1,
        textShadow: "0 2px 24px rgba(0,0,0,0.6)",
        textTransform: "uppercase",
      }}
    >
      {game.name}
    </Typography>
    {getImmersiveGenres(game).length > 0 ? (
      <Typography
        sx={{
          color: "rgba(245,241,232,0.75)",
          fontSize: "1rem",
          fontWeight: 500,
          letterSpacing: "0.22em",
          mt: 1,
          textTransform: "uppercase",
        }}
      >
        {getImmersiveGenres(game).join(" / ")}
      </Typography>
    ) : null}
    <HeroSummary summary={game.summary} />
  </Box>
);
