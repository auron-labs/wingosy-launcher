import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { getShelfLabel } from "./immersive-cover-shelf-utils";
import ImmersiveGameTile from "./immersive-game-tile";
import { FocusBrackets } from "./immersive-shell";
import { formatImmersivePosition } from "./immersive-shell-utils";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {{downloaded?: number|null, total?: number|null, percent?: number|null}|null} DownloadProgress */

/** @param {{section: string, selectedIndex: number, total: number}} props Shelf heading properties. */
export const ShelfHeading = ({ section, selectedIndex, total }) => (
  <Stack direction="row" spacing={2} sx={{ alignItems: "baseline", mb: 1.5 }}>
    <Typography
      sx={{
        color: "rgba(245,241,232,0.85)",
        fontSize: "0.8rem",
        fontWeight: 700,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
      }}
    >
      {getShelfLabel(section)}
    </Typography>
    <Typography
      sx={{
        color: "rgba(245,241,232,0.55)",
        fontSize: "0.85rem",
        fontWeight: 600,
        letterSpacing: "0.12em",
      }}
    >
      {total === 0
        ? "00 / 00"
        : `${formatImmersivePosition(selectedIndex + 1)} / ${formatImmersivePosition(total)}`}
    </Typography>
  </Stack>
);

/** @param {{game: ImmersiveGame, focused: boolean, index: number, getProgress: (id: number|string) => DownloadProgress, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void, reducedMotion: boolean}} props Shelf card properties. */
export const ShelfCard = ({
  game,
  focused,
  index,
  getProgress,
  onSelectedIndexChange,
  onSelectGame,
  reducedMotion,
}) => (
  <Box
    data-immersive-index={index}
    sx={{
      minWidth: 0,
      position: "relative",
      width: "100%",
    }}
  >
    <Box sx={{ position: "relative" }}>
      <FocusBrackets active={focused} />
      <ImmersiveGameTile
        game={game}
        focused={focused}
        titleOverlay={false}
        onFocus={() => {
          onSelectedIndexChange(index, game);
        }}
        onSelect={() => {
          onSelectGame(game);
        }}
        downloadProgress={getProgress(game.id)}
      />
    </Box>
    <Typography
      sx={{
        color: focused ? "common.white" : "rgba(245,241,232,0.72)",
        fontSize: "0.95rem",
        fontWeight: focused ? 700 : 500,
        lineHeight: 1.3,
        mt: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        transition: reducedMotion ? "none" : "color 0.2s ease",
        whiteSpace: "nowrap",
      }}
      title={game.name}
    >
      {game.name}
    </Typography>
  </Box>
);

/** @param {{columns: number, gridRef: {current: HTMLElement|null}, selectedIndex: number, visibleGames: ImmersiveGame[], getProgress: (id: number|string) => DownloadProgress, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void, reducedMotion: boolean}} props Cover shelf properties. */
export const CoverShelf = ({
  columns,
  gridRef,
  selectedIndex,
  visibleGames,
  getProgress,
  onSelectedIndexChange,
  onSelectGame,
  reducedMotion,
}) => (
  <Box
    ref={gridRef}
    data-testid="immersive-grid"
    sx={{
      display: "grid",
      gap: { md: 2.5, sm: 2, xs: 1.5 },
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      pb: 2,
      pt: 1.5,
      px: 1,
    }}
  >
    {visibleGames.map((game, index) => (
      <ShelfCard
        key={game.id}
        game={game}
        index={index}
        focused={index === selectedIndex}
        getProgress={getProgress}
        onSelectedIndexChange={onSelectedIndexChange}
        onSelectGame={onSelectGame}
        reducedMotion={reducedMotion}
      />
    ))}
  </Box>
);
