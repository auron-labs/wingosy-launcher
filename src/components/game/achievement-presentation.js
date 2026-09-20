/** @typedef {import("./game-details-types").GameDetailsAchievementsAchievement} Achievement */

/**
 * @param {Achievement[]} achievements Achievement rows.
 * @returns {{earnedPoints: number, progress: number, total: number, totalPoints: number, unlocked: number}} Achievement summary values.
 */
export const getAchievementStats = (achievements) => {
  const unlocked = achievements.filter(
    (achievement) => achievement.unlocked === true
  ).length;
  const total = achievements.length;
  const earnedPoints = achievements.reduce(
    (sum, achievement) =>
      sum + (achievement.unlocked === true ? (achievement.points ?? 0) : 0),
    0
  );
  const totalPoints = achievements.reduce(
    (sum, achievement) => sum + (achievement.points ?? 0),
    0
  );
  return {
    earnedPoints,
    progress: total > 0 ? Math.round((unlocked * 100) / total) : 0,
    total,
    totalPoints,
    unlocked,
  };
};

/** @param {Achievement} achievement Achievement row. @returns {string|null} Badge URL appropriate for its state. */
export const getAchievementBadgeUrl = (achievement) => {
  const url =
    achievement.unlocked === true
      ? (achievement.badge_url ?? achievement.badge_url_lock)
      : (achievement.badge_url_lock ?? achievement.badge_url);
  if (url === null || url === undefined || url === "") {
    return null;
  }
  return url;
};
