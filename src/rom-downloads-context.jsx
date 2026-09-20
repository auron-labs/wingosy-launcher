import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RomDownloadsContext } from "./rom-downloads-context-value";
import {
  createRomDownloadEventHandlers,
  getBiosTransferId,
  getRomTransferId,
  subscribeToRomDownloadEvents,
} from "./rom-downloads-event-listeners";
import { isTauri } from "./utils/is-tauri";

/** @typedef {{transferId?: string, transferKind?: "rom"|"bios", gameId?: number|string, gameName?: string, firmwareId?: number|string, platformSlug?: string, platformName?: string, fileName?: string, downloaded?: number|null, total?: number|null, percent?: number|null, speed?: string|null, stage?: string, error?: string|null, active?: boolean, file_index?: number|null, total_files?: number|null}} DownloadProgress */
/** @typedef {{kind: "complete", transferId: string, transferKind: "rom", gameId: number|string, gameName: string, path: string, at: number}|{kind: "error", transferId: string, transferKind: "rom", gameId: number|string, gameName: string, message: string, at: number}|{kind: "complete", transferId: string, transferKind: "bios", firmwareId: number|string, platformSlug: string, platformName: string, fileName: string, path?: string|null, at: number}|{kind: "error", transferId: string, transferKind: "bios", firmwareId: number|string, platformSlug: string, platformName: string, fileName: string, message?: string|null, at: number}} RecentDownload */
/** @typedef {Record<string, DownloadProgress>} ProgressMap */
/** @typedef {(command: string, args?: Record<string, unknown>) => Promise<unknown>} BiosInvoke */

/** @returns {null} No-op effect cleanup. */
const noCleanup = () => null;

/** @param {{activeRef: {current: ProgressMap}, listen: typeof import("@tauri-apps/api/event").listen|undefined, setActiveByGameId: import("react").Dispatch<import("react").SetStateAction<ProgressMap>>, setLaunchProgressByGameId: import("react").Dispatch<import("react").SetStateAction<ProgressMap>>, setRecentDownloads: import("react").Dispatch<import("react").SetStateAction<RecentDownload[]>>, setSwitchContentProgressByGameId: import("react").Dispatch<import("react").SetStateAction<ProgressMap>>}} dependencies Download listener dependencies. */
const useDownloadListeners = ({
  activeRef,
  listen,
  setActiveByGameId,
  setLaunchProgressByGameId,
  setRecentDownloads,
  setSwitchContentProgressByGameId,
}) => {
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
  }, [
    activeRef,
    listen,
    setActiveByGameId,
    setLaunchProgressByGameId,
    setRecentDownloads,
    setSwitchContentProgressByGameId,
  ]);
};

/** @param {{activeByGameId: ProgressMap, invokeBios: BiosInvoke, recentDownloads: RecentDownload[]}} dependencies Shared transfer state. */
const useDownloadLookups = ({
  activeByGameId,
  invokeBios,
  recentDownloads,
}) => {
  const activeDownloads = useMemo(
    () => Object.values(activeByGameId),
    [activeByGameId]
  );
  const getProgress = useCallback(
    /** @param {number|string} gameId Game identifier. */
    (gameId) => activeByGameId[getRomTransferId(gameId)] ?? null,
    [activeByGameId]
  );
  const getBiosProgress = useCallback(
    /** @param {number|string} firmwareId Firmware identifier. @param {string} platformSlug Firmware platform slug. */
    (firmwareId, platformSlug) =>
      activeByGameId[getBiosTransferId(firmwareId, platformSlug)] ?? null,
    [activeByGameId]
  );
  const getBiosRecentDownload = useCallback(
    /** @param {number|string} firmwareId Firmware identifier. @param {string} platformSlug Firmware platform slug. */
    (firmwareId, platformSlug) => {
      const transferId = getBiosTransferId(firmwareId, platformSlug);
      return (
        recentDownloads.find((item) => item.transferId === transferId) ?? null
      );
    },
    [recentDownloads]
  );
  const retryBiosDownload = useCallback(
    /** @param {number|string} firmwareId Firmware identifier. */
    async (firmwareId) => {
      try {
        return await invokeBios("download_bios_firmware", { firmwareId });
      } catch {
        // The backend emits the matching terminal error event for failed retries.
        return null;
      }
    },
    [invokeBios]
  );
  return {
    activeDownloads,
    getBiosProgress,
    getBiosRecentDownload,
    getProgress,
    retryBiosDownload,
  };
};

/** @param {{launchProgressByGameId: ProgressMap, switchContentProgressByGameId: ProgressMap}} progress Game operation progress. */
const useGameProgressLookups = ({
  launchProgressByGameId,
  switchContentProgressByGameId,
}) => {
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
  return { getLaunchProgress, getSwitchContentProgress };
};

/** @param {{children: import("react").ReactNode, listen?: typeof import("@tauri-apps/api/event").listen, invokeBios?: BiosInvoke}} props Provider props. */
export const RomDownloadsProvider = ({
  children,
  listen,
  invokeBios = tauriInvoke,
}) => {
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

  useDownloadListeners({
    activeRef,
    listen,
    setActiveByGameId,
    setLaunchProgressByGameId,
    setRecentDownloads,
    setSwitchContentProgressByGameId,
  });
  const {
    activeDownloads,
    getBiosProgress,
    getBiosRecentDownload,
    getProgress,
    retryBiosDownload,
  } = useDownloadLookups({ activeByGameId, invokeBios, recentDownloads });

  const { getLaunchProgress, getSwitchContentProgress } =
    useGameProgressLookups({
      launchProgressByGameId,
      switchContentProgressByGameId,
    });

  const clearRecentDownloads = useCallback(() => {
    setRecentDownloads([]);
  }, []);

  const value = useMemo(
    () => ({
      activeByGameId,
      activeCount: activeDownloads.length,
      activeDownloads,
      clearRecentDownloads,
      getBiosProgress,
      getBiosRecentDownload,
      getLaunchProgress,
      getProgress,
      getSwitchContentProgress,
      recentDownloads,
      retryBiosDownload,
    }),
    [
      activeByGameId,
      activeDownloads,
      recentDownloads,
      clearRecentDownloads,
      getProgress,
      getBiosProgress,
      getBiosRecentDownload,
      getLaunchProgress,
      getSwitchContentProgress,
      retryBiosDownload,
    ]
  );

  return (
    <RomDownloadsContext.Provider value={value}>
      {children}
    </RomDownloadsContext.Provider>
  );
};
