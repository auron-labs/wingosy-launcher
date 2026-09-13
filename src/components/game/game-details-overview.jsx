import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import GroupsIcon from "@mui/icons-material/Groups";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import StarIcon from "@mui/icons-material/Star";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

import GameAchievementsSection from "./game-achievements-section";
import { formatLastPlayed, getMediaSrc } from "./game-details-utils";
import GameScreenshotsSection from "./game-screenshots-section";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */

/** @typedef {{Icon: typeof AccessTimeIcon, label: string, value: string|number}} GameStatProps */

/** @param {GameStatProps} props Stat properties. */
const GameStat = ({ Icon, label, value }) => (
  <Box
    sx={{
      alignItems: "baseline",
      columnGap: 1.25,
      display: "grid",
      gridTemplateColumns: "auto minmax(0, 1fr)",
      gridTemplateRows: "auto auto",
      minWidth: 0,
      rowGap: 0.25,
    }}
  >
    <Icon color="action" sx={{ alignSelf: "center", gridRow: "1 / span 2" }} />
    <Typography
      color="text.secondary"
      sx={{ lineHeight: 1.25 }}
      variant="body2"
    >
      {label}
    </Typography>
    <Typography
      component="div"
      sx={{ fontWeight: 700, lineHeight: 1.25, overflowWrap: "anywhere" }}
      variant="h6"
    >
      {value}
    </Typography>
  </Box>
);

/** @param {{label: string, value: string|null|undefined}} props Credit properties. */
const Credit = ({ label, value }) => (
  <Box>
    <Typography color="text.secondary" variant="caption">
      {label}
    </Typography>
    <Typography sx={{ fontWeight: 600 }} variant="body2">
      {value}
    </Typography>
  </Box>
);

/** @param {{summary?: string|null}} props Description properties. */
const GameDescription = ({ summary }) => {
  if (summary !== null && summary !== undefined && summary !== "") {
    return (
      <>
        <Typography gutterBottom variant="h6">
          About
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ lineHeight: 1.8 }}
          variant="body2"
        >
          {summary}
        </Typography>
      </>
    );
  }
  return (
    <Typography
      color="text.secondary"
      sx={{ fontStyle: "italic" }}
      variant="body2"
    >
      No description available.
    </Typography>
  );
};

/**
 * @param {{game: GameDetailsGame, lastPlayed: string|null, playTime: string}} props Metadata properties.
 */
const GameMetadataStats = ({ game, lastPlayed, playTime }) => (
  <Box
    sx={{
      display: "grid",
      gap: 2,
      gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
      mb: 3,
    }}
  >
    <GameStat Icon={AccessTimeIcon} label="Play time" value={playTime} />
    <GameStat
      Icon={SportsEsportsIcon}
      label="Times played"
      value={game.play_count ?? 0}
    />
    {lastPlayed !== null && lastPlayed !== "" && (
      <GameStat
        Icon={CalendarTodayIcon}
        label="Last played"
        value={lastPlayed}
      />
    )}
    {game.release_year !== null && game.release_year !== undefined && (
      <GameStat
        Icon={CalendarTodayIcon}
        label="Release year"
        value={game.release_year}
      />
    )}
    {game.user_rating !== null && game.user_rating !== undefined && (
      <GameStat
        Icon={StarIcon}
        label="IGDB aggregated rating"
        value={`${game.user_rating.toFixed(1)} / 100`}
      />
    )}
    {game.player_count !== null &&
      game.player_count !== undefined &&
      game.player_count !== "" && (
        <GameStat
          Icon={GroupsIcon}
          label="Game modes"
          value={game.player_count}
        />
      )}
  </Box>
);

/** @param {{game: GameDetailsGame}} props Credit properties. */
const GameCredits = ({ game }) => {
  const hasDeveloper =
    game.developer !== null &&
    game.developer !== undefined &&
    game.developer !== "";
  const hasPublisher =
    game.publisher !== null &&
    game.publisher !== undefined &&
    game.publisher !== "";
  if (!hasDeveloper && !hasPublisher) {
    return null;
  }
  return (
    <Box sx={{ display: "flex", gap: 4, mb: 3 }}>
      {hasDeveloper && <Credit label="Developer" value={game.developer} />}
      {hasPublisher && <Credit label="Publisher" value={game.publisher} />}
    </Box>
  );
};

/** @typedef {{game: GameDetailsGame, retroachievementsEnabled: boolean, onOpenIntegrations: (() => void)|null}} GameDetailsOverviewProps */

/** @param {GameDetailsOverviewProps} props Component properties. */
export const GameDetailsOverview = ({
  game,
  onOpenIntegrations,
  retroachievementsEnabled,
}) => {
  const screenshots = Array.isArray(game.screenshot_paths)
    ? game.screenshot_paths
    : [];
  const playTimeMinutes = game.play_time_minutes ?? 0;
  const playHours = Math.floor(playTimeMinutes / 60);
  const playMins = playTimeMinutes % 60;
  const playTime =
    playHours > 0 ? `${playHours}h ${playMins}m` : `${playMins}m`;
  const lastPlayed = formatLastPlayed(game.last_played_at);

  return (
    <>
      <GameScreenshotsSection
        getMediaSrc={getMediaSrc}
        isRommGame={Boolean(game.romm_id)}
        urls={screenshots}
      />
      <Divider sx={{ my: 3 }} />
      <GameMetadataStats
        game={game}
        lastPlayed={lastPlayed}
        playTime={playTime}
      />
      <GameAchievementsSection
        gameName={game.name}
        onOpenIntegrations={onOpenIntegrations}
        retroAchievementsEnabled={retroachievementsEnabled}
      />
      <GameCredits game={game} />
      <GameDescription summary={game.summary} />
    </>
  );
};
