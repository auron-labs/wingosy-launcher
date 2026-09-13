import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RomDownloadsContext } from "./rom-downloads-context-value";
import {
  createRomDownloadEventHandlers,
  subscribeToRomDownloadEvents,
} from "./rom-downloads-event-listeners";
import { isTauri } from "./utils/is-tauri";

/** @typedef {{gameId?: number|string, gameName?: string, downloaded?: number|null, total?: number|null, percent?: number|null, stage?: string, error?: string|null, active?: boolean, file_index?: number|null, total_files?: number|null}} DownloadProgress */
/** @typedef {{kind: "complete", gameId: number|string, gameName: string, path: string, at: number}|{kind: "error", gameId: number|string, gameName: string, message: string, at: number}} RecentDownload */
/** @typedef {Record<string|number, DownloadProgress>} ProgressMap */

/** @returns {null} No-op effect cleanup. */
const noCleanup = () => null;

/** @param {{children: import("react").ReactNode, listen?: typeof import("@tauri-apps/api/event").listen}} props Provider props. */
export const RomDownloadsProvider = ({ children, listen }) => {
  /** @type {ProgressMap} */
  const initialActiveByGameId = {};
  const [activeByGameId, setActiveByGameId] = useState(initialActiveByGameId);
  /** @type {RecentDownload[]} */
  const initialRecentDownloads = [];
  const [recentDownloads, setRecentDownloads] = useState(
    initialRecentDownloads
  );
  /** @type {ProgressMap} */
  const initialLaunchProgressByGameId = {};
  const [launchProgressByGameId, setLaunchProgressByGameId] = useState(
    initialLaunchProgressByGameId
  );
  /** @type {ProgressMap} */
  const initialSwitchContentProgressByGameId = {};
  const [switchContentProgressByGameId, setSwitchContentProgressByGameId] =
    useState(initialSwitchContentProgressByGameId);
  /** @type {ProgressMap} */
  const initialActiveRef = {};
  const activeRef = useRef(initialActiveRef);

  useEffect(() => {
    activeRef.current = activeByGameId;
  }, [activeByGameId]);

  useEffect(() => {
    if (!isTauri()) {
      return noCleanup;
    }

    return subscribeToRomDownloadEvents(
      createRomDownloadEventHandlers({
        activeRef,
        setActiveByGameId,
        setLaunchProgressByGameId,
        setRecentDownloads,
        setSwitchContentProgressByGameId,
      }),
      listen
    );
  }, [listen]);

  const activeDownloads = useMemo(
    () => Object.values(activeByGameId),
    [activeByGameId]
  );

  const getProgress = useCallback(
    /** @param {number|string} gameId Game identifier. */
    (gameId) => activeByGameId[gameId] ?? null,
    [activeByGameId]
  );

  const getLaunchProgress = useCallback(
    /** @param {number|string} gameId Game identifier. */
    (gameId) => launchProgressByGameId[gameId] ?? null,
    [launchProgressByGameId]
  );

  const getSwitchContentProgress = useCallback(
    /** @param {number|string} gameId Game identifier. */
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
};
