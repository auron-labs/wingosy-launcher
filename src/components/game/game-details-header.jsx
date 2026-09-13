import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import {
  tauriDragRegionProps,
  tauriDragRegionSx,
  tauriNoDragProps,
  tauriNoDragSx,
} from "../../utils/is-tauri";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */

/** @param {{game: GameDetailsGame, coverSrc: string|null, onImageError: () => void}} props Game hero properties. */
const GameDetailsHero = ({ coverSrc, game, onImageError }) => (
  <Box
    data-testid="game-details-hero"
    sx={{
      bgcolor: "rgba(0,0,0,0.3)",
      borderRadius: 3,
      boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
      height: { md: 390, sm: 340, xs: 260 },
      mb: 3,
      overflow: "hidden",
      position: "relative",
      width: "100%",
    }}
  >
    <Box
      alt={game.name}
      component="img"
      onError={onImageError}
      src={coverSrc ?? undefined}
      sx={{
        filter: "brightness(0.62) saturate(0.92)",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        width: "100%",
      }}
    />
    <Box
      sx={{
        alignItems: "flex-end",
        background:
          "linear-gradient(180deg, rgba(8,8,12,0.04) 25%, rgba(8,8,12,0.18) 48%, rgba(8,8,12,0.92) 100%)",
        display: "flex",
        inset: 0,
        p: { sm: 4, xs: 2.5 },
        position: "absolute",
      }}
    >
      <Typography
        component="h1"
        sx={{
          color: "#fff",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          textShadow: "0 2px 12px rgba(0,0,0,0.8)",
        }}
        variant="h3"
      >
        {game.name}
      </Typography>
    </Box>
  </Box>
);

/** @param {{game: GameDetailsGame, showCover: boolean, coverSrc: string|null, onBack: () => void, onImageError: () => void}} props Header properties. */
export const GameDetailsHeader = ({
  coverSrc,
  game,
  onBack,
  onImageError,
  showCover,
}) => (
  <>
    <Box
      sx={{
        alignItems: "center",
        backdropFilter: "blur(10px)",
        bgcolor: (theme) => `rgb(${theme.palette.background.default} / 92%)`,
        borderBottom: 1,
        borderColor: "divider",
        borderRadius: 2,
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        mb: 2,
        mx: { sm: 0, xs: -1 },
        position: "sticky",
        px: 2,
        py: 1.5,
        top: 0,
        zIndex: 10,
      }}
    >
      <Button
        {...tauriNoDragProps()}
        color="inherit"
        data-argosy-sound="back"
        onClick={onBack}
        startIcon={<ArrowBackIcon />}
        sx={{ ...tauriNoDragSx, flexShrink: 0 }}
      >
        Back to Library
      </Button>
      <Box
        {...tauriDragRegionProps()}
        sx={{ flex: 1, minHeight: 36, minWidth: 80, ...tauriDragRegionSx }}
      />
    </Box>
    {showCover ? (
      <GameDetailsHero
        coverSrc={coverSrc}
        game={game}
        onImageError={onImageError}
      />
    ) : null}
  </>
);
