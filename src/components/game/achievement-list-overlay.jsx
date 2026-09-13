import CloseIcon from "@mui/icons-material/Close";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockIcon from "@mui/icons-material/Lock";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

import KeyboardHint from "../keyboard-hint";

/** @typedef {import("./game-details-types").GameDetailsAchievementsAchievement} Achievement */

const TROPHY_AMBER = "#FFB300";
/** @type {Achievement[]} */
const EMPTY_ACHIEVEMENTS = [];

/**
 * @param {object} props Achievement overlay properties.
 * @param {string} props.title Empty state heading.
 * @param {React.ReactNode} props.description Empty state explanation.
 * @param {string|null} [props.action] Optional action label.
 * @param {(() => void)|null} [props.onOpenIntegrations] Settings navigation callback.
 */
const AchievementEmptyState = ({
  action = null,
  description,
  onOpenIntegrations = null,
  title,
}) => (
  <Box
    data-testid="achievement-empty-state"
    sx={{
      alignItems: "center",
      display: "flex",
      flexDirection: "column",
      gap: 1.5,
      justifyContent: "center",
      minHeight: "min(52vh, 520px)",
      px: 2,
      textAlign: "center",
    }}
  >
    <EmojiEventsIcon sx={{ color: TROPHY_AMBER, fontSize: 72, opacity: 0.8 }} />
    <Typography component="h2" variant="h5">
      {title}
    </Typography>
    <Typography color="text.secondary" sx={{ maxWidth: 560 }} variant="body1">
      {description}
    </Typography>
    {action !== null && action !== "" ? (
      <Button
        component="a"
        href="#settings/integrations"
        onClick={(event) => {
          if (!onOpenIntegrations) {
            return;
          }
          event.preventDefault();
          onOpenIntegrations();
        }}
        sx={{ mt: 1 }}
        variant="outlined"
      >
        {action}
      </Button>
    ) : null}
  </Box>
);

/** @param {{achievement: Achievement, locked: boolean}} props Renders one achievement row. */
const AchievementRow = ({ achievement, locked }) => (
  <Box
    sx={{
      alignItems: "flex-start",
      bgcolor: locked ? "action.hover" : "action.selected",
      borderRadius: 2,
      display: "flex",
      gap: 2,
      mb: 1,
      px: 1.5,
      py: 1.5,
    }}
  >
    <Box
      sx={{
        alignItems: "center",
        bgcolor: "background.paper",
        borderRadius: 1,
        display: "flex",
        flexShrink: 0,
        height: 56,
        justifyContent: "center",
        width: 56,
      }}
    >
      {locked ? (
        <LockIcon color="disabled" />
      ) : (
        <EmojiEventsIcon sx={{ color: TROPHY_AMBER }} />
      )}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontWeight: 600 }} variant="body2">
        {achievement.title}
      </Typography>
      {achievement.description !== null &&
      achievement.description !== undefined &&
      achievement.description !== "" ? (
        <Typography color="text.secondary" variant="caption">
          {achievement.description}
        </Typography>
      ) : null}
    </Box>
    <Typography color="text.secondary" variant="caption">
      {achievement.points ?? 0} pts
    </Typography>
  </Box>
);

/** @param {{achievements: Achievement[]}} props Renders unlocked and locked lists. */
const AchievementSections = ({ achievements }) => {
  const unlocked = achievements.filter(
    (achievement) => achievement.unlocked === true
  );
  const locked = achievements.filter(
    (achievement) => achievement.unlocked !== true
  );
  return (
    <>
      {unlocked.length > 0 && (
        <>
          <Typography
            sx={{ color: TROPHY_AMBER, fontWeight: 700, letterSpacing: 1 }}
            variant="overline"
          >
            UNLOCKED ({unlocked.length})
          </Typography>
          {unlocked.map((achievement) => (
            <AchievementRow
              achievement={achievement}
              key={achievement.id}
              locked={false}
            />
          ))}
        </>
      )}
      {locked.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography
            color="text.secondary"
            sx={{ fontWeight: 700, letterSpacing: 1 }}
            variant="overline"
          >
            LOCKED ({locked.length})
          </Typography>
          {locked.map((achievement) => (
            <AchievementRow
              achievement={achievement}
              key={achievement.id}
              locked
            />
          ))}
        </>
      )}
    </>
  );
};

/** @param {{enabled: boolean, achievements: Achievement[], onOpenIntegrations: (() => void)|null}} props Achievement content properties. */
const AchievementContent = ({ achievements, enabled, onOpenIntegrations }) => {
  if (!enabled) {
    return (
      <AchievementEmptyState
        action="Open Integrations settings"
        description={
          <>
            Turn on RetroAchievements to load achievement data when supported.
            Visit{" "}
            <Link
              href="#settings/integrations"
              onClick={(event) => {
                event.preventDefault();
                onOpenIntegrations?.();
              }}
            >
              Settings → Integrations
            </Link>{" "}
            to enable it.
          </>
        }
        onOpenIntegrations={onOpenIntegrations}
        title="RetroAchievements is turned off"
      />
    );
  }
  if (achievements.length === 0) {
    return (
      <AchievementEmptyState
        description="No RetroAchievements data is available for this game yet."
        title="No achievements yet"
      />
    );
  }
  return <AchievementSections achievements={achievements} />;
};

/**
 * Full-screen achievement list overlay.
 * @param {object} props Overlay properties.
 * @param {boolean} props.open Whether the dialog is visible.
 * @param {() => void} props.onClose Close callback.
 * @param {string} props.gameTitle Game name shown in the header.
 * @param {boolean} props.retroAchievementsEnabled Integration state.
 * @param {(() => void)|null} [props.onOpenIntegrations] Settings navigation callback.
 * @param {Achievement[]} [props.achievements] Achievement rows.
 */
const AchievementListOverlay = ({
  achievements = EMPTY_ACHIEVEMENTS,
  gameTitle,
  onClose,
  onOpenIntegrations = null,
  open,
  retroAchievementsEnabled,
}) => {
  const unlockedCount = achievements.filter(
    (achievement) => achievement.unlocked === true
  ).length;
  const total = achievements.length;
  const progress = total > 0 ? Math.floor((unlockedCount * 100) / total) : 0;
  return (
    <Dialog
      fullScreen
      onClose={onClose}
      open={open}
      slotProps={{ paper: { sx: { bgcolor: "background.default" } } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box
          sx={{
            alignItems: "center",
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            gap: 2,
            px: 2,
            py: 2,
          }}
        >
          <EmojiEventsIcon sx={{ color: TROPHY_AMBER, fontSize: 28 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 600 }} variant="subtitle1">
              {gameTitle}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Achievements
            </Typography>
          </Box>
          {retroAchievementsEnabled && total > 0 ? (
            <Typography color="primary" variant="subtitle1">
              {unlockedCount}/{total} ({progress}%)
            </Typography>
          ) : null}
          <KeyboardHint>Esc to close</KeyboardHint>
          <IconButton aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 2 }}>
          <AchievementContent
            achievements={achievements}
            enabled={retroAchievementsEnabled}
            onOpenIntegrations={onOpenIntegrations}
          />
        </Box>
      </Box>
    </Dialog>
  );
};

export default AchievementListOverlay;
