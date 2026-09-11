import { listen } from "@tauri-apps/api/event";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { isTauri } from "./utils/isTauri";

/** @typedef {{gameId: number|string, gameName: string, downloaded?: number, total?: number|null, percent?: number|null, stage?: string, error?: string|null, active?: boolean, file_index?: number, total_files?: number}} DownloadProgress */
/** @typedef {{kind: "complete", gameId: number|string, gameName: string, path: string, at: number}|{kind: "error", gameId: number|string, gameName: string, message: string, at: number}} RecentDownload */
/** @typedef {Record<string|number, DownloadProgress>} ProgressMap */
/** @typedef {{activeByGameId: ProgressMap, activeDownloads: DownloadProgress[], recentDownloads: RecentDownload[], clearRecentDownloads: () => void, getProgress: (gameId: number|string) => DownloadProgress|null, getLaunchProgress: (gameId: number|string) => DownloadProgress|null, getSwitchContentProgress: (gameId: number|string) => DownloadProgress|null, activeCount: number}} RomDownloadsContextValue */

/** @type {import('react').Context<RomDownloadsContextValue>} */
const RomDownloadsContext = createContext({
  activeByGameId: {},
  activeCount: 0,
  /** @type {DownloadProgress[]} */
  activeDownloads: [],
  clearRecentDownloads: () => {},
  getLaunchProgress: (_gameId) => null,
  getProgress: (_gameId) => null,
  getSwitchContentProgress: (_gameId) => null,
  /** @type {RecentDownload[]} */
  recentDownloads: [],
});

