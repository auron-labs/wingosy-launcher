import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockIcon from "@mui/icons-material/Lock";
import Box from "@mui/material/Box";

import { getAchievementBadgeUrl } from "./achievement-presentation";

/** @typedef {import("./game-details-types").GameDetailsAchievementsAchievement} Achievement */

const TROPHY_AMBER = "#FFB300";

/** @param {{achievement: Achievement, compact?: boolean}} props Achievement badge properties. */
const AchievementBadge = ({ achievement, compact = false }) => {
  const unlocked = achievement.unlocked === true;
  const badgeUrl = getAchievementBadgeUrl(achievement);
  if (badgeUrl === null) {
    if (unlocked) {
      return <EmojiEventsIcon sx={{ color: TROPHY_AMBER }} />;
    }
    return (
      <LockIcon color="disabled" fontSize={compact ? "small" : "medium"} />
    );
  }
  return (
    <Box
      alt={`${achievement.title} (${unlocked ? "unlocked" : "locked"})`}
      component="img"
      src={badgeUrl}
      sx={{
        borderRadius: 1,
        height: "100%",
        objectFit: "cover",
        opacity: unlocked ? 1 : 0.65,
        width: "100%",
      }}
    />
  );
};

export default AchievementBadge;
