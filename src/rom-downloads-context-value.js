import { createContext, useContext } from "react";

/** @typedef {{transferId?: string, transferKind?: "rom"|"bios", gameId?: number|string, gameName?: string, firmwareId?: number|string, platformSlug?: string, platformName?: string, fileName?: string, downloaded?: number|null, total?: number|null, percent?: number|null, speed?: string|null, stage?: string, error?: string|null, active?: boolean, file_index?: number|null, total_files?: number|null}} DownloadProgress */
/** @typedef {{kind: "complete", transferId: string, transferKind: "rom", gameId: number|string, gameName: string, path: string, at: number}|{kind: "error", transferId: string, transferKind: "rom", gameId: number|string, gameName: string, message: string, at: number}|{kind: "complete", transferId: string, transferKind: "bios", firmwareId: number|string, platformSlug: string, platformName: string, fileName: string, path?: string|null, at: number}|{kind: "error", transferId: string, transferKind: "bios", firmwareId: number|string, platformSlug: string, platformName: string, fileName: string, message?: string|null, at: number}} RecentDownload */
/** @typedef {Record<string, DownloadProgress>} ProgressMap */
/** @typedef {{activeByGameId: ProgressMap, activeDownloads: DownloadProgress[], recentDownloads: RecentDownload[], clearRecentDownloads: () => void, getProgress: (gameId: number|string) => DownloadProgress|null, getBiosProgress: (firmwareId: number|string, platformSlug: string) => DownloadProgress|null, getBiosRecentDownload: (firmwareId: number|string, platformSlug: string) => RecentDownload|null, retryBiosDownload: (firmwareId: number|string) => Promise<unknown>, getLaunchProgress: (gameId: number|string) => DownloadProgress|null, getSwitchContentProgress: (gameId: number|string) => DownloadProgress|null, activeCount: number}} RomDownloadsContextValue */

/** No-op download callback. */
const noop = () => null;
/** @returns {Promise<null>} No-op async download callback. */
const noopAsync = async () => {
  await Promise.resolve();
  return null;
};

/** @type {import("react").Context<RomDownloadsContextValue>} */
export const RomDownloadsContext = createContext({
  activeByGameId: {},
  activeCount: 0,
  /** @type {DownloadProgress[]} */
  activeDownloads: [],
  clearRecentDownloads: noop,
  getBiosProgress: (_firmwareId, _platformSlug) => null,
  getBiosRecentDownload: (_firmwareId, _platformSlug) => null,
  getLaunchProgress: (_gameId) => null,
  getProgress: (_gameId) => null,
  getSwitchContentProgress: (_gameId) => null,
  /** @type {RecentDownload[]} */
  recentDownloads: [],
  retryBiosDownload: noopAsync,
});

export const useRomDownloads = () => useContext(RomDownloadsContext);
