import { useCallback, useEffect, useState } from "react";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsSwitchContentStatus} GameDetailsSwitchContentStatus */

/** @returns {{gameId: GameDetailsGame["id"]|null, status: GameDetailsSwitchContentStatus|null}} Initial read-only content status. */
const getInitialSwitchContentStatus = () => ({
  gameId: null,
  status: null,
});

/** @param {unknown} value IPC status. @returns {value is GameDetailsSwitchContentStatus} Whether the value is a known content status. */
const isSwitchContentStatus = (value) => {
  if (!(value instanceof Object) || !("status" in value)) {
    return false;
  }
  return (
    value.status === "current" ||
    value.status === "missing" ||
    value.status === "changed"
  );
};

/** @param {unknown} value Status returned by IPC. @returns {GameDetailsSwitchContentStatus|null} */
const toSwitchContentStatus = (value) =>
  isSwitchContentStatus(value) ? value : null;

/**
 * Read-only Switch update/DLC status relative to RomM. The lookup runs on open
 * and whenever the viewed game changes; failed or unavailable lookups resolve to
 * no status so the UI never claims content is current.
 * @param {{game: GameDetailsGame, ipc: typeof import("./game-details-ipc").gameDetailsIpc, eligible: boolean}} options Hook options.
 * @returns {{switchContentStatus: GameDetailsSwitchContentStatus|null, refreshSwitchContentStatus: () => Promise<void>}} Content status state and refresh callback.
 */
export const useSwitchContentStatus = ({ game, ipc, eligible }) => {
  const [statusState, setStatusState] = useState(getInitialSwitchContentStatus);
  const switchContentStatus =
    eligible && statusState.gameId === game.id ? statusState.status : null;
  const fetchSwitchContentStatus = useCallback(async () => {
    try {
      return toSwitchContentStatus(
        await ipc.getSwitchContentStatus(game.id)
      );
    } catch {
      // An unavailable lookup must never report "current".
      return null;
    }
  }, [game.id, ipc]);
  const refreshSwitchContentStatus = useCallback(async () => {
    if (!eligible) {
      return;
    }
    const status = await fetchSwitchContentStatus();
    setStatusState({ gameId: game.id, status });
  }, [eligible, fetchSwitchContentStatus, game.id]);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      const status = await fetchSwitchContentStatus();
      if (!cancelled) {
        setStatusState({ gameId: game.id, status });
      }
    };
    if (eligible) {
      void loadStatus();
    }
    return () => {
      cancelled = true;
    };
  }, [eligible, fetchSwitchContentStatus, game.id]);

  return { refreshSwitchContentStatus, switchContentStatus };
};