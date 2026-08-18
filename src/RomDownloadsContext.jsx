import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "./utils/isTauri";

const RomDownloadsContext = createContext({
  activeByGameId: {},
  activeDownloads: [],
  recentDownloads: [],
  getProgress: (_gameId) => null,
  getLaunchProgress: (_gameId) => null,
  activeCount: 0,
});

export function useRomDownloads() {
  return useContext(RomDownloadsContext);
}

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return "";
  const x = Number(n);
  if (x < 1024) return `${x} B`;
  if (x < 1024 * 1024) return `${(x / 1024).toFixed(1)} KB`;
  if (x < 1024 * 1024 * 1024) return `${(x / (1024 * 1024)).toFixed(2)} MB`;
  return `${(x / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDownloadLabel(progress) {
  if (!progress) return "";
  const { downloaded, total, percent } = progress;
  if (total != null && total > 0) {
    const pct = percent != null ? `${percent}% · ` : "";
    return `${pct}${formatBytes(downloaded)} / ${formatBytes(total)}`;
  }
  return formatBytes(downloaded);
}

export function RomDownloadsProvider({ children }) {
  const [activeByGameId, setActiveByGameId] = useState({});
  const [recentDownloads, setRecentDownloads] = useState([]);
  const [launchProgressByGameId, setLaunchProgressByGameId] = useState({});
  const activeRef = useRef({});

  useEffect(() => {
    activeRef.current = activeByGameId;
  }, [activeByGameId]);

  useEffect(() => {
    if (!isTauri()) return undefined;

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
            gameId: game_id,
            gameName: game_name,
            downloaded: 0,
            total: null,
            percent: null,
          },
        }));
      });

      await safeListen("rom-download-progress", (event) => {
        const { game_id, game_name, downloaded, total, percent } = event.payload;
        setActiveByGameId((prev) => {
          const cur = prev[game_id];
          if (!cur) {
            return {
              ...prev,
              [game_id]: {
                gameId: game_id,
                gameName: game_name || `Game #${game_id}`,
                downloaded,
                total,
                percent,
              },
            };
          }
          return {
            ...prev,
            [game_id]: { ...cur, downloaded, total, percent },
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
            {
              kind: "complete",
              gameId: game_id,
              gameName,
              path,
              at: Date.now(),
            },
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
            {
              kind: "error",
              gameId: game_id,
              gameName,
              message,
              at: Date.now(),
            },
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
        if (progress.game_id == null) return;
        const terminal = progress.stage === "completion" || progress.stage === "failure";
        setLaunchProgressByGameId((prev) => ({
          ...prev,
          [progress.game_id]: {
            gameId: progress.game_id,
            gameName: progress.game_name || `Game #${progress.game_id}`,
            stage: progress.stage,
            error: progress.error || null,
            downloaded: progress.downloaded,
            total: progress.total,
            percent: progress.percent,
            active: !terminal,
          },
        }));
      });
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

  const value = useMemo(
    () => ({
      activeByGameId,
      activeDownloads,
      recentDownloads,
      getProgress,
      getLaunchProgress,
      activeCount: activeDownloads.length,
    }),
    [
      activeByGameId,
      activeDownloads,
      recentDownloads,
      getProgress,
      getLaunchProgress,
    ]
  );

  return (
    <RomDownloadsContext.Provider value={value}>
      {children}
    </RomDownloadsContext.Provider>
  );
}
