import { useEffect, useState } from "react";

import { gameDetailsIpc } from "./game-details-ipc";

/** @param {{getGameDetailsConfig: () => Promise<import("./game-details-types").GameDetailsConfig>}} ipc Game details IPC. */
export const useGameDetailsRetroAchievements = (ipc = gameDetailsIpc) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const config = await ipc.getGameDetailsConfig();
        if (!cancelled) {
          setEnabled(Boolean(config.display?.retroachievements_enabled));
        }
      } catch {
        if (!cancelled) {
          setEnabled(false);
        }
      }
    };
    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [ipc]);

  return enabled;
};