export function useRomDownloads() {
  return useContext(RomDownloadsContext);
}

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) {
    return "";
  }
  const x = Number(n);
  if (x < 1024) {
    return `${x} B`;
  }
  if (x < 1024 * 1024) {
    return `${(x / 1024).toFixed(1)} KB`;
  }
  if (x < 1024 * 1024 * 1024) {
    return `${(x / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(x / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDownloadLabel(progress) {
  if (!progress) {
    return "";
  }
  const { downloaded, total, percent } = progress;
  if (total != null && total > 0) {
    const pct = percent == null ? "" : `${percent}% · `;
    return `${pct}${formatBytes(downloaded)} / ${formatBytes(total)}`;
  }
  return formatBytes(downloaded);
}

export function RomDownloadsProvider({ children }) {
  const [activeByGameId, setActiveByGameId] = useState({});
  const [recentDownloads, setRecentDownloads] = useState(
    /** @type {RecentDownload[]} */ ([])
  );
  const [launchProgressByGameId, setLaunchProgressByGameId] = useState({});
  const [switchContentProgressByGameId, setSwitchContentProgressByGameId] =
    useState({});
  const activeRef = useRef({});

  useEffect(() => {
    activeRef.current = activeByGameId;
  }, [activeByGameId]);

  useEffect(() => {
    if (!isTauri()) {
      return undefined;
    }

    let cancelled = false;
    const unlisteners = [];

    (async () => {
      const safeListen = async (event, handler) => {
        const unlisten = await listen(event, handler);
        if (cancelled) {
          unlisten();
          return;
        }
        unlisteners.push(unlisten);
      };

      await safeListen("rom-download-started", (event) => {
        const { game_id, game_name } = event.payload;
        setActiveByGameId((prev) => ({
          ...prev,
          [game_id]: {
            downloaded: 0,
            gameId: game_id,
            gameName: game_name,
            percent: null,
            total: null,
          },
        }));
      });

      await safeListen("rom-download-progress", (event) => {
        const { game_id, game_name, downloaded, total, percent } =
          event.payload;
        setActiveByGameId((prev) => {
          const cur = prev[game_id];
          if (!cur) {
            return {
              ...prev,
              [game_id]: {
                downloaded,
                gameId: game_id,
                gameName: game_name || `Game #${game_id}`,
                percent,
                total,
              },
            };
          }
          return {
            ...prev,
            [game_id]: { ...cur, downloaded, percent, total },
          };
        });
      });

      await safeListen("rom-download-complete", (event) => {
        const { game_id, game_name, path } = event.payload;
        const cur = activeRef.current[game_id];
        const gameName = game_name || cur?.gameName || `Game #${game_id}`;
        setActiveByGameId((prev) => {
          const next = { ...prev };
          delete next[game_id];
          return next;
        });
        setRecentDownloads((r) =>
          [
            /** @type {RecentDownload} */ ({
              at: Date.now(),
              gameId: game_id,
              gameName,
              kind: "complete",
              path,
            }),
            ...r.filter(
              (item) =>
                !(
                  item.kind === "complete" &&
                  item.gameId === game_id &&
                  item.path === path
                )
            ),
          ].slice(0, 25)
        );
      });

      await safeListen("rom-download-error", (event) => {
        const { game_id, game_name, message } = event.payload;
        const cur = activeRef.current[game_id];
        const gameName = game_name || cur?.gameName || `Game #${game_id}`;
        setActiveByGameId((prev) => {
          const next = { ...prev };
          delete next[game_id];
          return next;
        });
        setRecentDownloads((r) =>
          [
            /** @type {RecentDownload} */ ({
              at: Date.now(),
              gameId: game_id,
              gameName,
              kind: "error",
              message,
            }),
            ...r.filter(
              (item) =>
                !(
                  item.kind === "error" &&
                  item.gameId === game_id &&
                  item.message === message
                )
            ),
          ].slice(0, 25)
        );
      });

      await safeListen("game-launch-progress", (event) => {
        const progress = event.payload || {};
        if (progress.game_id == null) {
          return;
        }
        const terminal =
          progress.stage === "completion" || progress.stage === "failure";
        setLaunchProgressByGameId((prev) => ({
          ...prev,
          [progress.game_id]: {
            active: !terminal,
            downloaded: progress.downloaded,
            error: progress.error || null,
            gameId: progress.game_id,
            gameName: progress.game_name || `Game #${progress.game_id}`,
            percent: progress.percent,
            stage: progress.stage,
            total: progress.total,
          },
        }));
      });

      await safeListen("switch-content-sync-progress", (event) => {
        const progress = event.payload || {};
        if (progress.game_id == null) {
          return;
        }
        setSwitchContentProgressByGameId((prev) => ({
          ...prev,
          [progress.game_id]: progress,
        }));
      });

      const clearSwitchContentProgress = (event) => {
        const gameId = event.payload?.game_id;
        if (gameId == null) {
          return;
        }
        setSwitchContentProgressByGameId((prev) => {
          const next = { ...prev };
          delete next[gameId];
          return next;
        });
      };
      await safeListen(
        "switch-content-sync-complete",
        clearSwitchContentProgress
      );
      await safeListen("switch-content-sync-error", clearSwitchContentProgress);
    })();

    return () => {
      cancelled = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

  const activeDownloads = useMemo(
    () => Object.values(activeByGameId),
    [activeByGameId]
  );

  const getProgress = useCallback(
    (gameId) => activeByGameId[gameId] ?? null,
    [activeByGameId]
  );

  const getLaunchProgress = useCallback(
    (gameId) => launchProgressByGameId[gameId] ?? null,
    [launchProgressByGameId]
  );

  const getSwitchContentProgress = useCallback(
    (gameId) => switchContentProgressByGameId[gameId] ?? null,
    [switchContentProgressByGameId]
  );

  const clearRecentDownloads = useCallback(() => {
    setRecentDownloads([]);
  }, []);

  const value = useMemo(
    () => ({
      activeByGameId,
      activeCount: activeDownloads.length,
      activeDownloads,
      clearRecentDownloads,
      getLaunchProgress,
      getProgress,
      getSwitchContentProgress,
      recentDownloads,
    }),
    [
      activeByGameId,
      activeDownloads,
      recentDownloads,
      clearRecentDownloads,
      getProgress,
      getLaunchProgress,
      getSwitchContentProgress,
    ]
  );

  return (
    <RomDownloadsContext.Provider value={value}>
      {children}
    </RomDownloadsContext.Provider>
  );
}
